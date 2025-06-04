import QRCode from "qrcode";
import type { DateBasedEvent, TimeBasedEvent } from "./eventTypes";

export async function generateQRCode(
  event: DateBasedEvent | TimeBasedEvent
): Promise<string> {
  const eventUrl = `nostr:${event.id}`;
  return await QRCode.toDataURL(eventUrl);
}

export function downloadQRCode(event: DateBasedEvent | TimeBasedEvent) {
  generateQRCode(event).then((dataUrl) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${
      event.tags.find((tag) => tag[0] === "title")?.[1] || "event"
    }.png`;
    a.click();
  });
}
