import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

export function CreateEvent() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    locationDetails: {
      name: "",
      address: "",
      placeId: "",
      lat: 0,
      lng: 0,
    },
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    imageUrl: "",
    categories: [] as EventCategory[],
    ticketInfo: {
      enabled: false,
      price: 0,
      lightningAddress: "",
    },
  });

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

    console.log("Form data at submission:", {
      imageUrl: formData.imageUrl,
    });

    setIsSubmitting(true);
    try {
      // Determine if this is a time-based event
      const hasTime = formData.startTime || formData.endTime;
      const eventKind = hasTime ? 31923 : 31922;

      // Get the user's timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Format start and end timestamps based on event kind
      let startTimestamp: string;
      let endTimestamp: string | undefined;

      if (hasTime) {
        // For time-based events (kind 31923), use Unix timestamps with specific times
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
        // For date-only events (kind 31922), use Unix timestamps at start/end of day UTC
        const startDateTime = new Date(formData.startDate);
        // Set to midnight UTC
        startDateTime.setUTCHours(0, 0, 0, 0);
        startTimestamp = Math.floor(startDateTime.getTime() / 1000).toString();

        const endDateTime = new Date(formData.endDate);
        // Set to end of day UTC
        endDateTime.setUTCHours(23, 59, 59, 999);
        endTimestamp = Math.floor(endDateTime.getTime() / 1000).toString();
      }

      const tags = [
        ["d", formData.title.toLowerCase().replace(/\s+/g, "-")], // Unique identifier
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

      // Add start and end timestamps (both kinds use Unix timestamps)
      tags.push(["start", startTimestamp]);
      if (endTimestamp) {
        tags.push(["end", endTimestamp]);
      }

      // Add timezone tags only for time-based events (kind 31923)
      if (hasTime) {
        tags.push(["start_tzid", timezone]);
        if (endTimestamp) {
          tags.push(["end_tzid", timezone]);
        }
      }

      // Add image URL if provided
      if (formData.imageUrl) {
        console.log("Adding image to event:", {
          imageUrl: formData.imageUrl,
        });
        // Add the image tag
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

      await createEvent({
        kind: eventKind,
        content: formData.description,
        tags,
      });

      toast.success("Event created successfully!");
      navigate("/");
    } catch (error) {
      toast.error("Failed to create event");
      console.error("Error creating event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container max-w-2xl py-8">
        <h1 className="text-2xl font-bold mb-4">Create Event</h1>
        <p>Please log in to create an event.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Create Event</h1>
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
            console.log("Setting image URL in form data:", url);
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Start Time (Optional)</Label>
            <TimePicker
              value={formData.startTime}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, startTime: value }))
              }
            />
          </div>
          <div>
            <Label>End Time (Optional)</Label>
            <TimePicker
              value={formData.endTime}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, endTime: value }))
              }
            />
          </div>
        </div>

        <PaidTicketForm
          onTicketInfoChange={(ticketInfo) =>
            setFormData((prev) => ({ ...prev, ticketInfo }))
          }
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Event"}
        </Button>
      </form>
    </div>
  );
}
