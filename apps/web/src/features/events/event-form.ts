import type { EventStatus, EventVisibility } from "@/db/scopes";

export type CreateEventInput = {
  playgroupId: string;
  title: string;
  startsAt: string;
  description: string;
  visibility: EventVisibility;
};

export type UpdateEventInput = Omit<CreateEventInput, "playgroupId"> & {
  eventId: string;
};

export type EventStatusInput = {
  eventId: string;
  status: Extract<EventStatus, "cancelled" | "archived">;
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

export type UpdateEventValidationResult =
  | {
      ok: true;
      input: Omit<UpdateEventInput, "startsAt"> & {
        startsAt: Date;
      };
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof UpdateEventInput, string>>;
      fields: UpdateEventInput;
    };

export type EventStatusValidationResult =
  | {
      ok: true;
      input: EventStatusInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof EventStatusInput, string>>;
      fields: EventStatusInput;
    };

const maxEventTitleLength = 100;
const maxEventDescriptionLength = 1_000;
const eventVisibilities = ["members", "invite_only", "public_safe"] as const;
const manageableEventStatuses = ["cancelled", "archived"] as const;

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

export function validateUpdateEventInput(
  rawInput: Partial<
    Record<keyof UpdateEventInput, FormDataEntryValue | string>
  >,
  options: { now?: Date } = {},
): UpdateEventValidationResult {
  const createValidation = validateCreateEventInput(
    {
      playgroupId: "00000000-0000-4000-8000-000000000000",
      title: rawInput.title,
      startsAt: rawInput.startsAt,
      description: rawInput.description,
      visibility: rawInput.visibility,
    },
    options,
  );
  const eventId = normalizeText(rawInput.eventId);

  if (!createValidation.ok) {
    const fields: UpdateEventInput = {
      eventId,
      title: createValidation.fields.title,
      startsAt: createValidation.fields.startsAt,
      description: createValidation.fields.description,
      visibility: createValidation.fields.visibility,
    };
    const fieldErrors: Partial<Record<keyof UpdateEventInput, string>> = {};

    for (const fieldName of [
      "title",
      "startsAt",
      "description",
      "visibility",
    ] as const) {
      if (createValidation.fieldErrors[fieldName]) {
        fieldErrors[fieldName] = createValidation.fieldErrors[fieldName];
      }
    }

    if (!isUuid(eventId)) {
      fieldErrors.eventId = "Choose an event.";
    }

    return {
      ok: false,
      fieldErrors,
      fields,
    };
  }

  if (!isUuid(eventId)) {
    return {
      ok: false,
      fieldErrors: {
        eventId: "Choose an event.",
      },
      fields: {
        eventId,
        title: createValidation.input.title,
        startsAt: String(rawInput.startsAt ?? "").trim(),
        description: createValidation.input.description,
        visibility: createValidation.input.visibility,
      },
    };
  }

  return {
    ok: true,
    input: {
      eventId,
      title: createValidation.input.title,
      startsAt: createValidation.input.startsAt,
      description: createValidation.input.description,
      visibility: createValidation.input.visibility,
    },
  };
}

export function validateEventStatusInput(
  rawInput: Partial<
    Record<keyof EventStatusInput, FormDataEntryValue | string>
  >,
): EventStatusValidationResult {
  const fields: EventStatusInput = {
    eventId: normalizeText(rawInput.eventId),
    status: String(rawInput.status ?? "") as EventStatusInput["status"],
  };
  const fieldErrors: Partial<Record<keyof EventStatusInput, string>> = {};

  if (!isUuid(fields.eventId)) {
    fieldErrors.eventId = "Choose an event.";
  }

  if (!includesString(manageableEventStatuses, fields.status)) {
    fieldErrors.status = "Choose an event action.";
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
    input: fields,
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
