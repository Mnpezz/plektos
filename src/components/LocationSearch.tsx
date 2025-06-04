import { useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { search } from "@/lib/nominatim";

interface LocationSearchProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect?: (location: {
    name: string;
    address: string;
    placeId: string;
    lat: number;
    lng: number;
  }) => void;
  className?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

export function LocationSearch({
  value,
  onChange,
  onLocationSelect,
  className,
}: LocationSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    if (!query) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await search(query);
      setSearchResults(results || []);
    } catch (error) {
      console.error("Error searching locations:", error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelect = (result: NominatimResult) => {
    const location = {
      name: result.display_name.split(",")[0],
      address: result.display_name,
      placeId: result.place_id.toString(),
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };

    onChange(location.address);
    onLocationSelect?.(location);
    setOpen(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>Location</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value ? (
              <span className="truncate">{value}</span>
            ) : (
              <span className="text-muted-foreground">
                Search for a location...
              </span>
            )}
            <MapPin className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command>
            <CommandInput
              placeholder="Search locations..."
              value={value}
              onValueChange={(search) => {
                onChange(search);
                handleSearch(search);
              }}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  "No locations found."
                )}
              </CommandEmpty>
              <CommandGroup>
                {searchResults.map((result) => (
                  <CommandItem
                    key={result.place_id}
                    value={result.display_name}
                    onSelect={() => handleSelect(result)}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    <span>{result.display_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
