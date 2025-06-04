import type { DateBasedEvent, TimeBasedEvent } from "./eventTypes";

interface LightningInvoice {
  pr: string; // Payment request
  successAction?: {
    tag: string;
    description: string;
    url?: string;
  };
}

export async function generateLightningInvoice(
  event: DateBasedEvent | TimeBasedEvent,
  amount: number,
  description: string
): Promise<LightningInvoice> {
  // Get the event host's Lightning address from their metadata
  const hostLightningAddress = event.tags.find(
    (tag) => tag[0] === "lud16"
  )?.[1];

  if (!hostLightningAddress) {
    throw new Error("Event host has no Lightning address configured");
  }

  // Convert Lightning address to LNURL
  const lnurl = await fetch(
    `https://api.lnurl.to/v1/lnurl/${hostLightningAddress}`
  )
    .then((res) => res.json())
    .then((data) => data.lnurl);

  // Generate invoice using LNURL
  const response = await fetch(lnurl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: amount * 1000, // Convert to sats
      description,
      successAction: {
        tag: "url",
        description: "View event details",
        url: `https://zather.app/event/${event.id}`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate Lightning invoice");
  }

  return response.json();
}

export function formatAmount(amount: number): string {
  return `${amount.toLocaleString()} sats`;
}

export function validateLightningAddress(address: string): boolean {
  // Basic validation for Lightning addresses (user@domain.tld)
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(address);
}
