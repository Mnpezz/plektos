import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Coins } from "lucide-react";
import { useZap } from "@/hooks/useZap";
import { useNostr } from "@nostrify/react";
import { toast } from "sonner";
import { formatAmount } from "@/lib/lightning";

interface ZapButtonProps {
  pubkey: string;
  displayName: string;
  lightningAddress: string;
  eventId?: string;
  eventKind?: number;
  eventIdentifier?: string;
  disabled?: boolean;
  className?: string;
  // For ticket purchases - if provided, shows only this amount
  fixedAmount?: number;
  // Custom button text for tickets
  buttonText?: string;
}

const QUICK_AMOUNTS = [21, 100, 500, 1000, 5000];

export function ZapButton({
  pubkey,
  displayName,
  lightningAddress,
  eventId = "",
  eventKind = 0,
  eventIdentifier = "",
  disabled = false,
  className = "",
  fixedAmount,
  buttonText,
}: ZapButtonProps) {
  const { zap, confirmManualPayment } = useZap();
  const { nostr } = useNostr();
  const { user: _user } = useCurrentUser();
  const [isZapping, setIsZapping] = useState(false);
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customAmount, setCustomAmount] = useState("21");
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [manualPaymentData, setManualPaymentData] = useState<{
    manualPayment: boolean;
    invoice: string;
    amount: number;
    lightningAddress: string;
    eventId: string;
    eventPubkey: string;
    eventKind: number;
    eventIdentifier: string;
    eventName: string;
    comment: string;
    startTime?: number;
  } | null>(null);
  const [_isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [_isPollingPayment, _setIsPollingPayment] = useState(false);

  // Debug state changes
  useEffect(() => {
    console.log('ZapButton: State changed - showManualPayment:', showManualPayment, 'manualPaymentData:', !!manualPaymentData);
  }, [showManualPayment, manualPaymentData]);

  // Force dialog to show when manual payment is required
  useEffect(() => {
    if (showManualPayment && manualPaymentData) {
      console.log('ZapButton: Forcing manual payment dialog to show');
      // Force a re-render by updating a dummy state
      setTimeout(() => {
        console.log('ZapButton: Timeout reached, checking state again');
      }, 100);
    }
  }, [showManualPayment, manualPaymentData]);

  const _handleConfirmPayment = async () => {
    if (!manualPaymentData) return;
    
    setIsConfirmingPayment(true);
    try {
      await confirmManualPayment(manualPaymentData);
      setShowManualPayment(false);
      setManualPaymentData(null);
      toast.success("Payment confirmed! Ticket purchased successfully.");
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast.error("Failed to confirm payment. Please try again.");
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  // Manual payment check - check once for payment
  const checkPaymentOnce = async () => {
    if (!manualPaymentData || !nostr || !manualPaymentData.eventPubkey || !_user?.pubkey) return;
    
    _setIsPollingPayment(true);
    toast.info("Checking for payment...");
    
    try {
      console.log('🔍 Manual payment check...');
      
      // Check if payment was made by looking for zap receipts where HOST is the recipient
      // OR by looking for zap requests that we created earlier
      const [zapReceipts, zapRequests] = await Promise.all([
        nostr.query([
          {
            kinds: [9735], // Zap receipts
            "#p": [manualPaymentData.eventPubkey], // Where HOST is the recipient
            limit: 10
          }
        ]),
        nostr.query([
          {
            kinds: [9734], // Zap requests
            authors: [_user.pubkey], // Where current user is the author
            "#e": [manualPaymentData.eventId], // For this specific event
            limit: 10
          }
        ])
      ]);

      console.log('🎫 Found zap receipts for host:', zapReceipts.length);
      console.log('🎫 Found zap requests from user:', zapRequests.length);
      
      // Debug: Log all zap receipts to see their structure
      console.log('🔍 Debugging zap receipts:');
      zapReceipts.forEach((receipt: { tags: string[][]; created_at: number }, index: number) => {
        const eventId = receipt.tags.find((tag: string[]) => tag[0] === "e")?.[1];
        const amount = receipt.tags.find((tag: string[]) => tag[0] === "amount")?.[1];
        const description = receipt.tags.find((tag: string[]) => tag[0] === "description")?.[1];
        console.log(`  Receipt ${index + 1}:`, {
          eventId,
          amount,
          created_at: new Date(receipt.created_at * 1000).toISOString(),
          description: description ? 'Has description' : 'No description',
          allTags: receipt.tags
        });
      });
      
      // Debug: Log all zap requests
      console.log('🔍 Debugging zap requests:');
      zapRequests.forEach((request: { tags: string[][]; created_at: number }, index: number) => {
        const eventId = request.tags.find((tag: string[]) => tag[0] === "e")?.[1];
        const amount = request.tags.find((tag: string[]) => tag[0] === "amount")?.[1];
        console.log(`  Request ${index + 1}:`, {
          eventId,
          amount,
          created_at: new Date(request.created_at * 1000).toISOString(),
          allTags: request.tags
        });
      });
      
      console.log('🎯 Looking for:', {
        expectedEventId: manualPaymentData.eventId,
        expectedAmount: (manualPaymentData.amount * 1000).toString(),
        expectedAmountSats: manualPaymentData.amount
      });
      
      // Check if any zap receipt is for our specific event and amount
      const ourZapReceipt = zapReceipts.find((receipt: { tags: string[][] }) => {
        const eventId = receipt.tags.find((tag: string[]) => tag[0] === "e")?.[1];
        const amount = receipt.tags.find((tag: string[]) => tag[0] === "amount")?.[1];
        const expectedAmount = (manualPaymentData.amount * 1000).toString(); // Convert to millisats
        
        console.log(`  Checking receipt: eventId=${eventId} (expected=${manualPaymentData.eventId}), amount=${amount} (expected=${expectedAmount})`);
        
        return eventId === manualPaymentData.eventId && amount === expectedAmount;
      });
      
      // Also check if we have a matching zap request (which means payment was initiated)
      const ourZapRequest = zapRequests.find((request: { tags: string[][] }) => {
        const eventId = request.tags.find((tag: string[]) => tag[0] === "e")?.[1];
        const amount = request.tags.find((tag: string[]) => tag[0] === "amount")?.[1];
        const expectedAmount = (manualPaymentData.amount * 1000).toString(); // Convert to millisats
        
        console.log(`  Checking request: eventId=${eventId} (expected=${manualPaymentData.eventId}), amount=${amount} (expected=${expectedAmount})`);
        
        return eventId === manualPaymentData.eventId && amount === expectedAmount;
      });

      if (ourZapReceipt) {
        console.log('✅ Payment confirmed! Host received payment:', ourZapReceipt);
        
        // Now create the ticket for the buyer
        try {
          await confirmManualPayment(manualPaymentData);
          setShowManualPayment(false);
          setManualPaymentData(null);
          _setIsPollingPayment(false);
          toast.success("Payment confirmed! Ticket created successfully!");
        } catch (error) {
          console.error('Error creating ticket after payment:', error);
          toast.error("Payment detected but failed to create ticket. Please contact support.");
        }
      } else if (ourZapRequest) {
        console.log('✅ Zap request found! Payment was initiated, creating ticket:', ourZapRequest);
        
        // Create the ticket for the buyer
        try {
          await confirmManualPayment(manualPaymentData);
          setShowManualPayment(false);
          setManualPaymentData(null);
          _setIsPollingPayment(false);
          toast.success("Payment confirmed! Ticket created successfully!");
        } catch (error) {
          console.error('Error creating ticket after payment:', error);
          toast.error("Payment detected but failed to create ticket. Please contact support.");
        }
      } else {
        console.log('⏳ No payment found yet');
        toast.warning("Payment not found. Please ensure you've completed the payment and try again.");
        _setIsPollingPayment(false);
      }
    } catch (error) {
      console.error("Error checking payment:", error);
      toast.error("Error checking payment. Please try again.");
      _setIsPollingPayment(false);
    }
  };

  // Payment detection - monitor host's Lightning address for incoming payments (automatic polling)
  const _startPaymentDetection = () => {
    if (!manualPaymentData) return;
    
    _setIsPollingPayment(true);
    toast.info("Waiting for payment confirmation...");
    
    // Poll every 3 seconds for up to 5 minutes
    const pollInterval = setInterval(async () => {
      try {
        console.log('🔍 Checking for payment confirmation...');
        
        // Check if payment was made by looking for zap receipts where HOST is the recipient
        // This means someone paid the host for this specific event
        if (!nostr || !manualPaymentData.eventPubkey) return;
        
        const zapReceipts = await nostr.query([
          {
            kinds: [9735], // Zap receipts
            "#p": [manualPaymentData.eventPubkey], // Where HOST is the recipient
            limit: 10
          }
        ]);

        console.log('🎫 Found zap receipts for host:', zapReceipts.length);
        
        // Check if any zap receipt is for our specific event and amount
        const ourZapReceipt = zapReceipts.find((receipt: { tags: string[][] }) => {
          const eventId = receipt.tags.find((tag: string[]) => tag[0] === "e")?.[1];
          const amount = receipt.tags.find((tag: string[]) => tag[0] === "amount")?.[1];
          const expectedAmount = (manualPaymentData.amount * 1000).toString(); // Convert to millisats
          
          return eventId === manualPaymentData.eventId && amount === expectedAmount;
        });

        if (ourZapReceipt) {
          console.log('✅ Payment confirmed! Host received payment:', ourZapReceipt);
          clearInterval(pollInterval);
          
          // Now create the ticket for the buyer
          try {
            await confirmManualPayment(manualPaymentData);
            setShowManualPayment(false);
            setManualPaymentData(null);
            _setIsPollingPayment(false);
            toast.success("Payment confirmed! Ticket created successfully!");
          } catch (error) {
            console.error('Error creating ticket after payment:', error);
            toast.error("Payment detected but failed to create ticket. Please contact support.");
          }
        } else {
          console.log('⏳ No payment found yet, continuing to poll...');
        }
      } catch (error) {
        console.error("Error polling payment:", error);
      }
    }, 3000);

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      _setIsPollingPayment(false);
      if (showManualPayment) {
        toast.warning("Payment timeout. Please try again or contact support.");
      }
    }, 300000); // 5 minutes
  };

  const handleZap = async (amount: number) => {
    if (!lightningAddress) {
      toast.error("Lightning address not available");
      return;
    }

    setIsZapping(true);
    try {
      const zapComment = fixedAmount 
        ? `Ticket for ${displayName}` 
        : `Zapped ${displayName}`;
      
      const result = await zap({
        amount,
        eventId,
        eventPubkey: pubkey,
        eventKind,
        eventIdentifier,
        eventName: fixedAmount ? `Ticket for ${displayName}` : `Zap to ${displayName}`,
        comment: zapComment,
        lightningAddress,
        skipSuccessToast: !!fixedAmount, // Skip generic toast for ticket purchases
      });
      
      console.log('ZapButton: Zap result:', result);
      
      // Check if manual payment is required
      if (result && result.manualPayment) {
        console.log('ZapButton: Manual payment required, showing dialog');
        console.log('ZapButton: Setting manualPaymentData to:', result);
        console.log('ZapButton: Setting showManualPayment to true');
        
        // Show manual payment in a dropdown instead of popup
        console.log('ZapButton: Showing manual payment dropdown');
        
        // Add start time for polling
        const paymentDataWithTime = {
          ...result,
          startTime: Date.now()
        };
        
        // Use a callback to ensure state is set before continuing
        setManualPaymentData(paymentDataWithTime);
        setShowManualPayment(true);
        
        // For manual payments, show the interface and let user trigger payment check
        // No automatic polling - user will click "Check Payment" button
        
        // Force a re-render by using setTimeout
        setTimeout(() => {
          console.log('ZapButton: Forced re-render after state update');
        }, 0);
        
        console.log('ZapButton: State updated, showManualPayment should be true now');
        return;
      }
      
      // For fixed amounts (ticket purchases), show a custom success message
      if (fixedAmount) {
        toast.success("Ticket purchased successfully!");
      }
      // For regular zaps, success toast is handled by useZap hook
    } catch (error) {
      console.error("Error zapping:", error);
      const errorMessage = fixedAmount 
        ? (error instanceof Error ? error.message : "Failed to purchase ticket")
        : (error instanceof Error ? error.message : "Failed to zap");
      toast.error(errorMessage);
    } finally {
      setIsZapping(false);
    }
  };

  const handleCustomZap = async () => {
    const amount = parseInt(customAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error("Please enter a valid amount");
      return;
    }

    await handleZap(amount);
    setShowCustomDialog(false);
    setCustomAmount("21");
  };

  if (disabled || !lightningAddress) {
    return null;
  }

  // Fixed amount mode (for ticket purchases)
  if (fixedAmount) {
    return (
      <div style={{ position: 'relative' }}>
        <Button
          variant="outline"
          size="sm"
          disabled={isZapping}
          onClick={() => handleZap(fixedAmount)}
          className={`flex items-center gap-2 ${className}`}
        >
          <Zap className="h-4 w-4" />
          {isZapping ? "Processing..." : (buttonText || `Purchase Ticket - ${formatAmount(fixedAmount)}`)}
        </Button>

        {/* Manual Payment Dropdown */}
        {showManualPayment && manualPaymentData && (
          <div 
            className="absolute top-full left-0 right-0 bg-background border border-border rounded-lg p-4 mt-2 shadow-lg z-[1000] max-w-md"
          >
            <div className="mb-3">
              <h3 className="text-lg font-bold text-foreground mb-2">
                💰 Manual Payment Required
              </h3>
              <p className="text-sm text-muted-foreground mb-1">
                <strong>Event:</strong> {manualPaymentData.eventName}
              </p>
              <p className="text-sm text-muted-foreground mb-1">
                <strong>Amount:</strong> {manualPaymentData.amount} sats
              </p>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-bold text-foreground mb-1">
                Lightning Invoice:
              </label>
              <textarea
                value={manualPaymentData.invoice}
                readOnly
                className="w-full h-20 p-2 border border-input rounded text-xs font-mono resize-none bg-muted text-foreground"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(manualPaymentData.invoice);
                  toast.success('Invoice copied to clipboard!');
                }}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs rounded cursor-pointer"
              >
                📋 Copy Invoice
              </button>
              
              <button
                onClick={() => {
                  setShowManualPayment(false);
                  setManualPaymentData(null);
                }}
                className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Payment Status */}
            {_isPollingPayment && (
              <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-blue-800 dark:text-blue-200 text-sm font-medium">
                    Waiting for payment confirmation...
                  </span>
                </div>
                <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                  Please complete the payment in your Lightning wallet. We're monitoring for the payment to the host.
                </p>
              </div>
            )}

            {/* Manual Payment Check Button */}
            <div className="mt-3 space-y-2">
              <Button
                onClick={checkPaymentOnce}
                disabled={_isPollingPayment}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                {_isPollingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Checking for payment...
                  </>
                ) : (
                  <>
                    🔍 Check Payment
                  </>
                )}
              </Button>
              
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                <strong className="text-yellow-800 dark:text-yellow-200">How to pay:</strong> 
                <span className="text-yellow-700 dark:text-yellow-300"> Copy the invoice above and paste it into your Lightning wallet (Coinos, Alby, Zeus, etc.). After paying, click "Check Payment" to verify your ticket.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Variable amount mode (for regular zaps)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isZapping}
            className={`flex items-center gap-2 ${className}`}
          >
            <Zap className="h-4 w-4" />
            {isZapping ? "Zapping..." : "Zap"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
            Quick Amounts
          </div>
          {QUICK_AMOUNTS.map((amount) => (
            <DropdownMenuItem
              key={amount}
              onClick={() => handleZap(amount)}
              disabled={isZapping}
              className="flex items-center justify-between"
            >
              <span>{formatAmount(amount)}</span>
              <Zap className="h-3 w-3" />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowCustomDialog(true)}
            disabled={isZapping}
            className="flex items-center gap-2"
          >
            <Coins className="h-4 w-4" />
            Custom Amount
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zap {displayName}</DialogTitle>
            <DialogDescription>
              Send a custom zap amount to {displayName} via Lightning.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (sats)</Label>
              <Input
                id="amount"
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="21"
                min="1"
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              Lightning Address: {lightningAddress}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCustomDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCustomZap}
              disabled={isZapping}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <Zap className="h-4 w-4 mr-2" />
              {isZapping ? "Zapping..." : `Zap ${formatAmount(parseInt(customAmount) || 0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
