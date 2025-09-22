import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RSVPAvatarsProps {
  pubkeys: string[];
  maxVisible?: number;
}

export function RSVPAvatars({ pubkeys, maxVisible = 3 }: RSVPAvatarsProps) {
  const visiblePubkeys = pubkeys.slice(0, maxVisible);
  const remainingCount = Math.max(0, pubkeys.length - maxVisible);

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <div className="flex -space-x-1 sm:-space-x-2">
        {visiblePubkeys.map((pubkey) => (
          <RSVPAvatar key={pubkey} pubkey={pubkey} />
        ))}
      </div>
      {remainingCount > 0 && (
        <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
          +{remainingCount} {remainingCount === 1 ? "other" : "others"}
        </span>
      )}
    </div>
  );
}

function RSVPAvatar({ pubkey }: { pubkey: string }) {
  const { data: author } = useAuthor(pubkey);
  const displayName = author?.metadata?.name ?? genUserName(pubkey);
  const avatarUrl = author?.metadata?.picture;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className="h-6 w-6 sm:h-8 sm:w-8 border-2 border-background">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{displayName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
