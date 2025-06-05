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
import { EVENT_CATEGORIES, type EventCategory } from "@/lib/eventCategories";

export function Home() {
  console.log("Home component rendering");
  const { data: events, isLoading, error } = useEvents();
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>(
    []
  );
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Filter events based on all criteria
  const calendarEvents = events
    ?.filter((event): event is DateBasedEvent | TimeBasedEvent => {
      if (event.kind !== 31922 && event.kind !== 31923) return false;

      const startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
      const endTime = event.tags.find((tag) => tag[0] === "end")?.[1];
      if (!startTime) return false;

      let eventStart: number;
      let eventEnd: number;

      if (event.kind === 31922) {
        // For date-only events, handle both YYYY-MM-DD and Unix timestamp formats
        try {
          if (startTime.match(/^\d{10}$/)) {
            // If start time is a short Unix timestamp (10 digits)
            const startDate = new Date(parseInt(startTime) * 1000);
            if (isNaN(startDate.getTime())) {
              console.error("Invalid start date:", startTime);
              return false;
            }
            eventStart = new Date(
              startDate.getFullYear(),
              startDate.getMonth(),
              startDate.getDate()
            ).getTime();
            if (endTime?.match(/^\d{10}$/)) {
              const endDate = new Date(parseInt(endTime) * 1000);
              if (isNaN(endDate.getTime())) {
                console.error("Invalid end date:", endTime);
                return false;
              }
              eventEnd = new Date(
                endDate.getFullYear(),
                endDate.getMonth(),
                endDate.getDate(),
                23,
                59,
                59
              ).getTime();
            } else {
              eventEnd = new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate(),
                23,
                59,
                59
              ).getTime();
            }
          } else if (startTime.match(/^\d{13}$/)) {
            // If start time is a long Unix timestamp (13 digits)
            const startDate = new Date(parseInt(startTime));
            if (isNaN(startDate.getTime())) {
              console.error("Invalid start date:", startTime);
              return false;
            }
            eventStart = new Date(
              startDate.getFullYear(),
              startDate.getMonth(),
              startDate.getDate()
            ).getTime();
            if (endTime?.match(/^\d{13}$/)) {
              const endDate = new Date(parseInt(endTime));
              if (isNaN(endDate.getTime())) {
                console.error("Invalid end date:", endTime);
                return false;
              }
              eventEnd = new Date(
                endDate.getFullYear(),
                endDate.getMonth(),
                endDate.getDate(),
                23,
                59,
                59
              ).getTime();
            } else {
              eventEnd = new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate(),
                23,
                59,
                59
              ).getTime();
            }
          } else {
            // If start time is in YYYY-MM-DD format
            const startDate = new Date(startTime + "T00:00:00Z");
            if (isNaN(startDate.getTime())) {
              console.error("Invalid start date:", startTime);
              return false;
            }
            eventStart = startDate.getTime();
            if (endTime) {
              const endDate = new Date(endTime + "T23:59:59Z");
              if (isNaN(endDate.getTime())) {
                console.error("Invalid end date:", endTime);
                return false;
              }
              eventEnd = endDate.getTime();
            } else {
              eventEnd = new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate(),
                23,
                59,
                59
              ).getTime();
            }
          }
        } catch (error) {
          console.error("Error parsing dates:", error, { startTime, endTime });
          return false;
        }
      } else {
        // For time-based events, convert Unix timestamps to milliseconds
        eventStart = parseInt(startTime) * 1000;
        eventEnd = endTime ? parseInt(endTime) * 1000 : eventStart;
      }

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

      // Filter by categories
      if (selectedCategories.length > 0) {
        const eventCategories = event.tags
          .filter((tag) => tag[0] === "t")
          .map((tag) => tag[1]);
        const hasMatchingCategory = selectedCategories.some((category) =>
          eventCategories.includes(category)
        );
        if (!hasMatchingCategory) return false;
      }

      return true;
    })
    ?.sort((a, b) => {
      const getEventStartTime = (event: DateBasedEvent | TimeBasedEvent) => {
        const startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
        if (!startTime) return 0;

        if (event.kind === 31922) {
          return new Date(startTime + "T00:00:00Z").getTime();
        } else {
          return parseInt(startTime) * 1000;
        }
      };

      return getEventStartTime(a) - getEventStartTime(b);
    });

  const clearFilters = () => {
    setShowPastEvents(false);
    setLocationFilter("");
    setDateRange(undefined);
    setSelectedCategories([]);
  };

  const hasActiveFilters =
    locationFilter ||
    dateRange ||
    showPastEvents ||
    selectedCategories.length > 0;

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
    <div className="container px-0 sm:px-4 py-2 sm:py-6 space-y-3 sm:space-y-6">
      <div className="px-3 sm:px-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Discover Events
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Where people and purpose intertwine
        </p>
      </div>

      {/* Filters */}
      <Card className="rounded-none sm:rounded-lg">
        <Collapsible
          open={isFiltersOpen}
          onOpenChange={setIsFiltersOpen}
          className="w-full"
        >
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors">
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
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering the CollapsibleTrigger
                      clearFilters();
                    }}
                    className="h-8 px-2"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isFiltersOpen && "transform rotate-180"
                  )}
                />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3 sm:p-4 pt-0 space-y-3 sm:space-y-4">
              <div className="flex flex-col gap-3 sm:gap-4">
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

                {/* Category Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Categories</Label>
                  <div className="flex flex-wrap gap-1 sm:gap-2 max-h-32 overflow-y-auto">
                    {EVENT_CATEGORIES.map((category) => (
                      <Button
                        key={category}
                        variant={
                          selectedCategories.includes(category)
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className="h-auto py-1 px-2 text-xs"
                        onClick={() => {
                          if (selectedCategories.includes(category)) {
                            setSelectedCategories(
                              selectedCategories.filter((c) => c !== category)
                            );
                          } else {
                            setSelectedCategories([
                              ...selectedCategories,
                              category,
                            ]);
                          }
                        }}
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                  {selectedCategories.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {selectedCategories.length} category(s) selected
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {calendarEvents?.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <p className="text-muted-foreground">No events found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
                <Card className="h-full transition-colors hover:bg-muted/50 overflow-hidden rounded-none sm:rounded-lg">
                  {imageUrl && (
                    <div className="aspect-video w-full overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader className="p-3 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl line-clamp-2">
                      {title}
                    </CardTitle>
                    {startTime && (
                      <CardDescription className="text-sm">
                        {event.kind === 31922
                          ? // For date-only events, format the date string
                            (() => {
                              try {
                                let date;
                                if (startTime.match(/^\d{10}$/)) {
                                  // Short Unix timestamp
                                  date = new Date(parseInt(startTime) * 1000);
                                } else if (startTime.match(/^\d{13}$/)) {
                                  // Long Unix timestamp
                                  date = new Date(parseInt(startTime));
                                } else {
                                  // YYYY-MM-DD format
                                  date = new Date(startTime + "T00:00:00Z");
                                }

                                if (isNaN(date.getTime())) {
                                  console.error("Invalid date:", startTime);
                                  return "Invalid date";
                                }

                                const endTime = event.tags.find(
                                  (tag) => tag[0] === "end"
                                )?.[1];
                                if (endTime) {
                                  let endDate;
                                  if (endTime.match(/^\d{10}$/)) {
                                    endDate = new Date(
                                      parseInt(endTime) * 1000
                                    );
                                  } else if (endTime.match(/^\d{13}$/)) {
                                    endDate = new Date(parseInt(endTime));
                                  } else {
                                    endDate = new Date(endTime + "T23:59:59Z");
                                  }

                                  if (isNaN(endDate.getTime())) {
                                    console.error("Invalid end date:", endTime);
                                    return date.toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                      timeZone: "UTC",
                                    });
                                  }

                                  // If start and end dates are the same, just show one date
                                  if (
                                    date.toDateString() ===
                                    endDate.toDateString()
                                  ) {
                                    return date.toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                      timeZone: "UTC",
                                    });
                                  }

                                  // Show date range
                                  return `${date.toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                    timeZone: "UTC",
                                  })} - ${endDate.toLocaleDateString(
                                    undefined,
                                    {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                      timeZone: "UTC",
                                    }
                                  )}`;
                                }

                                // Single date
                                return date.toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  timeZone: "UTC",
                                });
                              } catch (error) {
                                console.error("Error formatting date:", error);
                                return "Invalid date";
                              }
                            })()
                          : // For time-based events, format the Unix timestamp
                            (() => {
                              try {
                                const date = new Date(
                                  parseInt(startTime) * 1000
                                );
                                if (isNaN(date.getTime())) {
                                  console.error("Invalid date:", startTime);
                                  return "Invalid date";
                                }
                                return date.toLocaleString(undefined, {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "numeric",
                                  timeZone: "UTC",
                                });
                              } catch (error) {
                                console.error("Error formatting date:", error);
                                return "Invalid date";
                              }
                            })()}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6 pt-0">
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
