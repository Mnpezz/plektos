import { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import { LocationSearch } from "@/components/LocationSearch";
import { ImageUpload } from "@/components/ImageUpload";
import { CategorySelector } from "@/components/CategorySelector";
import { PaidTicketForm } from "@/components/PaidTicketForm";
import { EventCategory } from "@/lib/eventCategories";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit } from "lucide-react";
import type { DateBasedEvent, TimeBasedEvent } from "@/lib/eventTypes";

// Common timezones that users are likely to select
const commonTimezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

interface EditEventProps {
  event: DateBasedEvent | TimeBasedEvent;
  onEventUpdated?: () => void;
}

export function EditEvent({ event, onEventUpdated }: EditEventProps) {
  const { user } = useCurrentUser();
  const { mutate: updateEvent } = useNostrPublish();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract current event data
  const getInitialFormData = useCallback(() => {
    const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "";
    const description = event.content || "";
    const location = event.tags.find((tag) => tag[0] === "location")?.[1] || "";
    const imageUrl = event.tags.find((tag) => tag[0] === "image")?.[1] || "";
    const startTime = event.tags.find((tag) => tag[0] === "start")?.[1] || "";
    const endTime = event.tags.find((tag) => tag[0] === "end")?.[1] || "";
    const categories = event.tags
      .filter((tag) => tag[0] === "t")
      .map((tag) => tag[1] as EventCategory);
    
    // Extract ticket information
    const price = event.tags.find((tag) => tag[0] === "price")?.[1];
    const lightningAddress = event.tags.find((tag) => tag[0] === "lud16")?.[1];
    const hasTicketInfo = !!(price && lightningAddress);

    // Extract timezone (only for time-based events)
    const timezone = event.tags.find((tag) => tag[0] === "start_tzid")?.[1] || 
                    Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Parse dates differently based on event kind
    let startDate = "";
    let endDate = "";
    let startTimeOfDay = "";
    let endTimeOfDay = "";

    if (event.kind === 31922) {
      // Date-based event: startTime and endTime are in YYYY-MM-DD format
      startDate = startTime;
      endDate = endTime;
    } else {
      // Time-based event: startTime and endTime are Unix timestamps
      if (startTime) {
        const startDateTime = new Date(parseInt(startTime) * 1000);
        startDate = startDateTime.toISOString().split("T")[0];
        startTimeOfDay = startDateTime.toTimeString().slice(0, 5);
      }
      if (endTime) {
        const endDateTime = new Date(parseInt(endTime) * 1000);
        endDate = endDateTime.toISOString().split("T")[0];
        endTimeOfDay = endDateTime.toTimeString().slice(0, 5);
      }
    }

    return {
      title,
      description,
      location,
      locationDetails: {
        name: "",
        address: location,
        placeId: "",
        lat: 0,
        lng: 0,
      },
      startDate,
      startTime: startTimeOfDay,
      endDate,
      endTime: endTimeOfDay,
      imageUrl,
      categories,
      ticketInfo: {
        enabled: hasTicketInfo,
        price: price ? parseInt(price) : 0,
        lightningAddress: lightningAddress || "",
      },
      timezone,
    };
  }, [event]);

  const [formData, setFormData] = useState(getInitialFormData());

  // Reset form data when event changes
  useEffect(() => {
    setFormData(getInitialFormData());
  }, [getInitialFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate required fields
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!formData.startDate) {
      toast.error("Start date is required");
      return;
    }

    if (!formData.endDate) {
      toast.error("End date is required");
      return;
    }

    // Validate end date is after start date
    if (formData.endDate < formData.startDate) {
      toast.error("End date must be after start date");
      return;
    }

    setIsSubmitting(true);
    try {
      // Determine if this is a time-based event (preserve original kind)
      const eventKind = event.kind;

      // Format start and end timestamps based on event kind
      let startTimestamp: string;
      let endTimestamp: string | undefined;

      if (eventKind === 31923) {
        // For time-based events, use Unix timestamps with specific times
        const startDateTime = new Date(formData.startDate);
        if (formData.startTime) {
          const [hours, minutes] = formData.startTime.split(":").map(Number);
          startDateTime.setHours(hours, minutes);
        }

        const endDateTime = new Date(formData.endDate);
        if (formData.endTime) {
          const [hours, minutes] = formData.endTime.split(":").map(Number);
          endDateTime.setHours(hours, minutes);
        }

        startTimestamp = Math.floor(startDateTime.getTime() / 1000).toString();
        endTimestamp = Math.floor(endDateTime.getTime() / 1000).toString();
      } else {
        // For date-only events, use YYYY-MM-DD format as per NIP-52
        startTimestamp = formData.startDate;
        endTimestamp = formData.endDate;
      }

      // Get the original 'd' tag value to maintain the same identifier
      const originalDTag = event.tags.find((tag) => tag[0] === "d")?.[1];
      if (!originalDTag) {
        toast.error("Cannot find event identifier");
        return;
      }

      const tags = [
        ["d", originalDTag], // Keep the same identifier for replacement
        ["title", formData.title],
        ["description", formData.description],
        ["location", formData.location],
      ];

      // Add location details if available
      if (formData.locationDetails.placeId) {
        tags.push(
          [
            "g",
            `${formData.locationDetails.lat},${formData.locationDetails.lng}`,
          ],
          ["place_id", formData.locationDetails.placeId]
        );
      }

      // Add start and end timestamps
      tags.push(["start", startTimestamp]);
      if (endTimestamp) {
        tags.push(["end", endTimestamp]);
      }

      // Add timezone tags only for time-based events (kind 31923)
      if (eventKind === 31923) {
        tags.push(["start_tzid", formData.timezone]);
        if (endTimestamp) {
          tags.push(["end_tzid", formData.timezone]);
        }
      }

      // Add image URL if provided
      if (formData.imageUrl) {
        tags.push(["image", formData.imageUrl]);
      }

      // Add categories as 't' tags if provided
      if (formData.categories.length > 0) {
        for (const category of formData.categories) {
          tags.push(["t", category]);
        }
      }

      // Add ticket information if enabled
      if (formData.ticketInfo.enabled) {
        tags.push(
          ["price", formData.ticketInfo.price.toString()],
          ["lud16", formData.ticketInfo.lightningAddress]
        );
      }

      await updateEvent({
        kind: eventKind,
        content: formData.description,
        tags,
      });

      toast.success("Event updated successfully!");
      setOpen(false);
      
      // Call the callback to trigger data refresh
      if (onEventUpdated) {
        onEventUpdated();
      }
    } catch (error) {
      toast.error("Failed to update event");
      console.error("Error updating event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || user.pubkey !== event.pubkey) {
    return null;
  }

  // Only show edit button for NIP-52 calendar events (31922 and 31923)
  if (event.kind !== 31922 && event.kind !== 31923) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Edit className="h-4 w-4" />
          Edit Event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              required
            />
          </div>

          <LocationSearch
            value={formData.location}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, location: value }))
            }
            onLocationSelect={(location) =>
              setFormData((prev) => ({
                ...prev,
                location: location.address,
                locationDetails: location,
              }))
            }
          />

          <ImageUpload
            value={formData.imageUrl}
            onChange={(url) => {
              setFormData((prev) => ({ ...prev, imageUrl: url }));
            }}
          />

          <CategorySelector
            selectedCategories={formData.categories}
            onCategoriesChange={(categories) =>
              setFormData((prev) => ({ ...prev, categories }))
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-sm font-medium">
                Start Date
              </Label>
              <Calendar
                id="startDate"
                mode="single"
                selected={
                  formData.startDate
                    ? new Date(formData.startDate + "T12:00:00Z")
                    : undefined
                }
                onSelect={(date) => {
                  if (date) {
                    // Create date in UTC noon to avoid timezone issues
                    const selectedDate = new Date(
                      Date.UTC(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate(),
                        12,
                        0,
                        0,
                        0
                      )
                    );
                    setFormData((prev) => ({
                      ...prev,
                      startDate: selectedDate.toISOString().split("T")[0],
                    }));
                  }
                }}
                disabled={(date) => {
                  const today = new Date();
                  today.setUTCHours(0, 0, 0, 0);
                  return date < today;
                }}
                className="rounded-md border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-sm font-medium">
                End Date
              </Label>
              <Calendar
                id="endDate"
                mode="single"
                selected={
                  formData.endDate
                    ? new Date(formData.endDate + "T12:00:00Z")
                    : undefined
                }
                onSelect={(date) => {
                  if (date) {
                    // Create date in UTC noon to avoid timezone issues
                    const selectedDate = new Date(
                      Date.UTC(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate(),
                        12,
                        0,
                        0,
                        0
                      )
                    );
                    setFormData((prev) => ({
                      ...prev,
                      endDate: selectedDate.toISOString().split("T")[0],
                    }));
                  }
                }}
                disabled={(date) => {
                  const startDate = formData.startDate
                    ? new Date(formData.startDate + "T12:00:00Z")
                    : new Date();
                  startDate.setUTCHours(0, 0, 0, 0);
                  return date < startDate;
                }}
                className="rounded-md border"
              />
            </div>
          </div>

          {/* Only show time fields for time-based events or if times are already set */}
          {(event.kind === 31923 || formData.startTime || formData.endTime) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Start Time {event.kind === 31922 && "(Optional)"}</Label>
                <TimePicker
                  value={formData.startTime}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, startTime: value }))
                  }
                />
              </div>
              <div>
                <Label>End Time {event.kind === 31922 && "(Optional)"}</Label>
                <TimePicker
                  value={formData.endTime}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, endTime: value }))
                  }
                />
              </div>
            </div>
          )}

          {/* Only show timezone for time-based events */}
          {event.kind === 31923 && (
            <div>
              <Label>Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, timezone: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {commonTimezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <PaidTicketForm
            initialTicketInfo={formData.ticketInfo}
            onTicketInfoChange={(ticketInfo) =>
              setFormData((prev) => ({ ...prev, ticketInfo }))
            }
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}