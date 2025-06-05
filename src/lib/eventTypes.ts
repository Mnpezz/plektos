export interface BaseEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
}

export interface DateBasedEvent extends BaseEvent {
  kind: 31922;
  tags: [
    ["d", string],
    ["title", string],
    ["start", string], // ISO 8601 YYYY-MM-DD format
    ["end", string], // ISO 8601 YYYY-MM-DD format
    ...string[][]
  ];
}

export interface TimeBasedEvent extends BaseEvent {
  kind: 31923;
  tags: [
    ["d", string],
    ["title", string],
    ["start", string], // Unix timestamp in seconds
    ["end", string], // Unix timestamp in seconds
    ...string[][]
  ];
}

export interface CalendarEvent extends BaseEvent {
  kind: 31924;
  tags: [["d", string], ["title", string], ...string[][]];
}

export interface EventRSVP extends BaseEvent {
  kind: 31925;
  tags: [
    ["a", string],
    ["d", string],
    ["status", "accepted" | "declined" | "tentative"],
    ...string[][]
  ];
}
