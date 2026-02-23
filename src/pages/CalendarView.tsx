import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@/hooks/useNostr";
import { parseCalendarEvent } from "@/lib/calendarUtils";
import { createEventIdentifier } from "@/lib/nip19Utils";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TimezoneDisplay } from "@/components/TimezoneDisplay";

export function CalendarView() {
  const { naddr } = useParams(); // URL param should be the 'd' identifier or coordinate
  const { nostr } = useNostr();

  // Parse pubkey and d tag from the url param (assuming format pubkey:d or just d)
  const parts = naddr?.split(':') || [];
  const queryPubkey = parts.length > 1 ? parts[0] : null;
  const queryD = parts.length > 1 ? parts[1] : naddr;

  const { data: calendarData, isLoading: isLoadingCalendar } = useQuery({
    queryKey: ['calendar', naddr],
    enabled: !!nostr && !!queryD,
    queryFn: async () => {
      const filter: any = { kinds: [31924] };

      if (queryD) {
        filter['#d'] = [queryD];
      }
      if (queryPubkey) {
        filter.authors = [queryPubkey];
      }

      const events = await nostr.query([filter]);
      if (events.length === 0) return null;
      return parseCalendarEvent(events[0]);
    }
  });

  const calendarCoordinate = calendarData
    ? `31924:${calendarData.pubkey}:${calendarData.d}`
    : null;

  // Query events that reference this calendar via an `a` tag OR events specifically included by the calendar
  const { data: calendarEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['calendarEvents', calendarCoordinate, calendarData?.events],
    enabled: !!nostr && !!calendarCoordinate,
    queryFn: async () => {
      // 1. Find events that declare they belong to this calendar
      const filters: any[] = [
        {
          kinds: [31922, 31923],
          '#a': [calendarCoordinate!]
        }
      ];

      // 2. Map explicit events that this calendar references
      if (calendarData?.events && calendarData.events.length > 0) {
        const explicitIds: string[] = [];

        for (const ref of calendarData.events) {
          if (ref.includes(':')) {
            const parts = ref.split(':');
            if (parts.length === 3) {
              filters.push({
                kinds: [parseInt(parts[0])],
                authors: [parts[1]],
                '#d': [parts[2]]
              });
            }
          } else {
            explicitIds.push(ref);
          }
        }

        if (explicitIds.length > 0) {
          filters.push({
            kinds: [31922, 31923],
            ids: explicitIds
          });
        }
      }

      const events = await nostr.query(filters);

      // Deduplicate raw nostr events by their ID
      const uniqueEventsMap = new Map();
      events.forEach((e: any) => uniqueEventsMap.set(e.id, e));
      const deduplicatedEvents = Array.from(uniqueEventsMap.values());

      return deduplicatedEvents.sort((a: any, b: any) => {
        const timeA = a.tags.find((t: any) => t[0] === 'start')?.[1];
        const timeB = b.tags.find((t: any) => t[0] === 'start')?.[1];

        const parseTime = (val: string | undefined, created: number) => {
          if (!val) return created * 1000;
          if (val.includes('-')) {
            const [y, m, d] = val.split('-');
            return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getTime();
          }
          return parseInt(val) * 1000;
        };

        return parseTime(timeA, a.created_at) - parseTime(timeB, b.created_at);
      });
    }
  });

  if (isLoadingCalendar) {
    return (
      <div className="container py-12 flex justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!calendarData) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <h2>Calendar not found</h2>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-8 animate-in fade-in duration-500">
      <Card className="overflow-hidden border-2 bg-gradient-to-br from-card to-card/50">
        {calendarData.image ? (
          <div className="h-48 md:h-64 w-full bg-muted relative">
            <img
              src={calendarData.image}
              alt={calendarData.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6 text-white">
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                {calendarData.title}
              </h1>
            </div>
          </div>
        ) : (
          <div className="p-6 md:p-8 border-b">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {calendarData.title}
                </h1>
              </div>
            </div>
          </div>
        )}

        {calendarData.description && (
          <CardContent className="p-6 md:p-8 pt-6">
            <p className="text-lg text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {calendarData.description}
            </p>
          </CardContent>
        )}
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Upcoming Events
          </h2>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/create">
              <Plus className="h-4 w-4 mr-1" />
              Add Event
            </Link>
          </Button>
        </div>

        {isLoadingEvents ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : calendarEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
            {calendarEvents.map((event: any) => {
              const title = event.tags.find((tag: string[]) => tag[0] === "title")?.[1] || "Untitled";
              const description = event.content;
              const startTime = event.tags.find((tag: string[]) => tag[0] === "start")?.[1];
              const location = event.tags.find((tag: string[]) => tag[0] === "location")?.[1];
              const imageUrl = event.tags.find((tag: string[]) => tag[0] === "image")?.[1];
              const eventIdentifier = createEventIdentifier(event);

              return (
                <Link to={`/event/${eventIdentifier}`} key={event.id}>
                  <Card className="h-full transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/20 overflow-hidden rounded-none sm:rounded-3xl border-2 border-transparent hover:border-primary/20 group">
                    <div className="aspect-video w-full overflow-hidden relative">
                      <img
                        src={imageUrl || "/default-calendar.png"}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-lg sm:text-xl line-clamp-2 group-hover:text-primary transition-colors duration-200">
                        {title}
                      </CardTitle>
                      {startTime && (
                        <div className="text-sm font-medium">
                          <TimezoneDisplay event={event} showLocalTime={false} />
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                        {description}
                      </p>
                      {location && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-xl">
                          <span className="text-primary">📍</span>
                          <span className="font-medium">{location}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed bg-muted/20">
            <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">No Events Yet</h3>
            <p className="text-muted-foreground">This calendar is currently empty.</p>
          </div>
        )}
      </div>
    </div>
  );
}
