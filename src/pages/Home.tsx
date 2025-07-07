import { useEvents } from "@/lib/eventUtils";
import { useMuteList } from "@/hooks/useMuteList";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "react-router-dom";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createEventIdentifier } from "@/lib/nip19Utils";
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
import { CalendarIcon, Search, X, Filter, ChevronDown, Grid3X3, Calendar as CalendarViewIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { EVENT_CATEGORIES, type EventCategory } from "@/lib/eventCategories";
import { TimezoneDisplay } from "@/components/TimezoneDisplay";
import { MonthlyCalendarView } from "@/components/MonthlyCalendarView";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function Home() {
  console.log("Home component rendering");
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");
  
  // Use regular loading for both views - simpler and more reliable
  const { data: allEventsData, isLoading, error } = useEvents({
    limit: 500, // Load a good amount of events
    includeRSVPs: true
  });

  const { isMuted, isLoading: isMuteListLoading } = useMuteList();

  // State for client-side pagination in grid view
  const [displayedEventCount, setDisplayedEventCount] = useState(50);
  
  const allEvents = useMemo(() => allEventsData || [], [allEventsData]);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>(
    []
  );
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Filter events based on all criteria including mute list
  const allFilteredEvents = allEvents
    ?.filter((event): event is DateBasedEvent | TimeBasedEvent => {
      if (event.kind !== 31922 && event.kind !== 31923) return false;

      // Filter out events from muted pubkeys
      if (!isMuteListLoading && isMuted(event.pubkey)) {
        return false;
      }

      const startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
      const endTime = event.tags.find((tag) => tag[0] === "end")?.[1];
      if (!startTime) return false;

      let eventStart: number;
      let eventEnd: number;

      if (event.kind === 31922) {
        // For date-only events, handle both YYYY-MM-DD and Unix timestamp formats
        // Always use local timezone for date-based events
        try {
          if (startTime.match(/^\d{10}$/)) {
            // If start time is a short Unix timestamp (10 digits)
            const startDate = new Date(parseInt(startTime) * 1000);
            if (isNaN(startDate.getTime())) {
              console.error("Invalid start date:", startTime);
              return false;
            }
            // Use local timezone for date-based events
            eventStart = new Date(
              startDate.getFullYear(),
              startDate.getMonth(),
              startDate.getDate(),
              0,
              0,
              0
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
                59,
                999
              ).getTime();
            } else {
              eventEnd = new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate(),
                23,
                59,
                59,
                999
              ).getTime();
            }
          } else if (startTime.match(/^\d{13}$/)) {
            // If start time is a long Unix timestamp (13 digits)
            const startDate = new Date(parseInt(startTime));
            if (isNaN(startDate.getTime())) {
              console.error("Invalid start date:", startTime);
              return false;
            }
            // Use local timezone for date-based events
            eventStart = new Date(
              startDate.getFullYear(),
              startDate.getMonth(),
              startDate.getDate(),
              0,
              0,
              0
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
                59,
                999
              ).getTime();
            } else {
              eventEnd = new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate(),
                23,
                59,
                59,
                999
              ).getTime();
            }
          } else {
            // If start time is in YYYY-MM-DD format, parse in local timezone
            const [year, month, day] = startTime.split('-').map(Number);
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
              console.error("Invalid start date format:", startTime);
              return false;
            }
            const startDate = new Date(year, month - 1, day, 0, 0, 0);
            eventStart = startDate.getTime();
            
            if (endTime && endTime !== startTime) {
              const [endYear, endMonth, endDay] = endTime.split('-').map(Number);
              if (isNaN(endYear) || isNaN(endMonth) || isNaN(endDay)) {
                console.error("Invalid end date format:", endTime);
                return false;
              }
              const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
              eventEnd = endDate.getTime();
            } else {
              const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
              eventEnd = endDate.getTime();
            }
          }
        } catch (error) {
          console.error("Error parsing dates:", error, { startTime, endTime });
          return false;
        }
      } else {
        // For time-based events (kind 31923), convert Unix timestamps to milliseconds
        eventStart = parseInt(startTime) * 1000;
        if (endTime) {
          eventEnd = parseInt(endTime) * 1000;
        } else {
          // If no end time is specified, treat the event as lasting 2 hours from start
          // This is a reasonable default for meetings, talks, etc.
          eventEnd = eventStart + (2 * 60 * 60 * 1000); // Add 2 hours
        }
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
          // For date-only events, use local timezone
          if (startTime.match(/^\d{10}$/)) {
            const startDate = new Date(parseInt(startTime) * 1000);
            return new Date(
              startDate.getFullYear(),
              startDate.getMonth(),
              startDate.getDate(),
              0,
              0,
              0
            ).getTime();
          } else if (startTime.match(/^\d{13}$/)) {
            const startDate = new Date(parseInt(startTime));
            return new Date(
              startDate.getFullYear(),
              startDate.getMonth(),
              startDate.getDate(),
              0,
              0,
              0
            ).getTime();
          } else {
            // YYYY-MM-DD format, parse in local timezone
            const [year, month, day] = startTime.split('-').map(Number);
            if (isNaN(year) || isNaN(month) || isNaN(day)) return 0;
            return new Date(year, month - 1, day, 0, 0, 0).getTime();
          }
        } else {
          return parseInt(startTime) * 1000;
        }
      };

      return getEventStartTime(a) - getEventStartTime(b);
    });

  // For grid view, limit the displayed events for pagination
  const filteredEvents = viewMode === "calendar" 
    ? allFilteredEvents 
    : allFilteredEvents?.slice(0, displayedEventCount);

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

  // Load more functionality for grid view
  const canLoadMore = viewMode === "grid" && allFilteredEvents && displayedEventCount < allFilteredEvents.length;
  
  const loadMoreEvents = () => {
    setDisplayedEventCount(prev => prev + 50);
  };

  // Infinite scroll observer for grid view
  const observer = useRef<IntersectionObserver>();
  const lastEventElementRef = useCallback((node: HTMLElement | null) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && canLoadMore) {
        console.log("Loading more events via intersection observer...");
        loadMoreEvents();
      }
    }, {
      threshold: 0.1,
      rootMargin: '100px'
    });
    
    if (node) observer.current.observe(node);
  }, [isLoading, canLoadMore]);

  useEffect(() => {
    console.log("Home component mounted");
    console.log("Events state:", { 
      allEvents: allEvents.length, 
      allFilteredEvents: allFilteredEvents?.length || 0,
      displayedEvents: filteredEvents?.length || 0,
      displayedEventCount,
      canLoadMore,
      isLoading, 
      error,
      viewMode
    });

    // Debug: Check for duplicate events
    if (allEvents.length > 0) {
      const eventCoordinates = new Map<string, number>();
      const duplicates: string[] = [];
      
      allEvents.forEach(event => {
        if (event.kind === 31922 || event.kind === 31923) {
          const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
          if (dTag) {
            const coordinate = `${event.kind}:${event.pubkey}:${dTag}`;
            const count = eventCoordinates.get(coordinate) || 0;
            eventCoordinates.set(coordinate, count + 1);
            if (count > 0) {
              duplicates.push(coordinate);
            }
          }
        }
      });
      
      if (duplicates.length > 0) {
        console.warn("🚨 DUPLICATE EVENTS DETECTED:", duplicates);
        console.warn("Event coordinates with counts:", Array.from(eventCoordinates.entries()).filter(([_, count]) => count > 1));
      } else {
        console.log("✅ No duplicate events detected");
      }
    }
  }, [allEvents, allFilteredEvents, filteredEvents, displayedEventCount, canLoadMore, isLoading, error, viewMode]);

  if (isLoading || isMuteListLoading) {
    console.log("Loading events...");
    return <Spinner />;
  }

  if (error) {
    console.error("Error loading events:", error);
    const errorMessage = error && typeof error === 'object' && 'message' in error 
      ? (error as Error).message 
      : String(error);
    return <div>Error loading events: {errorMessage}</div>;
  }

  console.log("Rendering events:", {
    allEventsLength: allEvents.length,
    allFilteredEventsLength: allFilteredEvents?.length || 0,
    displayedEventsLength: filteredEvents?.length || 0,
    displayedEventCount,
    canLoadMore,
    viewMode
  });

  return (
    <div className="container px-0 sm:px-4 py-2 sm:py-6 space-y-3 sm:space-y-6">
      <div className="px-3 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Discover Events
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Where people and purpose intertwine
            </p>
          </div>
          
          {/* View Mode Toggle */}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => {
              if (value) setViewMode(value as "grid" | "calendar");
            }}
            className="justify-start sm:justify-end"
          >
            <ToggleGroupItem value="grid" aria-label="Grid view" className="gap-2">
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline">Grid</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" aria-label="Calendar view" className="gap-2">
              <CalendarViewIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
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

      {filteredEvents?.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <p className="text-muted-foreground">No events found</p>
        </div>
      ) : viewMode === "calendar" ? (
        <MonthlyCalendarView events={filteredEvents || []} />
      ) : (
        <>
          <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents?.map((event, index) => {
              const title =
                event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
              const description = event.content;
              const startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
              const location = event.tags.find(
                (tag) => tag[0] === "location"
              )?.[1];
              const imageUrl = event.tags.find((tag) => tag[0] === "image")?.[1];
              const eventIdentifier = createEventIdentifier(event);

              // Add ref to last element for infinite scroll
              const isLastElement = index === filteredEvents.length - 1;

              return (
                <div 
                  key={event.id}
                  ref={isLastElement ? lastEventElementRef : undefined}
                >
                  <Link to={`/event/${eventIdentifier}`}>
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
                          <TimezoneDisplay event={event} showLocalTime={false} />
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
                </div>
              );
            })}
          </div>

          {/* Load more button */}
          {canLoadMore && (
            <div className="flex justify-center py-8">
              <Button
                onClick={loadMoreEvents}
                variant="outline"
                className="px-8"
              >
                Load More Events ({allFilteredEvents!.length - displayedEventCount} remaining)
              </Button>
            </div>
          )}

          {/* Debug info - show in grid view */}
          {viewMode === "grid" && (
            <div className="flex justify-center py-4">
              <div className="text-xs text-muted-foreground space-y-2 text-center">
                <div>Debug Info:</div>
                <div>Total events loaded: {allEvents.length}</div>
                <div>After filtering: {allFilteredEvents?.length || 0}</div>
                <div>Currently displayed: {filteredEvents?.length || 0}</div>
                <div>Can load more: {String(canLoadMore)}</div>
                {canLoadMore && (
                  <Button
                    onClick={loadMoreEvents}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    🔧 Debug: Load More
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
