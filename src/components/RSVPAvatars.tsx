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
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {visiblePubkeys.map((pubkey) => (
          <RSVPAvatar key={pubkey} pubkey={pubkey} />
        ))}
      </div>
      {remainingCount > 0 && (
        <span className="text-sm text-muted-foreground">
          and {remainingCount} {remainingCount === 1 ? "other" : "others"}
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
          <Avatar className="h-8 w-8 border-2 border-background">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback>
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>
          <p>{displayName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
