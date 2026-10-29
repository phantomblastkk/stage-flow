export type EventStatus = "draft" | "published" | "cancelled" | "completed";

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  starts_at: string;
  ends_at: string | null;
  status: EventStatus;
  show_publicly: boolean;
};

export type GuestShow = {
  event_id: string;
  title: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
  ends_at: string | null;
  event_status: EventStatus;
  organizer_name: string;
};

export type CitySuggestion = { id: number; name: string; state_code: string };
export type VenueSuggestion = {
  id: string;
  name: string;
  address: string | null;
  city_name: string | null;
  state_code: string | null;
};

export type EventDraft = {
  title: string;
  description: string;
  venue: string;
  venueId: string | null;
  city: string;
  startsAt: string;
  endsAt: string;
  publicly: boolean;
};

export type AgendaWindow = { from: string; to: string };
export type AgendaCursor = { startsAt: string; id: string };
export type AgendaSource = "owned" | "accepted";

export type ArtistPreviewShow = Pick<EventRow,"id"|"title"|"venue"|"city"|"starts_at"> & {
  flyer_path?: string | null;
  flyer_settings?: unknown;
};
