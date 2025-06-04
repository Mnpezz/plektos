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
          throw new Error("No signer available");
        }

        // Convert lightning address to LNURL
        const lnurl = lightningAddressToLnurl(options.lightningAddress);
        const [username, domain] = options.lightningAddress.split("@");

        // Fetch LNURL data from the user's server
        const lnurlResponse = await fetch(
          `https://${domain}/.well-known/lnurlp/${username}`
        );
        if (!lnurlResponse.ok) {
          throw new Error("Failed to fetch LNURL data");
        }

        const lnurlData = await lnurlResponse.json();
        if (lnurlData.status === "ERROR") {
          throw new Error(lnurlData.reason || "Failed to get invoice");
        }

        // Create zap request event following NIP-57 requirements
        const zapRequest = {
          kind: 9734,
          content: options.comment || "Zap!",
          tags: [
            // Required: relays tag for zap receipt
            ["relays", "wss://relay.damus.io", "wss://nostr-relay.wlvs.space"],
            // Required: amount tag matching the amount parameter
            ["amount", (options.amount * 1000).toString()],
            // Required: lnurl tag
            ["lnurl", lnurl],
            // Required: exactly one p tag
            ["p", options.eventPubkey],
            // Optional: e tag (only if zapping an event)
            ["e", options.eventId],
          ],
          created_at: Math.floor(Date.now() / 1000),
          pubkey: user.pubkey,
        };

        // Create the invoice using the LNURL callback
        const callbackUrl = `${lnurlData.callback}?amount=${
          options.amount * 1000
        }&nostr=${JSON.stringify(zapRequest)}`;
        console.log("Calling LNURL callback:", callbackUrl);

        const callbackResponse = await fetch(callbackUrl);

        if (!callbackResponse.ok) {
          console.error(
            "LNURL callback failed:",
            await callbackResponse.text()
          );
          throw new Error("Failed to create invoice");
        }

        const invoiceData = await callbackResponse.json();
        console.log("LNURL callback response:", invoiceData);

        if (invoiceData.status === "ERROR") {
          throw new Error(invoiceData.reason || "Failed to create invoice");
        }

        // Get Alby provider
        if (!window.webln) {
          throw new Error(
            "Alby extension not found. Please install Alby to use this feature."
          );
        }
        await window.webln.enable();

        // Send payment
        await window.webln.sendPayment(invoiceData.pr);

        toast.success("Ticket purchased successfully!");
      } catch (error) {
        console.error("Error sending zap:", error);
        throw error;
      }
    },
    [user]
  );

  return { zap };
}
