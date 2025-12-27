import { useCallback } from "react";
import { webln } from "@getalby/sdk";
import { toast } from "sonner";
import { bech32 } from "bech32";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Add WebLN to window type
declare global {
  interface Window {
    webln?: webln.NostrWebLNProvider;
  }
}

interface ZapOptions {
  amount: number;
  eventId: string;
  eventPubkey: string;
  eventKind: number;
  eventIdentifier?: string;
  eventName?: string;
  comment?: string;
  lightningAddress: string;
  // If true, caller will handle success toast - prevents duplicate toasts
  skipSuccessToast?: boolean;
}

function lightningAddressToLnurl(lightningAddress: string): string {
  const [username, domain] = lightningAddress.split("@");
  const url = `https://${domain}/.well-known/lnurlp/${username}`;
  const encoder = new TextEncoder();
  const words = bech32.toWords(encoder.encode(url));
  return bech32.encode("lnurl", words, 1023).toUpperCase();
}

export function useZap() {
  const { user } = useCurrentUser();

  const zap = useCallback(
    async (options: ZapOptions) => {
      try {
        if (!user?.signer) {
          throw new Error("Please log in to send zaps");
        }

        if (!user.pubkey) {
          throw new Error("Could not get user information");
        }

        // Convert lightning address to LNURL
        const lnurl = lightningAddressToLnurl(options.lightningAddress);
        const [username, domain] = options.lightningAddress.split("@");

        // Validate lightning address format
        if (!username || !domain) {
          throw new Error("Invalid lightning address format");
        }

        // Fetch LNURL data from the user's server
        let lnurlResponse;
        try {
          lnurlResponse = await fetch(
            `https://${domain}/.well-known/lnurlp/${username}`,
            {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
              },
            }
          );
        } catch {
          throw new Error("Unable to connect to lightning service. Please check your internet connection.");
        }

        if (!lnurlResponse.ok) {
          throw new Error("Lightning address not found or invalid");
        }

        const lnurlData = await lnurlResponse.json();
        
        if (lnurlData.status === "ERROR") {
          throw new Error(lnurlData.reason || "Lightning service error");
        }

        if (!lnurlData.allowsNostr) {
          throw new Error("This lightning address doesn't support Nostr zaps");
        }

        // Validate amount is within bounds from the lightning service
        const amountMsats = options.amount * 1000;
        if (lnurlData.minSendable && amountMsats < lnurlData.minSendable) {
          throw new Error(`Minimum zap amount is ${Math.ceil(lnurlData.minSendable / 1000)} sats`);
        }
        if (lnurlData.maxSendable && amountMsats > lnurlData.maxSendable) {
          throw new Error(`Maximum zap amount is ${Math.floor(lnurlData.maxSendable / 1000)} sats`);
        }

        // Create zap request event following NIP-57 requirements
        const zapRequestTags: string[][] = [
          // Required: relays tag for zap receipt
          ["relays", "wss://relay.damus.io", "wss://nostr-relay.wlvs.space"],
          // Required: amount tag matching the amount parameter
          ["amount", amountMsats.toString()],
          // Required: lnurl tag
          ["lnurl", lnurl],
          // Required: exactly one p tag
          ["p", options.eventPubkey],
        ];

        // Optional: add e tag only if we have a valid event ID
        if (options.eventId && options.eventId.trim() !== "") {
          zapRequestTags.push(["e", options.eventId]);
        }

        const zapRequestUnsigned = {
          kind: 9734,
          content: options.comment || "",
          tags: zapRequestTags,
          created_at: Math.floor(Date.now() / 1000),
          pubkey: user.pubkey,
        };

        // Sign the zap request
        const zapRequest = await user.signer.signEvent(zapRequestUnsigned);

        // Create the invoice using the LNURL callback
        const zapRequestJson = JSON.stringify(zapRequest);
        const callbackUrl = `${lnurlData.callback}?amount=${amountMsats}&nostr=${encodeURIComponent(zapRequestJson)}`;

        let callbackResponse;
        let zapSuccessful = true;

        try {
          callbackResponse = await fetch(callbackUrl, {
            method: 'GET',
            // Don't include Content-Type in GET requests to avoid CORS preflight
            headers: {
              'Accept': 'application/json',
            },
          });
        } catch {
          zapSuccessful = false;

          // Skip to fallback immediately if we get a CORS or network error
          const fallbackUrl = `${lnurlData.callback}?amount=${amountMsats}`;
          
          try {
            callbackResponse = await fetch(fallbackUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
              },
            });
            
            if (callbackResponse.ok) {
              const fallbackData = await callbackResponse.json();
              if (fallbackData.pr && !fallbackData.status) {
                toast.warning("Payment will be sent but may not appear as a zap on Nostr");
                zapSuccessful = false; // Not a real zap, just a payment
              }
            }
          } catch {
            throw new Error("Unable to connect to lightning service. This may be due to CORS restrictions or service unavailability.");
          }
        }

        // If the first attempt failed but didn't error, try POST
        if (zapSuccessful && callbackResponse && !callbackResponse.ok) {
          
          const postUrl = `${lnurlData.callback}`;
          const formData = new URLSearchParams({
            amount: amountMsats.toString(),
            nostr: zapRequestJson
          });

          try {
            callbackResponse = await fetch(postUrl, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: formData
            });
          } catch {
            zapSuccessful = false;
          }
        }

        // Final fallback if everything fails
        if (zapSuccessful && (!callbackResponse || !callbackResponse.ok)) {
          // Try final fallback without the nostr parameter
          const fallbackUrl = `${lnurlData.callback}?amount=${amountMsats}`;
          
          try {
            const fallbackResponse = await fetch(fallbackUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
              },
            });

            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              if (fallbackData.pr && !fallbackData.status) {
                toast.warning("Payment will be sent but may not appear as a zap on Nostr");
                callbackResponse = fallbackResponse;
                zapSuccessful = false;
              }
            } else {
              throw new Error("Failed to create lightning invoice. The lightning service may be temporarily unavailable.");
            }
          } catch {
            throw new Error("Failed to create lightning invoice. The lightning service may be temporarily unavailable.");
          }
        }

        const invoiceData = await callbackResponse.json();

        if (invoiceData.status === "ERROR") {
          throw new Error(invoiceData.reason || "Failed to create lightning invoice");
        }

        if (!invoiceData.pr) {
          throw new Error("No lightning invoice received");
        }

        // Check for WebLN support
        if (!window.webln) {
          throw new Error(
            "Lightning wallet not found. Please install a WebLN-compatible wallet like Alby."
          );
        }

        // Enable WebLN
        try {
          await window.webln.enable();
        } catch {
          throw new Error("Failed to connect to lightning wallet. Please check your wallet permissions.");
        }

        // Send payment
        const paymentResult = await window.webln.sendPayment(invoiceData.pr);

        // Success - show success toast only if caller didn't opt to handle it themselves
        if (!options.skipSuccessToast) {
          if (zapSuccessful) {
            toast.success(`Successfully zapped ${options.amount} sats!`);
          } else {
            // Payment sent but not a proper zap
            toast.success(`Payment of ${options.amount} sats sent!`);
          }
        }
        
        return paymentResult;
      } catch (error) {
        throw error;
      }
    },
    [user]
  );

  return { zap };
}
