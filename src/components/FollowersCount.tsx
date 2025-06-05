import { useFollowList } from "@/hooks/useFollowList";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface FollowersCountProps {
  className?: string;
  showIcon?: boolean;
}

export function FollowersCount({ className = "", showIcon = true }: FollowersCountProps) {
  const { user } = useCurrentUser();
  const { followCount, isLoading } = useFollowList();

  if (!user || isLoading) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {showIcon && (
        <span className="text-muted-foreground">👥</span>
      )}
      <span className="text-sm text-muted-foreground">
        Following {followCount} {followCount === 1 ? 'person' : 'people'}
      </span>
    </div>
  );
}