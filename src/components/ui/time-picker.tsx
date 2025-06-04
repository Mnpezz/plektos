import * as React from "react";
import { Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [hours, setHours] = React.useState<number[]>([]);
  const [minutes, setMinutes] = React.useState<number[]>([]);
  const [selectedHour, setSelectedHour] = React.useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = React.useState<number | null>(
    null
  );
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    // Generate hours (0-23)
    setHours(Array.from({ length: 24 }, (_, i) => i));
    // Generate minutes (0-59)
    setMinutes(Array.from({ length: 60 }, (_, i) => i));
  }, []);

  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(":").map(Number);
      setSelectedHour(h);
      setSelectedMinute(m);
    }
  }, [value]);

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    if (selectedMinute !== null) {
      onChange(
        `${hour.toString().padStart(2, "0")}:${selectedMinute
          .toString()
          .padStart(2, "0")}`
      );
    }
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    if (selectedHour !== null) {
      onChange(
        `${selectedHour.toString().padStart(2, "0")}:${minute
          .toString()
          .padStart(2, "0")}`
      );
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <Clock className="mr-2 h-4 w-4" />
            {value || <span>Pick a time</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Hours</Label>
                <div className="grid grid-cols-4 gap-1 max-h-[200px] overflow-y-auto">
                  {hours.map((hour) => (
                    <Button
                      key={hour}
                      variant={selectedHour === hour ? "default" : "outline"}
                      className="h-8 w-8 p-0"
                      onClick={() => handleHourSelect(hour)}
                    >
                      {hour.toString().padStart(2, "0")}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Minutes</Label>
                <div className="grid grid-cols-4 gap-1 max-h-[200px] overflow-y-auto">
                  {minutes.map((minute) => (
                    <Button
                      key={minute}
                      variant={
                        selectedMinute === minute ? "default" : "outline"
                      }
                      className="h-8 w-8 p-0"
                      onClick={() => handleMinuteSelect(minute)}
                    >
                      {minute.toString().padStart(2, "0")}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
