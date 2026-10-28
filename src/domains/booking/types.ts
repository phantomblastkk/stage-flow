export type Invite = {
  id: string;status: "pending" | "accepted" | "declined" | "cancelled";
  message: string | null;created_at: string;responded_at: string | null;
  event_id: string;event_title: string;event_starts_at: string;
  event_venue: string | null;event_city: string | null;organizer_name: string;
};
export type Thread = {
  id: string;requested_date: string | null;event_id: string | null;
  availability: "awaiting" | "available" | "unavailable" | "ask_later";
  last_message_at: string;other_id: string;other_name: string;
  acting_as: "requester" | "musician";unread: number;last_message: string | null;
};
export type Message = { id: string;body: string;is_mine: boolean;created_at: string };
