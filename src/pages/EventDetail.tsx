import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useEvents, useSingleEvent } from "@/lib/eventUtils";
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
import { Share2, Calendar } from "lucide-react";
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
import { EditEvent } from "@/components/EditEvent";
import { ZapButton } from "@/components/ZapButton";
import { ZapReceipts } from "@/components/ZapReceipts";
import { ContactOrganizerDialog } from "@/components/ContactOrganizerDialog";
import { EventComments } from "@/components/EventComments";
import { EventCategories } from "@/components/EventCategories";
import { downloadICS } from "@/lib/icsExport";
import { decodeEventIdentifier, createEventUrl } from "@/lib/nip19Utils";
import { UserActionsMenu } from "@/components/UserActionsMenu";
import { 
  getEventTimezone, 
  formatEventDateTime, 
  formatEventTime, 
  getTimezoneAbbreviation 
} from "@/lib/eventTimezone";

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
    <div className="flex items-center justify-between gap-2">
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
      <UserActionsMenu 
        pubkey={pubkey} 
        authorName={displayName}
      />
    </div>
  );
}

export function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: events, isLoading: isLoadingEvents, refetch: refetchEvents } = useEvents();
  const { data: singleEvent, isLoading: isLoadingSingleEvent } = useSingleEvent(eventId);
  const { user } = useCurrentUser();
  const { mutate: publishRSVP } = useNostrPublish();
  const { mutate: publishShare } = useNostrPublish();
  const [rsvpStatus, setRsvpStatus] = useState<
    "accepted" | "declined" | "tentative"
  >("accepted");
  const [rsvpNote, setRsvpNote] = useState("");
  const [isSubmittingRSVP, setIsSubmittingRSVP] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Determine overall loading state
  const isLoading = isLoadingEvents || isLoadingSingleEvent;

  // Enhanced event update handler with proper refresh
  const handleEventUpdated = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all related queries
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      await queryClient.invalidateQueries({ queryKey: ["event"] });
      await queryClient.invalidateQueries({ queryKey: ["comments"] });
      await queryClient.invalidateQueries({ queryKey: ["reactions"] });
      
      // Force a refetch of events
      await refetchEvents();
      
      toast.success("Event details refreshed!");
    } catch (error) {
      console.error("Error refreshing event data:", error);
      toast.error("Could not refresh event details");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Early return for loading states
  if (isLoading || isRefreshing) {
    return (
      <div className="container max-w-4xl px-0 sm:px-4 py-2 sm:py-8">
        <Card className="rounded-none sm:rounded-lg">
          <CardContent className="p-6">
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                <span>{isRefreshing ? "Refreshing event details..." : "Loading event..."}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Decode the event identifier (supports both naddr and nevent)
  let targetEvent: DateBasedEvent | TimeBasedEvent | null = null;
  let eventIdFromIdentifier: string | undefined;
  
  try {
    if (!eventId) {
      return (
        <div className="container max-w-4xl px-0 sm:px-4 py-2 sm:py-8">
          <Card className="rounded-none sm:rounded-lg">
            <CardContent className="p-6">
              <div className="text-center py-12">
                <p className="text-destructive">No event identifier provided</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    const decodedEvent = decodeEventIdentifier(eventId);
    
    if (decodedEvent.type === 'naddr') {
      // For replaceable events, find by coordinate (kind:pubkey:d)
      const { kind, pubkey, identifier } = decodedEvent.data;
      targetEvent = events?.find((e) => 
        e.kind === kind && 
        e.pubkey === pubkey && 
        e.tags.some(tag => tag[0] === 'd' && tag[1] === identifier)
      ) as DateBasedEvent | TimeBasedEvent | null;
      
      // If not found in events list, try the single event result
      if (!targetEvent && singleEvent) {
        targetEvent = singleEvent;
      }
      
      // Store the event ID for RSVP filtering
      eventIdFromIdentifier = targetEvent?.id;
    } else if (decodedEvent.type === 'nevent' || decodedEvent.type === 'note' || decodedEvent.type === 'raw') {
      // For regular events, find by event ID
      const eventId = decodedEvent.type === 'raw' ? decodedEvent.data : 
                     decodedEvent.type === 'note' ? decodedEvent.data :
                     decodedEvent.data.id;
      targetEvent = events?.find((e) => e.id === eventId) as DateBasedEvent | TimeBasedEvent | null;
      
      // If not found in events list, try the single event result
      if (!targetEvent && singleEvent) {
        targetEvent = singleEvent;
      }
      
      eventIdFromIdentifier = eventId;
    }
  } catch (error) {
    console.error("Error decoding event identifier:", error);
    return (
      <div className="container max-w-4xl px-0 sm:px-4 py-2 sm:py-8">
        <Card className="rounded-none sm:rounded-lg">
          <CardContent className="p-6">
            <div className="text-center py-12">
              <p className="text-destructive">Invalid event address</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const event = targetEvent;

  if (!event) {
    return (
      <div className="container max-w-4xl px-0 sm:px-4 py-2 sm:py-8">
        <Card className="rounded-none sm:rounded-lg">
          <CardContent className="p-6">
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-2">Event not found</h2>
              <p className="text-muted-foreground mb-6">
                The event you're looking for doesn't exist or may have been deleted.
              </p>
              <Button 
                variant="outline" 
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2"
              >
                <span>← Back to Events</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter RSVP events first
  const rsvpEvents = (events || [])
    .filter((e): e is EventRSVP => e.kind === 31925)
    .filter((e) =>
      e.tags.some((tag) => tag[0] === "e" && tag[1] === eventIdFromIdentifier)
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

      // Construct the share message
      let shareMessage = `🎉 Join me at ${title}!\n\n`;

      if (startTime) {
        const eventTimezone = getEventTimezone(event);
        const timezoneAbbr = getTimezoneAbbreviation(eventTimezone, new Date(parseInt(startTime) * 1000).getTime());
        
        if (event.kind === 31922) {
          // For date-only events, format in event's timezone
          let date;
          if (startTime.match(/^\d{10}$/)) {
            date = new Date(parseInt(startTime) * 1000);
          } else if (startTime.match(/^\d{13}$/)) {
            date = new Date(parseInt(startTime));
          } else {
            const [year, month, day] = startTime.split('-').map(Number);
            date = new Date(year, month - 1, day);
          }
          
          shareMessage += `📅 ${formatEventDateTime(date.getTime(), eventTimezone)}${timezoneAbbr}\n`;
        } else {
          // For time-based events, format in event's timezone
          const startDate = new Date(parseInt(startTime) * 1000);
          const endTime = event.tags.find((tag) => tag[0] === "end")?.[1];
          
          if (endTime) {
            const endDate = new Date(parseInt(endTime) * 1000);
            const startDateTime = formatEventDateTime(startDate.getTime(), eventTimezone, {
              hour: "numeric",
              minute: "numeric",
            });
            const endTimeOnly = formatEventTime(endDate.getTime(), eventTimezone);
            shareMessage += `📅 ${startDateTime} - ${endTimeOnly}${timezoneAbbr}\n`;
          } else {
            const startDateTime = formatEventDateTime(startDate.getTime(), eventTimezone, {
              hour: "numeric",
              minute: "numeric",
            });
            shareMessage += `📅 ${startDateTime}${timezoneAbbr}\n`;
          }
        }
      }

      if (location) {
        shareMessage += `📍 ${location}\n`;
      }

      shareMessage += `\n${event.content}\n\n`;
      
      // Create the appropriate identifier (naddr for replaceable events, nevent for regular events)
      shareMessage += `🔗 ${createEventUrl(event, 'https://plektos.app')}`;

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
    <div className="container max-w-4xl px-0 sm:px-4 py-2 sm:py-8">
      <Card className="rounded-none sm:rounded-lg">
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
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <CardTitle>
                {event.tags.find((tag) => tag[0] === "title")?.[1]}
              </CardTitle>
              <EventAuthor pubkey={event.pubkey} />
            </div>
            {user && (
              <div className="flex items-center gap-1 sm:gap-2 self-start sm:self-auto">
                <ContactOrganizerDialog
                  organizerPubkey={event.pubkey}
                  eventTitle={
                    event.tags.find((tag) => tag[0] === "title")?.[1] || "Event"
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadICS(event)}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3"
                >
                  <Calendar className="h-4 w-4" />
                  Calendar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareEvent}
                  disabled={isSharing}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3"
                >
                  <Share2 className="h-4 w-4" />
                  {isSharing ? "..." : "Share"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-3 sm:space-y-4">
          <div>
            <h3 className="font-semibold">Description</h3>
            <p className="text-muted-foreground">{event.content}</p>
          </div>

          <EventCategories
            categories={event.tags
              .filter((tag) => tag[0] === "t")
              .map((tag) => tag[1])}
          />

          <div>
            <h3 className="font-semibold">Location</h3>
            <p className="text-muted-foreground">
              {event.tags.find((tag) => tag[0] === "location")?.[1]}
            </p>
          </div>

          <div>
            <h3 className="font-semibold">Date & Time</h3>
            <p className="text-muted-foreground">
              {(() => {
                const startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
                const endTime = event.tags.find((tag) => tag[0] === "end")?.[1];
                const eventTimezone = getEventTimezone(event);

                if (!startTime) return "Date not specified";

                try {
                  if (event.kind === 31922) {
                    // For date-only events, handle all date formats in event's timezone
                    let startDate;
                    if (startTime.match(/^\d{10}$/)) {
                      startDate = new Date(parseInt(startTime) * 1000);
                    } else if (startTime.match(/^\d{13}$/)) {
                      startDate = new Date(parseInt(startTime));
                    } else {
                      // YYYY-MM-DD format
                      const [year, month, day] = startTime.split('-').map(Number);
                      if (isNaN(year) || isNaN(month) || isNaN(day)) {
                        throw new Error("Invalid date format");
                      }
                      startDate = new Date(year, month - 1, day);
                    }

                    if (isNaN(startDate.getTime())) {
                      console.error("Invalid start date:", startTime);
                      return "Invalid date";
                    }

                    if (endTime && endTime !== startTime) {
                      let endDate;
                      if (endTime.match(/^\d{10}$/)) {
                        endDate = new Date(parseInt(endTime) * 1000);
                      } else if (endTime.match(/^\d{13}$/)) {
                        endDate = new Date(parseInt(endTime));
                      } else {
                        const [endYear, endMonth, endDay] = endTime.split('-').map(Number);
                        if (!isNaN(endYear) && !isNaN(endMonth) && !isNaN(endDay)) {
                          endDate = new Date(endYear, endMonth - 1, endDay);
                        }
                      }

                      if (endDate && !isNaN(endDate.getTime())) {
                        // If start and end dates are the same, just show one date
                        if (startDate.toDateString() === endDate.toDateString()) {
                          return formatEventDateTime(startDate.getTime(), eventTimezone) + 
                                 getTimezoneAbbreviation(eventTimezone, startDate.getTime());
                        }

                        // Show date range
                        return `${formatEventDateTime(startDate.getTime(), eventTimezone)} - ${formatEventDateTime(endDate.getTime(), eventTimezone)}` +
                               getTimezoneAbbreviation(eventTimezone, startDate.getTime());
                      }
                    }

                    // Single date
                    return formatEventDateTime(startDate.getTime(), eventTimezone) + 
                           getTimezoneAbbreviation(eventTimezone, startDate.getTime());
                  } else {
                    // For time-based events, format in event's timezone
                    const startDate = new Date(parseInt(startTime) * 1000);
                    if (isNaN(startDate.getTime())) {
                      console.error("Invalid start date:", startTime);
                      return "Invalid date";
                    }

                    const timezoneAbbr = getTimezoneAbbreviation(eventTimezone, startDate.getTime());

                    if (endTime) {
                      const endDate = new Date(parseInt(endTime) * 1000);
                      if (!isNaN(endDate.getTime())) {
                        // Show start and end times in event's timezone
                        const startDateTime = formatEventDateTime(startDate.getTime(), eventTimezone, {
                          hour: "numeric",
                          minute: "numeric",
                        });
                        const endTimeOnly = formatEventTime(endDate.getTime(), eventTimezone);

                        return `${startDateTime} - ${endTimeOnly}${timezoneAbbr}`;
                      }
                    }

                    // Just show start time in event's timezone
                    const startDateTime = formatEventDateTime(startDate.getTime(), eventTimezone, {
                      hour: "numeric",
                      minute: "numeric",
                    });

                    return `${startDateTime}${timezoneAbbr}`;
                  }
                } catch (error) {
                  console.error("Error formatting date:", error);
                  return "Invalid date";
                }
              })()}
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
                <ZapButton
                  pubkey={event.pubkey}
                  displayName={event.tags.find((tag) => tag[0] === "title")?.[1] || "Event"}
                  lightningAddress={lightningAddress || ""}
                  eventId={event.id}
                  eventKind={event.kind}
                  eventIdentifier={eventIdentifier}
                  fixedAmount={parseInt(price)}
                  buttonText="Purchase Ticket"
                  className="w-full"
                />
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
            <div className="space-y-8">
              {isHost && (
                <ZapReceipts eventId={event.id} eventPubkey={event.pubkey} />
              )}
              <EventComments
                eventId={event.id}
                eventTitle={
                  event.tags.find((tag) => tag[0] === "title")?.[1] || "Event"
                }
                eventKind={event.kind}
                eventPubkey={event.pubkey}
                eventIdentifier={eventIdentifier}
              />
            </div>
          )}
        </CardContent>
      </Card>
      {user && user.pubkey === event.pubkey && (
        <div className="mt-4 flex gap-2">
          <EditEvent 
            event={event} 
            onEventUpdated={handleEventUpdated}
          />
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
