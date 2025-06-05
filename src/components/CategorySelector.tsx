import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EVENT_CATEGORIES, type EventCategory } from "@/lib/eventCategories";

interface CategorySelectorProps {
  selectedCategories: EventCategory[];
  onCategoriesChange: (categories: EventCategory[]) => void;
  maxSelections?: number;
}

export function CategorySelector({
  selectedCategories,
  onCategoriesChange,
  maxSelections = 5,
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleCategory = (category: EventCategory) => {
    if (selectedCategories.includes(category)) {
      // Remove category
      onCategoriesChange(selectedCategories.filter((c) => c !== category));
    } else if (selectedCategories.length < maxSelections) {
      // Add category if under limit
      onCategoriesChange([...selectedCategories, category]);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Categories (Optional)</Label>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between text-left font-normal"
          >
            <div className="flex items-center gap-2">
              {selectedCategories.length === 0 ? (
                <span className="text-muted-foreground">
                  Select categories...
                </span>
              ) : (
                <span>
                  {selectedCategories.length}{" "}
                  {selectedCategories.length === 1 ? "category" : "categories"}{" "}
                  selected
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isOpen && "transform rotate-180"
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 p-4 border rounded-lg bg-muted/50 space-y-2 max-h-64 overflow-y-auto">
            <div className="text-sm text-muted-foreground mb-3">
              Select up to {maxSelections} categories that best describe your
              event:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVENT_CATEGORIES.map((category) => (
                <Button
                  key={category}
                  type="button"
                  variant={
                    selectedCategories.includes(category) ? "default" : "ghost"
                  }
                  size="sm"
                  className="justify-start h-auto py-2 px-3"
                  onClick={() => toggleCategory(category)}
                  disabled={
                    !selectedCategories.includes(category) &&
                    selectedCategories.length >= maxSelections
                  }
                >
                  <div className="flex items-center gap-2 w-full">
                    <div
                      className={cn(
                        "h-4 w-4 border rounded flex-shrink-0 flex items-center justify-center",
                        selectedCategories.includes(category)
                          ? "bg-primary border-primary"
                          : "border-muted-foreground"
                      )}
                    >
                      {selectedCategories.includes(category) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="text-sm text-left">{category}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedCategories.map((category) => (
            <Badge
              key={category}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => toggleCategory(category)}
            >
              {category} ×
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Categories help people find your event. You can select up to{" "}
        {maxSelections}.
      </p>
    </div>
  );
}
