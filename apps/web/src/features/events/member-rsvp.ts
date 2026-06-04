import type { RsvpStatus } from "@/db/queries/event-planning";

export type MemberRsvpInput = {
  eventId: string;
  status: RsvpStatus;
  arrivalTime: string;
  leavingTime: string;
};

export type MemberRsvpValidationResult =
  | {
      ok: true;
      input: Omit<MemberRsvpInput, "arrivalTime" | "leavingTime"> & {
        arrivalTime: Date | null;
        leavingTime: Date | null;
      };
      fields: MemberRsvpInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof MemberRsvpInput, string>>;
      fields: MemberRsvpInput;
    };

export const memberRsvpStatuses = ["yes", "maybe", "no", "waitlist"] as const;

export function validateMemberRsvpInput(
  rawInput: Partial<Record<keyof MemberRsvpInput, FormDataEntryValue | string>>,
): MemberRsvpValidationResult {
  const fields: MemberRsvpInput = {
    eventId: normalizeText(rawInput.eventId),
    status: String(rawInput.status ?? "") as RsvpStatus,
    arrivalTime: normalizeDateTimeText(rawInput.arrivalTime),
    leavingTime: normalizeDateTimeText(rawInput.leavingTime),
  };
  const fieldErrors: Partial<Record<keyof MemberRsvpInput, string>> = {};
  const arrivalTime = parseOptionalDateTime(fields.arrivalTime);
  const leavingTime = parseOptionalDateTime(fields.leavingTime);

  if (!isUuid(fields.eventId)) {
    fieldErrors.eventId = "Choose an event.";
  }

  if (!includesString(memberRsvpStatuses, fields.status)) {
    fieldErrors.status = "Choose an RSVP status.";
  }

  if (fields.arrivalTime && !arrivalTime) {
    fieldErrors.arrivalTime = "Choose a valid arrival time.";
  }

  if (fields.leavingTime && !leavingTime) {
    fieldErrors.leavingTime = "Choose a valid leaving time.";
  }

  if (
    arrivalTime &&
    leavingTime &&
    leavingTime.getTime() <= arrivalTime.getTime()
  ) {
    fieldErrors.leavingTime = "Leaving time must be after arrival.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      fields,
    };
  }

  return {
    ok: true,
    fields,
    input: {
      eventId: fields.eventId,
      status: fields.status,
      arrivalTime,
      leavingTime,
    },
  };
}

function normalizeText(value: FormDataEntryValue | string | undefined) {
  return String(value ?? "").trim();
}

function normalizeDateTimeText(value: FormDataEntryValue | string | undefined) {
  return String(value ?? "").trim();
}

function parseOptionalDateTime(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.valueOf()) ? null : date;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function includesString<const T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return values.includes(value as T);
}
