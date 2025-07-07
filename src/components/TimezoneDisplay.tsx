import {
  getEventTimezone,
  formatEventDateTime,
  formatEventTime,
  getTimezoneAbbreviation,
  getUserTimezone,
} from "@/lib/eventTimezone";
import type { DateBasedEvent, TimeBasedEvent } from "@/lib/eventTypes";
import { Clock, Globe } from "lucide-react";

interface TimezoneDisplayProps {
  event: DateBasedEvent | TimeBasedEvent;
  showLocalTime?: boolean;
  className?: string;
}

export function TimezoneDisplay({
  event,
  showLocalTime = true,
  className = "",
}: TimezoneDisplayProps) {
  const startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
  const endTime = event.tags.find((tag) => tag[0] === "end")?.[1];

  if (!startTime) {
    return <span className="text-muted-foreground">No time specified</span>;
  }

  const eventTimezone = getEventTimezone(event);
  const userTimezone = getUserTimezone();
  const isLocalTimezone = eventTimezone === userTimezone;

  const getFormattedTime = () => {
    try {
      if (event.kind === 31922) {
        // Date-based events
        let startDate;
        if (startTime.match(/^\d{10}$/)) {
          startDate = new Date(parseInt(startTime) * 1000);
        } else if (startTime.match(/^\d{13}$/)) {
          startDate = new Date(parseInt(startTime));
        } else {
          // YYYY-MM-DD format
          const [year, month, day] = startTime.split("-").map(Number);
          if (isNaN(year) || isNaN(month) || isNaN(day)) {
            throw new Error("Invalid date format");
          }
          startDate = new Date(year, month - 1, day);
        }

        if (isNaN(startDate.getTime())) {
          throw new Error("Invalid date");
        }

        const timezoneAbbr = getTimezoneAbbreviation(
          eventTimezone,
          startDate.getTime()
        );

        if (endTime && endTime !== startTime) {
          let endDate;
          if (endTime.match(/^\d{10}$/)) {
            endDate = new Date(parseInt(endTime) * 1000);
          } else if (endTime.match(/^\d{13}$/)) {
            endDate = new Date(parseInt(endTime));
          } else {
            const [endYear, endMonth, endDay] = endTime.split("-").map(Number);
            if (!isNaN(endYear) && !isNaN(endMonth) && !isNaN(endDay)) {
              endDate = new Date(endYear, endMonth - 1, endDay);
            }
          }

          if (endDate && !isNaN(endDate.getTime())) {
            if (startDate.toDateString() === endDate.toDateString()) {
              return {
                eventTime:
                  formatEventDateTime(startDate.getTime(), eventTimezone) +
                  timezoneAbbr,
                localTime:
                  showLocalTime && !isLocalTimezone
                    ? formatEventDateTime(startDate.getTime(), userTimezone) +
                      getTimezoneAbbreviation(userTimezone, startDate.getTime())
                    : null,
              };
            }

            return {
              eventTime: `${formatEventDateTime(
                startDate.getTime(),
                eventTimezone
              )} - ${formatEventDateTime(
                endDate.getTime(),
                eventTimezone
              )}${timezoneAbbr}`,
              localTime:
                showLocalTime && !isLocalTimezone
                  ? `${formatEventDateTime(
                      startDate.getTime(),
                      userTimezone
                    )} - ${formatEventDateTime(
                      endDate.getTime(),
                      userTimezone
                    )}${getTimezoneAbbreviation(
                      userTimezone,
                      startDate.getTime()
                    )}`
                  : null,
            };
          }
        }

        return {
          eventTime:
            formatEventDateTime(startDate.getTime(), eventTimezone) +
            timezoneAbbr,
          localTime:
            showLocalTime && !isLocalTimezone
              ? formatEventDateTime(startDate.getTime(), userTimezone) +
                getTimezoneAbbreviation(userTimezone, startDate.getTime())
              : null,
        };
      } else {
        // Time-based events
        const startDate = new Date(parseInt(startTime) * 1000);
        if (isNaN(startDate.getTime())) {
          throw new Error("Invalid start date");
        }

        const timezoneAbbr = getTimezoneAbbreviation(
          eventTimezone,
          startDate.getTime()
        );

        if (endTime) {
          const endDate = new Date(parseInt(endTime) * 1000);
          if (!isNaN(endDate.getTime())) {
            const startDateTime = formatEventDateTime(
              startDate.getTime(),
              eventTimezone,
              {
                hour: "numeric",
                minute: "numeric",
              }
            );
            const endTimeOnly = formatEventTime(
              endDate.getTime(),
              eventTimezone
            );

            return {
              eventTime: `${startDateTime} - ${endTimeOnly}${timezoneAbbr}`,
              localTime:
                showLocalTime && !isLocalTimezone
                  ? `${formatEventDateTime(startDate.getTime(), userTimezone, {
                      hour: "numeric",
                      minute: "numeric",
                    })} - ${formatEventTime(
                      endDate.getTime(),
                      userTimezone
                    )}${getTimezoneAbbreviation(
                      userTimezone,
                      startDate.getTime()
                    )}`
                  : null,
            };
          }
        }

        const startDateTime = formatEventDateTime(
          startDate.getTime(),
          eventTimezone,
          {
            hour: "numeric",
            minute: "numeric",
          }
        );

        return {
          eventTime: `${startDateTime}${timezoneAbbr}`,
          localTime:
            showLocalTime && !isLocalTimezone
              ? `${formatEventDateTime(startDate.getTime(), userTimezone, {
                  hour: "numeric",
                  minute: "numeric",
                })}${getTimezoneAbbreviation(
                  userTimezone,
                  startDate.getTime()
                )}`
              : null,
        };
      }
    } catch (error) {
      console.error("Error formatting event time:", error);
      return {
        eventTime: "Invalid date",
        localTime: null,
      };
    }
  };

  const { eventTime, localTime } = getFormattedTime();

  // Show a warning if no timezone was detected for the event
  const noTimezoneDetected = !eventTimezone;

  if (!showLocalTime || !localTime || isLocalTimezone) {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{eventTime}</span>
        </div>
        {noTimezoneDetected && (
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-amber-600">
              Timezone not specified - showing in your local time
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>{eventTime}</span>
      </div>
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {localTime} (your time)
        </span>
      </div>
      {noTimezoneDetected && (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-amber-500" />
          <span className="text-xs text-amber-600">
            Event timezone not specified
          </span>
        </div>
      )}
    </div>
  );
}
