export type PlaygroupRole =
  | "owner"
  | "admin"
  | "member"
  | "host"
  | "guest"
  | "viewer";

export type EventVisibility = "members" | "invite_only" | "public_safe";
export type EventStatus = "scheduled" | "cancelled" | "archived";
export type AddressVisibility = "rsvps" | "members" | "public" | "hidden";

const playgroupMemberDirectoryRoles = ["owner", "admin", "host", "member"];

export function canManagePlaygroup(role: PlaygroupRole) {
  return role === "owner" || role === "admin";
}

export function canManageEvent(role: PlaygroupRole) {
  return role === "owner" || role === "admin" || role === "host";
}

export function canRsvpToEvent(role: PlaygroupRole) {
  return (
    role === "owner" || role === "admin" || role === "host" || role === "member"
  );
}

export function canViewPlaygroupMembers(role: PlaygroupRole) {
  return isPlaygroupMemberDirectoryRole(role);
}

export function isPlaygroupMemberDirectoryRole(
  role: PlaygroupRole,
): role is "owner" | "admin" | "host" | "member" {
  return playgroupMemberDirectoryRoles.includes(role);
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
