import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useEvents } from "@/lib/eventUtils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/lightning";
import { ReminderPanel } from "@/components/ReminderPanel";
import { toast } from "sonner";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Share2 } from "lucide-react";
import { RSVPAvatars } from "@/components/RSVPAvatars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type {
  DateBasedEvent,
  TimeBasedEvent,
  EventRSVP,
} from "@/lib/eventTypes";
import { nip19 } from "nostr-tools";
import { useQueryClient } from "@tanstack/react-query";
import { DeleteEvent } from "@/components/DeleteEvent";
import { useZap } from "@/hooks/useZap";
import { ZapReceipts } from "@/components/ZapReceipts";

function getStatusColor(status: string) {
  switch (status) {
    case "accepted":
      return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
    case "tentative":
      return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20";
    case "declined":
      return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
    default:
      return "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "accepted":
      return "Going";
    case "tentative":
      return "Maybe";
    case "declined":
      return "Can't Go";
    default:
      return status;
  }
}

function EventAuthor({ pubkey }: { pubkey: string }) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const displayName =
    metadata?.name || metadata?.display_name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;

  // Create npub address for the profile link
  const npub = nip19.npubEncode(pubkey);

  return (
    <Link
      to={`/profile/${npub}`}
      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
    >
      <Avatar className="h-6 w-6">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback>{displayName.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <span className="text-sm text-muted-foreground">
        Created by {displayName}
      </span>
    </Link>
  );
}

