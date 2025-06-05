import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  const { zap } = useZap();
  const [isZapping, setIsZapping] = useState(false);
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customAmount, setCustomAmount] = useState("21");

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
      
      await zap({
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