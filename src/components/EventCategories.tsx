import { useState } from "react";
import { ChevronDown, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface EventCategoriesProps {
  categories: string[];
}

export function EventCategories({ categories }: EventCategoriesProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (categories.length === 0) {
    return null;
  }

  return (
    <div>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 hover:bg-transparent"
          >
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span className="font-semibold">Categories</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isOpen && "transform rotate-180"
                )}
              />
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((category, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {category}
              </Badge>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}