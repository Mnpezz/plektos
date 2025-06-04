import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PaidTicketForm } from "@/components/PaidTicketForm";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { LocationSearch } from "@/components/LocationSearch";

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
    hashtags: "",
    ticketInfo: {
      enabled: false,
      price: 0,
      lightningAddress: "",
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
        const startDate = new Date(formData.startDate);
        if (formData.startTime) {
          const [hours, minutes] = formData.startTime.split(":").map(Number);
          startDate.setHours(hours, minutes);
        }

        const endDate = new Date(formData.endDate);
        if (formData.endTime) {
          const [hours, minutes] = formData.endTime.split(":").map(Number);
          endDate.setHours(hours, minutes);
        }

        startTimestamp = Math.floor(startDate.getTime() / 1000).toString();
        endTimestamp = Math.floor(endDate.getTime() / 1000).toString();
      } else {
        // For date-only events (kind 31922), use Unix timestamps at start/end of day UTC
        const startDate = new Date(formData.startDate);
        // Set to midnight UTC
        startDate.setUTCHours(0, 0, 0, 0);
        startTimestamp = Math.floor(startDate.getTime() / 1000).toString();

        const endDate = new Date(formData.endDate);
        // Set to end of day UTC
        endDate.setUTCHours(23, 59, 59, 999);
        endTimestamp = Math.floor(endDate.getTime() / 1000).toString();
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
        tags.push(["image", formData.imageUrl]);
      }

      // Add hashtags if provided
      if (formData.hashtags) {
        // Split by comma and trim whitespace
        const hashtagList = formData.hashtags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);

        // Add each hashtag as a 't' tag
        for (const tag of hashtagList) {
          tags.push(["t", tag]);
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
              setFormData({ ...formData, title: e.target.value })
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
              setFormData({ ...formData, description: e.target.value })
            }
            required
          />
        </div>

        <LocationSearch
          value={formData.location}
          onChange={(value) => setFormData({ ...formData, location: value })}
          onLocationSelect={(location) =>
            setFormData({
              ...formData,
              location: location.address,
              locationDetails: location,
            })
          }
        />

        <div>
          <Label htmlFor="imageUrl">Image URL (Optional)</Label>
          <Input
            id="imageUrl"
            type="url"
            placeholder="https://example.com/image.jpg"
            value={formData.imageUrl}
            onChange={(e) =>
              setFormData({ ...formData, imageUrl: e.target.value })
            }
          />
        </div>

        <div>
          <Label htmlFor="hashtags">Hashtags (Optional)</Label>
          <Input
            id="hashtags"
            placeholder="comma, separated, tags"
            value={formData.hashtags}
            onChange={(e) =>
              setFormData({ ...formData, hashtags: e.target.value })
            }
          />
          <p className="text-sm text-muted-foreground mt-1">
            Separate multiple hashtags with commas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.startDate ? (
                    format(parseISO(formData.startDate), "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={
                    formData.startDate
                      ? parseISO(formData.startDate)
                      : undefined
                  }
                  onSelect={(date) =>
                    setFormData({
                      ...formData,
                      startDate: date ? format(date, "yyyy-MM-dd") : "",
                    })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Start Time (Optional)</Label>
            <TimePicker
              value={formData.startTime}
              onChange={(value) =>
                setFormData({ ...formData, startTime: value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.endDate ? (
                    format(parseISO(formData.endDate), "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={
                    formData.endDate ? parseISO(formData.endDate) : undefined
                  }
                  onSelect={(date) =>
                    setFormData({
                      ...formData,
                      endDate: date ? format(date, "yyyy-MM-dd") : "",
                    })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>End Time (Optional)</Label>
            <TimePicker
              value={formData.endTime}
              onChange={(value) => setFormData({ ...formData, endTime: value })}
            />
          </div>
        </div>

        <PaidTicketForm
          onTicketInfoChange={(ticketInfo) =>
            setFormData({ ...formData, ticketInfo })
          }
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Event"}
        </Button>
      </form>
    </div>
  );
}