export function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: events, isLoading } = useEvents();
  const { user } = useCurrentUser();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const { mutate: publishRSVP } = useNostrPublish();
  const { mutate: publishShare } = useNostrPublish();
  const [rsvpStatus, setRsvpStatus] = useState<
    "accepted" | "declined" | "tentative"
  >("accepted");
  const [rsvpNote, setRsvpNote] = useState("");
  const [isSubmittingRSVP, setIsSubmittingRSVP] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { zap } = useZap();

  // Decode the nevent address
  let eventIdFromNevent: string | undefined;
  try {
    if (eventId?.startsWith("nevent")) {
      const decoded = nip19.decode(eventId);
      if (decoded.type === "nevent") {
        eventIdFromNevent = decoded.data.id;
      }
    } else {
      eventIdFromNevent = eventId;
    }
  } catch (error) {
    console.error("Error decoding nevent:", error);
    return <div>Invalid event address</div>;
  }

  // Find the event and participants directly from the events array
  const event =
    (events.find((e) => e.id === eventIdFromNevent) as
      | DateBasedEvent
      | TimeBasedEvent
      | null) || null;

  if (isLoading) {
    return <div>Loading event...</div>;
  }

  if (!event) {
    return <div>Event not found.</div>;
  }

  // Filter RSVP events first
  const rsvpEvents = events
    .filter((e): e is EventRSVP => e.kind === 31925)
    .filter((e) =>
      e.tags.some((tag) => tag[0] === "e" && tag[1] === eventIdFromNevent)
    );

  // Get most recent RSVP for each user
  const latestRSVPs = rsvpEvents.reduce((acc, curr) => {
    const existingRSVP = acc.find((e) => e.pubkey === curr.pubkey);
    if (!existingRSVP || curr.created_at > existingRSVP.created_at) {
      // Remove any existing RSVP for this user
      const filtered = acc.filter((e) => e.pubkey !== curr.pubkey);
      return [...filtered, curr];
    }
    return acc;
  }, [] as EventRSVP[]);

  // Group RSVPs by status
  const acceptedRSVPs = latestRSVPs.filter(
    (e) => e.tags.find((tag) => tag[0] === "status")?.[1] === "accepted"
  );

  const tentativeRSVPs = latestRSVPs.filter(
    (e) => e.tags.find((tag) => tag[0] === "status")?.[1] === "tentative"
  );

  const declinedRSVPs = latestRSVPs.filter(
    (e) => e.tags.find((tag) => tag[0] === "status")?.[1] === "declined"
  );

  const participants = latestRSVPs.map((e) => e.pubkey);

  const price = event.tags.find((tag) => tag[0] === "price")?.[1];
  const lightningAddress = event.tags.find((tag) => tag[0] === "lud16")?.[1];
  const isPaidEvent = price && lightningAddress;
  const isHost = user?.pubkey === event.pubkey;
  const imageUrl = event.tags.find((tag) => tag[0] === "image")?.[1];
  const eventIdentifier = event.tags.find((tag) => tag[0] === "d")?.[1];

  const handlePurchaseTicket = async () => {
    if (!event || !isPaidEvent) return;

    try {
      setIsProcessingPayment(true);
      await zap({
        amount: parseInt(price),
        eventId: event.id,
        eventPubkey: event.pubkey,
        eventKind: event.kind,
        eventIdentifier: eventIdentifier,
        eventName: event.tags.find((tag) => tag[0] === "title")?.[1] || "Event",
        comment: `Ticket for ${
          event.tags.find((tag) => tag[0] === "title")?.[1] || "event"
        }`,
        lightningAddress: lightningAddress,
      });
      await queryClient.invalidateQueries({ queryKey: ["event", event.id] });
    } catch (error) {
      console.error("Error purchasing ticket:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to purchase ticket"
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleRSVP = async () => {
    if (!user || !eventIdentifier) return;

    setIsSubmittingRSVP(true);
    try {
      const tags = [
        ["e", event.id],
        ["a", `${event.kind}:${event.pubkey}:${eventIdentifier}`],
        ["d", Math.random().toString(36).substring(2)],
        ["status", rsvpStatus],
        ["p", event.pubkey],
      ];

      await publishRSVP(
        {
          kind: 31925,
          content: rsvpNote,
          tags,
        },
        {
          onSuccess: () => {
            toast.success("RSVP submitted successfully!");
            setRsvpNote("");
            // Invalidate and refetch events
            queryClient.invalidateQueries({ queryKey: ["events"] });
          },
        }
      );
    } catch (error) {
      toast.error("Failed to submit RSVP");
      console.error("Error submitting RSVP:", error);
    } finally {
      setIsSubmittingRSVP(false);
    }
  };

  // Find user's current RSVP status
  const userRSVP = rsvpEvents.find((e) => e.pubkey === user?.pubkey);
  const currentStatus = userRSVP?.tags.find(
    (tag) => tag[0] === "status"
  )?.[1] as "accepted" | "declined" | "tentative" | undefined;
  const currentNote = userRSVP?.content;

  const handleShareEvent = async () => {
    if (!user || !event) return;

    setIsSharing(true);
    try {
      const title =
        event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled Event";
      const location = event.tags.find((tag) => tag[0] === "location")?.[1];
      const startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
      const imageUrl = event.tags.find((tag) => tag[0] === "image")?.[1];

      // Create nevent address
      const nevent = nip19.neventEncode({
        id: event.id,
        kind: event.kind,
        author: event.pubkey,
      });

      // Construct the share message
      let shareMessage = `🎉 Join me at ${title}!\n\n`;

      if (startTime) {
        const date = new Date(parseInt(startTime) * 1000);
        shareMessage += `📅 ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}\n`;
      }

      if (location) {
        shareMessage += `📍 ${location}\n`;
      }

      shareMessage += `\n${event.content}\n\n`;
      shareMessage += `🔗 https://plektos.app/event/${nevent}`;

      // Add image if available
      const tags: [string, string][] = [];
      if (imageUrl) {
        tags.push(["image", imageUrl]);
      }

      await publishShare({
        kind: 1,
        content: shareMessage,
        tags,
      });

      toast.success("Event shared successfully!");
    } catch (error) {
      toast.error("Failed to share event");
      console.error("Error sharing event:", error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="container max-w-4xl px-2 sm:px-4 py-4 sm:py-8">
      <Card>
        {imageUrl && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={imageUrl}
              alt={
                event.tags.find((tag) => tag[0] === "title")?.[1] ||
                "Event image"
              }
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <CardTitle>
                {event.tags.find((tag) => tag[0] === "title")?.[1]}
              </CardTitle>
              <EventAuthor pubkey={event.pubkey} />
            </div>
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareEvent}
                disabled={isSharing}
                className="flex items-center gap-2 self-start sm:self-auto"
              >
                <Share2 className="h-4 w-4" />
                {isSharing ? "Sharing..." : "Share Event"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">Description</h3>
            <p className="text-muted-foreground">{event.content}</p>
          </div>

          <div>
            <h3 className="font-semibold">Location</h3>
            <p className="text-muted-foreground">
              {event.tags.find((tag) => tag[0] === "location")?.[1]}
            </p>
          </div>

          <div>
            <h3 className="font-semibold">Date & Time</h3>
            <p className="text-muted-foreground">
              {event.kind === 31922 ? (
                // For date-only events, show as all-day event
                new Date(
                  parseInt(
                    event.tags.find((tag) => tag[0] === "start")?.[1] || "0"
                  ) * 1000
                ).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                })
              ) : (
                // For time-based events, show start and end times
                <>
                  {new Date(
                    parseInt(
                      event.tags.find((tag) => tag[0] === "start")?.[1] || "0"
                    ) * 1000
                  ).toLocaleString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    timeZone: "UTC",
                  })}
                  {" - "}
                  {new Date(
                    parseInt(
                      event.tags.find((tag) => tag[0] === "end")?.[1] || "0"
                    ) * 1000
                  ).toLocaleString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    timeZone: "UTC",
                  })}
                </>
              )}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Attendees</h3>
            <div className="space-y-4">
              {acceptedRSVPs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className="bg-green-500/10 text-green-500"
                    >
                      Going
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {acceptedRSVPs.length}{" "}
                      {acceptedRSVPs.length === 1 ? "person" : "people"}
                    </span>
                  </div>
                  <RSVPAvatars pubkeys={acceptedRSVPs.map((e) => e.pubkey)} />
                </div>
              )}
              {tentativeRSVPs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className="bg-yellow-500/10 text-yellow-500"
                    >
                      Maybe
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {tentativeRSVPs.length}{" "}
                      {tentativeRSVPs.length === 1 ? "person" : "people"}
                    </span>
                  </div>
                  <RSVPAvatars pubkeys={tentativeRSVPs.map((e) => e.pubkey)} />
                </div>
              )}
              {declinedRSVPs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className="bg-red-500/10 text-red-500"
                    >
                      Can't Go
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {declinedRSVPs.length}{" "}
                      {declinedRSVPs.length === 1 ? "person" : "people"}
                    </span>
                  </div>
                  <RSVPAvatars pubkeys={declinedRSVPs.map((e) => e.pubkey)} />
                </div>
              )}
            </div>
          </div>

          {user && !isHost && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">RSVP</h3>
                {currentStatus && (
                  <Badge
                    variant="outline"
                    className={getStatusColor(currentStatus)}
                  >
                    {getStatusLabel(currentStatus)}
                  </Badge>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {currentStatus ? "Change Status" : "Select Status"}
                  </label>
                  <Select
                    value={currentStatus || rsvpStatus}
                    onValueChange={(
                      value: "accepted" | "declined" | "tentative"
                    ) => setRsvpStatus(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select your status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accepted">I'm going</SelectItem>
                      <SelectItem value="tentative">Maybe</SelectItem>
                      <SelectItem value="declined">Can't go</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {currentNote ? "Update Note" : "Add Note (Optional)"}
                  </label>
                  <Textarea
                    placeholder="Add a note to your RSVP..."
                    value={rsvpNote}
                    onChange={(e) => setRsvpNote(e.target.value)}
                    className="min-h-[100px]"
                  />
                  {currentNote && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Current note: {currentNote}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleRSVP}
                  disabled={isSubmittingRSVP}
                  className="w-full"
                >
                  {isSubmittingRSVP
                    ? "Submitting..."
                    : currentStatus
                    ? "Update RSVP"
                    : "Submit RSVP"}
                </Button>
              </div>
            </div>
          )}

          {isPaidEvent && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Ticket Information</h3>
              <p className="text-muted-foreground mb-4">
                Price: {formatAmount(parseInt(price))}
              </p>
              {user ? (
                <Button
                  onClick={handlePurchaseTicket}
                  disabled={isProcessingPayment}
                >
                  {isProcessingPayment ? "Processing..." : "Purchase Ticket"}
                </Button>
              ) : (
                <p className="text-muted-foreground">
                  Please log in to purchase a ticket
                </p>
              )}
            </div>
          )}

          {isHost && (
            <ReminderPanel
              event={event}
              isHost={isHost}
              participants={participants}
            />
          )}

          {event && (
            <div className="mt-8">
              <ZapReceipts eventId={event.id} eventPubkey={event.pubkey} />
            </div>
          )}
        </CardContent>
      </Card>
      {user && user.pubkey === event.pubkey && (
        <div className="mt-4">
          <DeleteEvent
            eventId={event.id}
            eventKind={event.kind}
            onDeleted={() => navigate("/")}
          />
        </div>
      )}
    </div>
  );
}
