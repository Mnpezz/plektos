import { useState, useRef, useEffect } from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBlossomUpload } from "@/hooks/useBlossomUpload";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [uploadTab, setUploadTab] = useState<"upload" | "url">("upload");
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useBlossomUpload();

  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    try {
      const result = await uploadFile(file);
      console.log("Image upload result:", result);
      console.log("Calling onChange with URL:", result.url);
      onChange(result.url);
      setPreviewUrl(result.previewUrl);
    } catch (error) {
      // Error handling is done in the hook
      console.error("Upload failed:", error);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const removeImage = () => {
    console.log("Removing image");
    onChange("");
    setPreviewUrl("");
  };

  // Update preview URL when value changes
  useEffect(() => {
    if (value) {
      setPreviewUrl(value);
    }
  }, [value]);

  const handleBoxClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-4">
      <Tabs
        value={uploadTab}
        onValueChange={(v) => setUploadTab(v as "upload" | "url")}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload Image</TabsTrigger>
          <TabsTrigger value="url">Image URL</TabsTrigger>
        </TabsList>
        <TabsContent value="upload">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              dragOver && "border-primary bg-primary/5",
              isUploading && "opacity-50 cursor-not-allowed"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBoxClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleBoxClick();
              }
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/*"
              className="hidden"
              disabled={isUploading}
            />
            <div className="space-y-4">
              <div className="flex justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {isUploading ? (
                    "Uploading..."
                  ) : (
                    <>Drag and drop your image here, or click to browse</>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Max file size: 10MB
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="url">
          <div className="space-y-4">
            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                value={value}
                onChange={(e) => {
                  onChange(e.target.value);
                  setPreviewUrl(e.target.value);
                }}
                placeholder="https://..."
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Image Preview */}
      {(previewUrl || value) && (
        <Card>
          <CardContent className="p-4">
            <div className="relative aspect-video">
              <img
                src={previewUrl || value}
                alt="Preview"
                className="object-contain w-full h-full rounded-md"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={removeImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
