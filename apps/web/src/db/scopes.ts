export type PlaygroupRole =
  | "owner"
  | "admin"
  | "member"
  | "host"
  | "guest"
  | "viewer";

export type EventVisibility = "members" | "invite_only" | "public_safe";
export type AddressVisibility = "rsvps" | "members" | "public" | "hidden";

export function canManagePlaygroup(role: PlaygroupRole) {
  return role === "owner" || role === "admin";
}

export function canManageEvent(role: PlaygroupRole) {
  return role === "owner" || role === "admin" || role === "host";
}

export function canSeeHostAddress(
  role: PlaygroupRole | null,
  visibility: AddressVisibility,
  rsvpStatus?: "yes" | "maybe" | "no" | "waitlist",
) {
  if (visibility === "public") {
    return true;
  }

  if (visibility === "hidden" || role === null) {
    return false;
  }

  if (visibility === "members") {
    return role !== "guest" && role !== "viewer";
  }

  return rsvpStatus === "yes" || rsvpStatus === "maybe";
}
