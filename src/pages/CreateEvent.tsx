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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getGroupedTimezoneOptions,
  getUserTimezone,
  createTimestampInTimezone,
} from "@/lib/eventTimezone";
import { PartyPopper, Target, FileText, Calendar as CalendarIcon, Flag, Clock, Globe, Rocket } from "lucide-react";

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
    timezone: getUserTimezone(), // Default to user's timezone
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

      console.log("Creating event with:", {
        hasTime,
        eventKind,
        startDate: formData.startDate,
        startTime: formData.startTime,
        endDate: formData.endDate,
        endTime: formData.endTime,
        timezone: formData.timezone
      });

      // Format start and end timestamps based on event kind
      let startTimestamp: string;
      let endTimestamp: string | undefined;

      if (hasTime) {
        // For time-based events (kind 31923), use Unix timestamps with specific times
        if (formData.startTime) {
          startTimestamp = createTimestampInTimezone(
            formData.startDate,
            formData.startTime,
            formData.timezone
          ).toString();
        } else {
          startTimestamp = Math.floor(
            new Date(formData.startDate + "T00:00:00").getTime() / 1000
          ).toString();
        }

        if (formData.endTime) {
          endTimestamp = createTimestampInTimezone(
            formData.endDate,
            formData.endTime,
            formData.timezone
          ).toString();
        } else {
          endTimestamp = Math.floor(
            new Date(formData.endDate + "T00:00:00").getTime() / 1000
          ).toString();
        }
      } else {
        // For date-only events (kind 31922), use YYYY-MM-DD format as per NIP-52
        startTimestamp = formData.startDate; // Already in YYYY-MM-DD format
        endTimestamp = formData.endDate; // Already in YYYY-MM-DD format
      }

      // Create a unique identifier for the event
      const uniqueId = formData.title.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
      
      const tags = [
        ["d", uniqueId], // Unique identifier
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
      if (hasTime) {
        tags.push(["start_tzid", formData.timezone]);
        if (endTimestamp) {
          tags.push(["end_tzid", formData.timezone]);
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

      createEvent({
        kind: eventKind,
        content: formData.description,
        tags,
      }, {
        onSuccess: (event) => {
          toast.success("Event created successfully! It should appear on the home page shortly.");
          console.log("Event created with ID:", event.id);
          
          // Navigate back to home page where the user can see their new event
          navigate("/");
          setIsSubmitting(false);
        },
        onError: (error) => {
          toast.error("Failed to create event");
          console.error("Error creating event:", error);
          setIsSubmitting(false);
        }
      });
    } catch (error) {
      toast.error("Failed to create event");
      console.error("Error creating event:", error);
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container px-0 sm:px-4 py-2 sm:py-6">
        <div className="px-3 sm:px-0 text-center space-y-6 py-12">
          <div className="text-6xl">🎪</div>
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Create Amazing Events
            </h1>
            <p className="text-lg text-muted-foreground">
              Please log in to start creating unforgettable experiences for your community.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container px-0 sm:px-4 py-2 sm:py-6 space-y-6 sm:space-y-8">
      <div className="px-3 sm:px-0 text-center space-y-4">
        <div className="flex justify-center"><PartyPopper className="h-12 w-12 text-primary" /></div>
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Create Your Event
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            Bring people together and create unforgettable experiences
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto">
        <div className="space-y-3">
          <Label htmlFor="title" className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Event Title
          </Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="What's the name of your amazing event?"
            className="text-lg py-3 rounded-2xl border-2 focus:border-primary transition-all duration-200"
            required
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="description" className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Description
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Tell people what makes this event special..."
            className="min-h-32 rounded-2xl border-2 focus:border-primary transition-all duration-200 resize-none"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label htmlFor="startDate" className="text-lg font-semibold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" /> Start Date
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
              className="rounded-2xl border-2"
            />
          </div>
          <div className="space-y-3">
            <Label htmlFor="endDate" className="text-lg font-semibold flex items-center gap-2">
              <Flag className="h-5 w-5 text-primary" /> End Date
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
              className="rounded-2xl border-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Start Time (Optional)
            </Label>
            <TimePicker
              value={formData.startTime}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, startTime: value }))
              }
            />
          </div>
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> End Time (Optional)
            </Label>
            <TimePicker
              value={formData.endTime}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, endTime: value }))
              }
            />
          </div>
        </div>

        {(formData.startTime || formData.endTime) && (
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" /> Timezone
            </Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, timezone: value }))
              }
            >
              <SelectTrigger className="rounded-2xl border-2 py-3">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {getGroupedTimezoneOptions().map((group) => (
                  <div key={group.group}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                      {group.group}
                    </div>
                    {group.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <PaidTicketForm
          onTicketInfoChange={(ticketInfo) =>
            setFormData((prev) => ({ ...prev, ticketInfo }))
          }
        />

        <div className="flex justify-center pt-6">
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="px-12 py-4 text-lg font-semibold rounded-2xl bg-party-gradient hover:opacity-90 transition-all duration-200 hover:scale-105 shadow-lg"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating Your Event...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" /> Create Event
              </div>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
