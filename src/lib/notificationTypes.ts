export interface Notification {
  id: string;
  type: 'rsvp' | 'comment' | 'zap';
  timestamp: number;
  read: boolean;
  eventId: string;
  eventTitle: string;
  fromPubkey: string;
  // Optional properties for different notification types
  status?: 'accepted' | 'declined' | 'tentative'; // for RSVP
  commentContent?: string; // for comment
  commentId?: string; // for comment
  amount?: number; // for zap
  comment?: string; // for zap
}