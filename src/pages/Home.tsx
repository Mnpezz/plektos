import { useEvents } from "@/lib/eventUtils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { nip19 } from "nostr-tools";
import type { DateBasedEvent, TimeBasedEvent } from "@/lib/eventTypes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CalendarIcon, Search, X, Filter, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";

export function Home() {
  console.log("Home component rendering");
  const { data: events, isLoading, error } = useEvents();
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Filter events based on all criteria
  const calendarEvents = events
    ?.filter((event): event is DateBasedEvent | TimeBasedEvent => {
      if (event.kind !== 31922 && event.kind !== 31923) return false;

      const startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
      const endTime = event.tags.find((tag) => tag[0] === "end")?.[1];
      if (!startTime) return false;

      const eventStart = parseInt(startTime) * 1000; // Convert to milliseconds
      const eventEnd = endTime ? parseInt(endTime) * 1000 : eventStart; // Use start time as end time if no end time specified
      const now = Date.now();

      // Filter by past/future events - an event is past only when its end time has passed
      if (!showPastEvents && eventEnd <= now) return false;

      // Filter by date range
      if (dateRange?.from && eventStart < dateRange.from.getTime())
        return false;
      if (dateRange?.to && eventStart > dateRange.to.getTime()) return false;

      // Filter by location
      if (locationFilter) {
        const location =
          event.tags.find((tag) => tag[0] === "location")?.[1]?.toLowerCase() ||
          "";
        if (!location.includes(locationFilter.toLowerCase())) return false;
      }

      return true;
    })
    ?.sort((a, b) => {
      const aStart =
        parseInt(a.tags.find((tag) => tag[0] === "start")?.[1] || "0") * 1000;
      const bStart =
        parseInt(b.tags.find((tag) => tag[0] === "start")?.[1] || "0") * 1000;
      return aStart - bStart;
    });

  const clearFilters = () => {
    setShowPastEvents(false);
    setLocationFilter("");
    setDateRange(undefined);
  };

  const hasActiveFilters = locationFilter || dateRange || showPastEvents;

  useEffect(() => {
    console.log("Home component mounted");
    console.log("Events state:", { events, isLoading, error });
  }, [events, isLoading, error]);

  if (isLoading) {
    console.log("Loading events...");
    return <Spinner />;
  }

  if (error) {
    console.error("Error loading events:", error);
    return <div>Error loading events: {error.message}</div>;
  }

  console.log("Rendering events:", calendarEvents);

  return (
    <div className="container px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Upcoming Events
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Discover and join events in your area
        </p>
      </div>

      {/* Filters */}
      <Card>
        <Collapsible
          open={isFiltersOpen}
          onOpenChange={setIsFiltersOpen}
          className="w-full"
        >
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Filters</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  Active
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 px-2"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      isFiltersOpen && "transform rotate-180"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Location Filter */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filter by location..."
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !dateRange?.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} -{" "}
                              {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Past Events Toggle */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="past-events"
                    checked={showPastEvents}
                    onCheckedChange={setShowPastEvents}
                  />
                  <Label htmlFor="past-events">Show past events</Label>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {calendarEvents?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No events found</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {calendarEvents?.map((event) => {
            const title =
              event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
            const description = event.content;
            const startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
            const location = event.tags.find(
              (tag) => tag[0] === "location"
            )?.[1];
            const imageUrl = event.tags.find((tag) => tag[0] === "image")?.[1];
            const nevent = nip19.neventEncode({
              id: event.id,
              kind: event.kind,
              author: event.pubkey,
            });

            return (
              <Link key={event.id} to={`/event/${nevent}`}>
                <Card className="h-full transition-colors hover:bg-muted/50 overflow-hidden">
                  {imageUrl && (
                    <div className="aspect-video w-full overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl line-clamp-2">
                      {title}
                    </CardTitle>
                    {startTime && (
                      <CardDescription className="text-sm">
                        {event.kind === 31922
                          ? // For date-only events, show just the date
                            new Date(
                              parseInt(startTime) * 1000
                            ).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              timeZone: "UTC",
                            })
                          : // For time-based events, show date and time
                            new Date(parseInt(startTime) * 1000).toLocaleString(
                              undefined,
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "numeric",
                                minute: "numeric",
                                timeZone: "UTC",
                              }
                            )}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {description}
                    </p>
                    {location && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        📍 {location}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
