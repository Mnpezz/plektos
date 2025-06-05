import { useParams } from "react-router-dom";
import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { createEventIdentifier } from "@/lib/nip19Utils";
import { nip19 } from "nostr-tools";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { UserActionsMenu } from "@/components/UserActionsMenu";
import { ZappableLightningAddress } from "@/components/ZappableLightningAddress";
import { ExternalLink } from "lucide-react";
import type {
  DateBasedEvent,
  TimeBasedEvent,
  EventRSVP,
} from "@/lib/eventTypes";
import { useState, useEffect } from "react";

export function Profile() {
  const { npub } = useParams<{ npub: string }>();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [pubkey, setPubkey] = useState<string | undefined>(undefined);

  // Initialize all hooks at the top
  const author = useAuthor(pubkey);
  const { data: createdEvents = [], isLoading: isLoadingCreated } = useQuery({
    queryKey: ["createdEvents", pubkey],
    queryFn: async () => {
      if (!pubkey) return [];
      const events = await nostr.query([
        { kinds: [31922, 31923], authors: [pubkey] },
      ]);
      return events as unknown as (DateBasedEvent | TimeBasedEvent)[];
    },
    enabled: !!pubkey,
  });

  const { data: rsvps = [], isLoading: isLoadingRSVPs } = useQuery({
    queryKey: ["rsvps", pubkey],
    queryFn: async () => {
      if (!pubkey) return [];
      const events = await nostr.query([{ kinds: [31925], authors: [pubkey] }]);
      return events as unknown as EventRSVP[];
    },
    enabled: !!pubkey,
  });

  // Fetch the actual events that were RSVP'd to
  const { data: rsvpEvents = [], isLoading: isLoadingRsvpEvents } = useQuery({
    queryKey: ["rsvpEvents", rsvps],
    queryFn: async () => {
      if (!rsvps.length) return [];
      const eventIds = rsvps
        .map((rsvp) => rsvp.tags.find((tag) => tag[0] === "e")?.[1])
        .filter((id): id is string => id !== undefined);
      if (!eventIds.length) return [];
      const events = await nostr.query([
        { kinds: [31922, 31923], ids: eventIds },
      ]);
      return events as unknown as (DateBasedEvent | TimeBasedEvent)[];
    },
    enabled: !!rsvps.length,
  });

  // Decode npub to get pubkey
  useEffect(() => {
    try {
      if (npub) {
        const decoded = nip19.decode(npub);
        if (decoded.type === "npub") {
          setPubkey(decoded.data);
        }
      }
    } catch (error) {
      console.error("Error decoding npub:", error);
    }
  }, [npub]);

  const metadata = author.data?.metadata;
  const displayName =
    metadata?.name || metadata?.display_name || pubkey?.slice(0, 8) || "";
  const profileImage = metadata?.picture;
  const about = metadata?.about;
  const website = metadata?.website;
  const nip05 = metadata?.nip05;
  const lightningAddress = metadata?.lud16 || metadata?.lud06;

  const isOwnProfile = user?.pubkey === pubkey;

  if (!pubkey) {
    return <div>Profile not found</div>;
  }

  if (
    author.isLoading ||
    isLoadingCreated ||
    isLoadingRSVPs ||
    isLoadingRsvpEvents
  ) {
    return <div>Loading profile...</div>;
  }

  return (
    <div className="container max-w-4xl px-0 sm:px-4 py-2 sm:py-8 space-y-3 sm:space-y-6">
      <Card className="rounded-none sm:rounded-lg">
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                <AvatarImage src={profileImage} alt={displayName} />
                <AvatarFallback className="text-lg">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <CardTitle className="text-xl sm:text-2xl">{displayName}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {nip05 && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      ✓ {nip05}
                    </Badge>
                  )}
                  {lightningAddress && user && !isOwnProfile ? (
                    <ZappableLightningAddress
                      lightningAddress={lightningAddress}
                      pubkey={pubkey}
                      displayName={displayName}
                      eventKind={0}
                    />
                  ) : lightningAddress ? (
                    <Badge variant="outline" className="font-mono text-xs">
                      ⚡ {lightningAddress}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {user && !isOwnProfile && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <UserActionsMenu 
                  pubkey={pubkey} 
                  authorName={displayName}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-3 sm:space-y-6">
          {about && (
            <div>
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-muted-foreground">{about}</p>
            </div>
          )}

          {website && (
            <div>
              <h3 className="font-semibold mb-2">Website</h3>
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                {website}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-4">Created Events</h3>
            <div className="space-y-4">
              {createdEvents.length === 0 ? (
                <p className="text-muted-foreground">No events created yet</p>
              ) : (
                createdEvents.map((event) => {
                  const title =
                    event.tags.find((tag) => tag[0] === "title")?.[1] ||
                    "Untitled";
                  const eventIdentifier = createEventIdentifier(event);

                  return (
                    <Card key={event.id} className="rounded-none sm:rounded-lg">
                      <CardContent className="p-3 sm:p-6">
                        <Link
                          to={`/event/${eventIdentifier}`}
                          className="block hover:opacity-80 transition-opacity"
                        >
                          <h4 className="font-medium mb-2">{title}</h4>
                          <p className="text-muted-foreground text-sm">
                            {event.content}
                          </p>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">RSVP'd Events</h3>
            <div className="space-y-4">
              {rsvps.length === 0 ? (
                <p className="text-muted-foreground">No RSVPs yet</p>
              ) : (
                rsvps.map((rsvp) => {
                  const eventId = rsvp.tags.find((tag) => tag[0] === "e")?.[1];
                  const status = rsvp.tags.find(
                    (tag) => tag[0] === "status"
                  )?.[1];
                  const event = rsvpEvents.find((e) => e.id === eventId);

                  if (!eventId || !event) return null;

                  const title =
                    event.tags.find((tag) => tag[0] === "title")?.[1] ||
                    "Untitled";
                  const startTime = event.tags.find(
                    (tag) => tag[0] === "start"
                  )?.[1];
                  const eventIdentifier = createEventIdentifier(event);

                  return (
                    <Card key={rsvp.id} className="rounded-none sm:rounded-lg">
                      <CardContent className="p-3 sm:p-6">
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            variant="outline"
                            className={
                              status === "accepted"
                                ? "bg-green-500/10 text-green-500"
                                : status === "tentative"
                                ? "bg-yellow-500/10 text-yellow-500"
                                : "bg-red-500/10 text-red-500"
                            }
                          >
                            {status === "accepted"
                              ? "Going"
                              : status === "tentative"
                              ? "Maybe"
                              : "Can't Go"}
                          </Badge>
                        </div>
                        <Link
                          to={`/event/${eventIdentifier}`}
                          className="block hover:opacity-80 transition-opacity"
                        >
                          <h4 className="font-medium mb-2">{title}</h4>
                          {startTime && (
                            <p className="text-muted-foreground text-sm">
                              {event.kind === 31922
                                ? (() => {
                                    // For date-only events, format the YYYY-MM-DD date string
                                    const date = new Date(startTime + "T00:00:00Z");
                                    return date.toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                      timeZone: "UTC",
                                    });
                                  })()
                                : (() => {
                                    // For time-based events, format the Unix timestamp
                                    const date = new Date(parseInt(startTime) * 1000);
                                    return date.toLocaleString(undefined, {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "numeric",
                                      timeZone: "UTC",
                                    });
                                  })()}
                            </p>
                          )}
                          <p className="text-muted-foreground text-sm mt-2">
                            {event.content}
                          </p>
                        </Link>
                        {rsvp.content && (
                          <p className="text-muted-foreground text-sm mt-2">
                            Your note: {rsvp.content}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
