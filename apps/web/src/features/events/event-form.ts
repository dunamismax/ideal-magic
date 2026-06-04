import type { EventVisibility } from "@/db/scopes";

export type CreateEventInput = {
  playgroupId: string;
  title: string;
  startsAt: string;
  description: string;
  visibility: EventVisibility;
};

export type CreateEventValidationResult =
  | {
      ok: true;
      input: Omit<CreateEventInput, "startsAt"> & {
        startsAt: Date;
      };
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof CreateEventInput, string>>;
      fields: CreateEventInput;
    };

const maxEventTitleLength = 100;
const maxEventDescriptionLength = 1_000;
const eventVisibilities = ["members", "invite_only", "public_safe"] as const;

export function validateCreateEventInput(
  rawInput: Partial<
    Record<keyof CreateEventInput, FormDataEntryValue | string>
  >,
  options: { now?: Date } = {},
): CreateEventValidationResult {
  const fields: CreateEventInput = {
    playgroupId: normalizeText(rawInput.playgroupId),
    title: normalizeText(rawInput.title),
    startsAt: String(rawInput.startsAt ?? "").trim(),
    description: normalizeText(rawInput.description),
    visibility: String(rawInput.visibility ?? "") as EventVisibility,
  };
  const fieldErrors: Partial<Record<keyof CreateEventInput, string>> = {};
  const parsedStartsAt = parseStartsAt(fields.startsAt);

  if (!isUuid(fields.playgroupId)) {
    fieldErrors.playgroupId = "Choose a playgroup.";
  }

  if (!fields.title) {
    fieldErrors.title = "Title is required.";
  } else if (fields.title.length > maxEventTitleLength) {
    fieldErrors.title = `Use ${maxEventTitleLength} characters or fewer.`;
  }

  if (!parsedStartsAt) {
    fieldErrors.startsAt = "Choose a valid date and time.";
  } else if (parsedStartsAt <= (options.now ?? new Date())) {
    fieldErrors.startsAt = "Choose a future date and time.";
  }

  if (fields.description.length > maxEventDescriptionLength) {
    fieldErrors.description = `Use ${maxEventDescriptionLength} characters or fewer.`;
  }

  if (!includesString(eventVisibilities, fields.visibility)) {
    fieldErrors.visibility = "Choose a visibility.";
  }

  if (Object.keys(fieldErrors).length > 0 || !parsedStartsAt) {
    return {
      ok: false,
      fieldErrors,
      fields,
    };
  }

  return {
    ok: true,
    input: {
      playgroupId: fields.playgroupId,
      title: fields.title,
      startsAt: parsedStartsAt,
      description: fields.description,
      visibility: fields.visibility,
    },
  };
}

function normalizeText(value: FormDataEntryValue | string | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function parseStartsAt(value: string) {
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
