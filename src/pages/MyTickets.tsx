import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Clock } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserRSVPs, type UserRSVPWithEvent } from "@/hooks/useUserRSVPs";
import { LoginArea } from "@/components/auth/LoginArea";
import { createEventIdentifier } from "@/lib/nip19Utils";

function EventCard({ rsvpData }: { rsvpData: UserRSVPWithEvent }) {
  const { event, status, eventTitle, eventDate } = rsvpData;

  // Get additional event details from tags
  const location = event.tags.find((tag) => tag[0] === "location")?.[1];
  const eventIdentifier = createEventIdentifier(event);

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">
              <Link
                to={`/event/${eventIdentifier}`}
                className="hover:text-primary transition-colors"
              >
                {eventTitle}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1">{event.content}</CardDescription>
          </div>
          <div className="flex gap-2 flex-col items-end">
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {event.kind === 31922
                ? eventDate.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : eventDate.toLocaleString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                  })}
            </span>
          </div>
          {event.kind === 31923 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {eventDate.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "numeric",
                })}
              </span>
            </div>
          )}
          {location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{location}</span>
            </div>
          )}
          {rsvpData.rsvp.content && (
            <div className="mt-3 p-2 bg-muted/50 rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Your note:</strong> {rsvpData.rsvp.content}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="mb-4">
          <CardHeader>
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function MyTickets() {
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("upcoming");
  const { data: rsvpData, isLoading, error } = useUserRSVPs();

  if (!user) {
    return (
      <div className="container px-0 sm:px-4 py-2 sm:py-6">
        <div className="px-3 sm:px-0 text-center">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
            My Tickets
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mb-6">
            Please log in to view your event tickets and RSVPs.
          </p>
          <div className="flex justify-center">
            <LoginArea className="max-w-60" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container px-0 sm:px-4 py-2 sm:py-6 space-y-3 sm:space-y-6">
      <div className="px-3 sm:px-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
          My Tickets
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          View your upcoming events and past event history
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : error ? (
            <Card className="p-8 text-center">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">
                  Error Loading Events
                </h3>
                <p className="text-muted-foreground">
                  There was an error loading your events. Please try again.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {rsvpData?.upcoming && rsvpData.upcoming.length > 0 ? (
                rsvpData.upcoming.map((rsvpEvent) => (
                  <EventCard key={rsvpEvent.rsvp.id} rsvpData={rsvpEvent} />
                ))
              ) : (
                <Card className="p-8 text-center">
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-2">
                      No Upcoming Events
                    </h3>
                    <p className="text-muted-foreground">
                      You haven't RSVPed to any upcoming events yet. Browse
                      events to find something interesting!
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : error ? (
            <Card className="p-8 text-center">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">
                  Error Loading Events
                </h3>
                <p className="text-muted-foreground">
                  There was an error loading your events. Please try again.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {rsvpData?.past && rsvpData.past.length > 0 ? (
                rsvpData.past.map((rsvpEvent) => (
                  <EventCard key={rsvpEvent.rsvp.id} rsvpData={rsvpEvent} />
                ))
              ) : (
                <Card className="p-8 text-center">
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-2">
                      No Past Events
                    </h3>
                    <p className="text-muted-foreground">
                      You haven't attended any events yet. Start exploring and
                      joining events!
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
