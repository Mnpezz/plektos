import { useState } from "react";
import { BlossomUploader } from "@nostrify/nostrify/uploaders";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostr } from "@nostrify/react";
import { toast } from "sonner";

export interface UploadResult {
  url: string;
  previewUrl: string;
}

// Default fallback servers
const DEFAULT_SERVERS = ["https://blossom.primal.net/", "https://blossom.band"];

export function useBlossomUpload() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const [isUploading, setIsUploading] = useState(false);

  const getUserBlossomServers = async (): Promise<string[]> => {
    if (!user) {
      console.log("No user logged in, using default servers");
      return DEFAULT_SERVERS;
    }

    try {
      console.log("Querying for blossom server list for user:", user.pubkey);

      // Query for the user's blossom server list (kind 10063)
      const events = await nostr.query(
        [{ kinds: [10063], authors: [user.pubkey] }],
        { signal: AbortSignal.timeout(5000) }
      );

      console.log("Received events:", events.length);

      // If no events found, return default servers
      if (events.length === 0) {
        console.log("No blossom server list found, using defaults");
        return DEFAULT_SERVERS;
      }

      // Get the most recent event
      const event = events[0];
      console.log("Most recent blossom server list event:", {
        id: event.id,
        created_at: new Date(event.created_at * 1000).toISOString(),
        tags: event.tags,
      });

      // Extract servers from tags
      const serverTags = event.tags.filter((tag) => tag[0] === "server");

      if (serverTags.length === 0) {
        console.warn("No server tags found in blossom server list");
        return DEFAULT_SERVERS;
      }

      // Extract and validate server URLs
      const validServers = serverTags
        .map((tag) => tag[1])
        .filter((url) => {
          const isValid = typeof url === "string" && url.trim() !== "";
          if (!isValid) {
            console.warn("Invalid server URL in list:", url);
          }
          return isValid;
        })
        .map((url) => {
          const trimmed = url.trim();
          return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
        });

      if (validServers.length === 0) {
        console.warn("No valid servers in blossom server list");
        return DEFAULT_SERVERS;
      }

      console.log("Using custom blossom servers:", validServers);
      return validServers;
    } catch (error) {
      console.warn("Failed to fetch blossom server list:", error);
      return DEFAULT_SERVERS;
    }
  };

  const uploadFile = async (file: File): Promise<UploadResult> => {
    if (!user?.signer) {
      throw new Error("User must be logged in to upload files");
    }

    setIsUploading(true);

    try {
      // Get user's blossom servers or fall back to defaults
      const servers = await getUserBlossomServers();

      // Create the BlossomUploader with the user's signer
      const uploader = new BlossomUploader({
        servers,
        signer: user.signer,
        expiresIn: 120_000, // 2 minutes expiry
      });

      // Upload the file and get the NIP-94 compatible tags
      const tags = await uploader.upload(file);

      // The first tag should contain the URL
      const urlTag = tags.find((tag) => tag[0] === "url");
      if (!urlTag || !urlTag[1]) {
        throw new Error("No URL returned from upload");
      }

      const url = urlTag[1];

      // Log additional metadata for debugging
      const sizeTag = tags.find((tag) => tag[0] === "size");
      const mimeTag = tags.find((tag) => tag[0] === "m");
      console.log("Upload successful:", {
        url,
        size: sizeTag?.[1],
        mimeType: mimeTag?.[1],
        servers,
      });

      toast.success("Image uploaded successfully!");

      return {
        url,
        previewUrl: url,
      };
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image. Please try again.");
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadFile,
    isUploading,
  };
}
