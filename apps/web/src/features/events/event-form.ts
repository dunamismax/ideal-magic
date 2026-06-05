import type {
  AddressVisibility,
  EventStatus,
  EventVisibility,
} from "@/db/scopes";

export type CreateEventInput = {
  playgroupId: string;
  title: string;
  startsAt: string;
  description: string;
  visibility: EventVisibility;
  locationId: string;
  addressVisibility: AddressVisibility;
};

export type UpdateEventInput = Omit<CreateEventInput, "playgroupId"> & {
  eventId: string;
};

export type EventStatusInput = {
  eventId: string;
  status: Extract<EventStatus, "cancelled" | "archived">;
};

export type HostLocationInput = {
  locationId?: string;
  playgroupId: string;
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  notes: string;
};

export type ArchiveHostLocationInput = {
  locationId: string;
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

export type HostLocationValidationResult =
  | {
      ok: true;
      input: HostLocationInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof HostLocationInput, string>>;
      fields: HostLocationInput;
    };

export type ArchiveHostLocationValidationResult =
  | {
      ok: true;
      input: ArchiveHostLocationInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof ArchiveHostLocationInput, string>>;
      fields: ArchiveHostLocationInput;
    };

const maxEventTitleLength = 100;
const maxEventDescriptionLength = 1_000;
const maxLocationNameLength = 100;
const maxAddressLineLength = 180;
const maxLocationNotesLength = 1_000;
const eventVisibilities = ["members", "invite_only", "public_safe"] as const;
const addressVisibilities = ["rsvps", "members", "public", "hidden"] as const;
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
    locationId: normalizeText(rawInput.locationId),
    addressVisibility: String(
      rawInput.addressVisibility ?? "",
    ) as AddressVisibility,
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

  if (fields.locationId && !isUuid(fields.locationId)) {
    fieldErrors.locationId = "Choose a saved location.";
  }

  if (!includesString(addressVisibilities, fields.addressVisibility)) {
    fieldErrors.addressVisibility = "Choose address visibility.";
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
      locationId: fields.locationId,
      addressVisibility: fields.addressVisibility,
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
      locationId: rawInput.locationId,
      addressVisibility: rawInput.addressVisibility,
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
      locationId: createValidation.fields.locationId,
      addressVisibility: createValidation.fields.addressVisibility,
    };
    const fieldErrors: Partial<Record<keyof UpdateEventInput, string>> = {};

    for (const fieldName of [
      "title",
      "startsAt",
      "description",
      "visibility",
      "locationId",
      "addressVisibility",
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
        locationId: createValidation.input.locationId,
        addressVisibility: createValidation.input.addressVisibility,
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
      locationId: createValidation.input.locationId,
      addressVisibility: createValidation.input.addressVisibility,
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

export function validateHostLocationInput(
  rawInput: Partial<
    Record<keyof HostLocationInput, FormDataEntryValue | string>
  >,
  options: { requireLocationId?: boolean } = {},
): HostLocationValidationResult {
  const locationId = normalizeText(rawInput.locationId);
  const fields: HostLocationInput = {
    locationId,
    playgroupId: normalizeText(rawInput.playgroupId),
    name: normalizeText(rawInput.name),
    addressLine1: normalizeText(rawInput.addressLine1),
    addressLine2: normalizeText(rawInput.addressLine2),
    city: normalizeText(rawInput.city),
    stateProvince: normalizeText(rawInput.stateProvince),
    postalCode: normalizeText(rawInput.postalCode),
    country: normalizeText(rawInput.country),
    notes: normalizeMultilineText(rawInput.notes),
  };
  const fieldErrors: Partial<Record<keyof HostLocationInput, string>> = {};

  if (options.requireLocationId && !locationId) {
    fieldErrors.locationId = "Choose a location.";
  } else if (locationId && !isUuid(locationId)) {
    fieldErrors.locationId = "Choose a location.";
  }

  if (!isUuid(fields.playgroupId)) {
    fieldErrors.playgroupId = "Choose a playgroup.";
  }

  if (!fields.name) {
    fieldErrors.name = "Location name is required.";
  } else if (fields.name.length > maxLocationNameLength) {
    fieldErrors.name = `Use ${maxLocationNameLength} characters or fewer.`;
  }

  for (const fieldName of [
    "addressLine1",
    "addressLine2",
    "city",
    "stateProvince",
    "postalCode",
    "country",
  ] as const) {
    if (fields[fieldName].length > maxAddressLineLength) {
      fieldErrors[fieldName] =
        `Use ${maxAddressLineLength} characters or fewer.`;
    }
  }

  if (fields.notes.length > maxLocationNotesLength) {
    fieldErrors.notes = `Use ${maxLocationNotesLength} characters or fewer.`;
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

export function validateArchiveHostLocationInput(
  rawInput: Partial<
    Record<keyof ArchiveHostLocationInput, FormDataEntryValue | string>
  >,
): ArchiveHostLocationValidationResult {
  const fields: ArchiveHostLocationInput = {
    locationId: normalizeText(rawInput.locationId),
  };

  if (!isUuid(fields.locationId)) {
    return {
      ok: false,
      fieldErrors: {
        locationId: "Choose a location.",
      },
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

function normalizeMultilineText(
  value: FormDataEntryValue | string | undefined,
) {
  return String(value ?? "")
    .trim()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
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
