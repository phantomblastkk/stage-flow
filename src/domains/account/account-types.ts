export type AccountProfile = {
  id: string; role: "musician" | "producer";
  is_artist: boolean; is_producer: boolean; is_singer: boolean; is_musician: boolean;
  artist_kind: "lead" | "support" | null; display_name: string; username: string | null;
  city: string | null; is_public: boolean; artist_avatar_path: string | null;
};
export type AccountSnapshot = {
  status: "loading" | "ready" | "signed_out" | "error";
  user: { id: string; email: string | null } | null;
  profile: AccountProfile | null;
  permissions: { isOwnerAdmin: boolean; partnerHouseCount: number };
  epoch: number; refreshing: boolean; error: string; verifiedAt: number;
};
