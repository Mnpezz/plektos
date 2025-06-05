import { useState, forwardRef } from "react";
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
import { Button } from "@/components/ui/button";
import { Zap, Coins } from "lucide-react";
import { useZap } from "@/hooks/useZap";
import { toast } from "sonner";
import { formatAmount } from "@/lib/lightning";
import { cn } from "@/lib/utils";

interface ZappableLightningAddressProps {
  lightningAddress: string;
  pubkey: string;
  displayName: string;
  eventId?: string;
  eventKind?: number;
  eventIdentifier?: string;
  className?: string;
}

const QUICK_AMOUNTS = [21, 100, 500, 1000, 5000];

// Create a clickable badge component that forwards refs properly
const ClickableBadge = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
  }
>(({ className, onClick, children, ...props }, ref) => (
  <button
    ref={ref}
    onClick={onClick}
    className={cn(
      // Badge styles
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      // Outline variant styles  
      "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      // Interactive styles
      "font-mono cursor-pointer hover:bg-yellow-50 hover:border-yellow-300 dark:hover:bg-yellow-950 dark:hover:border-yellow-700 transition-colors",
      className
    )}
    {...props}
  >
    {children}
  </button>
));

ClickableBadge.displayName = "ClickableBadge";

export function ZappableLightningAddress({
  lightningAddress,
  pubkey,
  displayName,
  eventId = "",
  eventKind = 0,
  eventIdentifier = "",
  className = "",
}: ZappableLightningAddressProps) {
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
      await zap({
        amount,
        eventId,
        eventPubkey: pubkey,
        eventKind,
        eventIdentifier,
        eventName: `Zap to ${displayName}`,
        comment: `Zapped ${displayName}`,
        lightningAddress,
      });
      
      // Success toast is now handled by useZap hook
    } catch (error) {
      console.error("Error zapping:", error);
      toast.error(error instanceof Error ? error.message : "Failed to zap");
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

  if (!lightningAddress) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ClickableBadge 
            className={cn(
              isZapping && "opacity-50 cursor-not-allowed",
              className
            )}
          >
            ⚡ {lightningAddress}
          </ClickableBadge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
            Quick Zap Amounts
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