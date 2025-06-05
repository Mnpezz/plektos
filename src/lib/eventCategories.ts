export const EVENT_CATEGORIES = [
  "Music",
  "Business & professional", 
  "Food & drink",
  "Community & culture",
  "Performing & visual arts",
  "Film, media, & entertainment",
  "Health & wellness",
  "Sports & fitness",
  "Science & technology",
  "Travel & outdoor",
  "Charity & causes",
  "Religion & spirituality",
  "Family & education",
  "Seasonal & holiday",
  "Government & politics",
  "Fashion & beauty",
  "Home & lifestyle",
  "Auto, boat & air",
  "Hobbies & special interest",
  "School activities",
  "Other"
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number];