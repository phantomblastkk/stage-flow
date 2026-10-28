export type OfferLog = { amount: number; by_me: boolean; note: string | null; date: string };
export type FeeData = {
  status: "pending" | "accepted" | "declined" | "cancelled";
  is_owner: boolean;
  has_offer: boolean;
  last_amount: number | null;
  last_by_me: boolean | null;
  last_note: string | null;
  agreed_amount: number | null;
  history: OfferLog[];
};
