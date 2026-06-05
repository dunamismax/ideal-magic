export type DeckVisibility = "private" | "playgroup" | "public";

export type CreateDeckInput = {
  name: string;
  commanders: string;
  colorIdentity: string;
  bracket: "" | "1" | "2" | "3" | "4" | "5";
  powerEstimate: string;
  archetype: string;
  tags: string;
  visibility: DeckVisibility;
  playgroupId: string;
  externalUrl: string;
};

export type UpdateDeckInput = CreateDeckInput & {
  deckId: string;
};

export type RetireDeckInput = {
  deckId: string;
};

export type DeckDeclarationInput = {
  eventId: string;
  deckId: string;
  preference: string;
};

export type UndeclareDeckInput = {
  declarationId: string;
};

export type CreateDeckValidationResult =
  | {
      ok: true;
      input: ValidDeckMetadataInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof CreateDeckInput, string>>;
      fields: CreateDeckInput;
    };

export type UpdateDeckValidationResult =
  | {
      ok: true;
      input: ValidDeckMetadataInput & {
        deckId: string;
      };
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof UpdateDeckInput, string>>;
      fields: UpdateDeckInput;
    };

export type RetireDeckValidationResult =
  | {
      ok: true;
      input: {
        deckId: string;
      };
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof RetireDeckInput, string>>;
      fields: RetireDeckInput;
    };

export type DeckDeclarationValidationResult =
  | {
      ok: true;
      input: {
        eventId: string;
        deckId: string;
        preference: number;
      };
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof DeckDeclarationInput, string>>;
      fields: DeckDeclarationInput;
    };

export type UndeclareDeckValidationResult =
  | {
      ok: true;
      input: {
        declarationId: string;
      };
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof UndeclareDeckInput, string>>;
      fields: UndeclareDeckInput;
    };

const maxDeckNameLength = 100;
const maxCommanderLength = 120;
const maxArchetypeLength = 80;
const maxTags = 8;
const maxTagLength = 32;
const deckVisibilities = ["private", "playgroup", "public"] as const;
const brackets = ["1", "2", "3", "4", "5"] as const;

type ValidDeckMetadataInput = {
  name: string;
  commanders: string[];
  colorIdentity: string;
  bracket: "1" | "2" | "3" | "4" | "5" | null;
  powerEstimate: number | null;
  archetype: string;
  tags: string[];
  visibility: DeckVisibility;
  playgroupId: string | null;
  externalUrl: string | null;
};

export function validateCreateDeckInput(
  rawInput: Partial<Record<keyof CreateDeckInput, FormDataEntryValue | string>>,
): CreateDeckValidationResult {
  return validateDeckMetadataInput(rawInput);
}

export function validateUpdateDeckInput(
  rawInput: Partial<Record<keyof UpdateDeckInput, FormDataEntryValue | string>>,
): UpdateDeckValidationResult {
  const deckId = normalizeText(rawInput.deckId);
  const validation = validateDeckMetadataInput(rawInput);

  if (validation.ok) {
    if (!isUuid(deckId)) {
      return {
        ok: false,
        fieldErrors: {
          deckId: "Choose a deck to update.",
        },
        fields: {
          ...toUpdateFieldsFromValidInput(validation.input),
          deckId,
        },
      };
    }

    return {
      ok: true,
      input: {
        ...validation.input,
        deckId,
      },
    };
  }

  return {
    ok: false,
    fieldErrors: {
      ...validation.fieldErrors,
      ...(!isUuid(deckId)
        ? {
            deckId: "Choose a deck to update.",
          }
        : {}),
    },
    fields: {
      ...validation.fields,
      deckId,
    },
  };
}

export function validateRetireDeckInput(
  rawInput: Partial<Record<keyof RetireDeckInput, FormDataEntryValue | string>>,
): RetireDeckValidationResult {
  const fields: RetireDeckInput = {
    deckId: normalizeText(rawInput.deckId),
  };

  if (!isUuid(fields.deckId)) {
    return {
      ok: false,
      fieldErrors: {
        deckId: "Choose a deck to retire.",
      },
      fields,
    };
  }

  return {
    ok: true,
    input: fields,
  };
}

function validateDeckMetadataInput(
  rawInput: Partial<Record<keyof CreateDeckInput, FormDataEntryValue | string>>,
): CreateDeckValidationResult {
  const fields: CreateDeckInput = {
    name: normalizeText(rawInput.name),
    commanders: String(rawInput.commanders ?? "").trim(),
    colorIdentity: normalizeColorIdentity(rawInput.colorIdentity),
    bracket: String(rawInput.bracket ?? "") as CreateDeckInput["bracket"],
    powerEstimate: String(rawInput.powerEstimate ?? "").trim(),
    archetype: normalizeText(rawInput.archetype),
    tags: String(rawInput.tags ?? "").trim(),
    visibility: String(rawInput.visibility ?? "") as DeckVisibility,
    playgroupId: normalizeText(rawInput.playgroupId),
    externalUrl: String(rawInput.externalUrl ?? "").trim(),
  };
  const fieldErrors: Partial<Record<keyof CreateDeckInput, string>> = {};
  const commanders = splitCommanderList(fields.commanders);
  const tags = splitCommaList(fields.tags).map((tag) => tag.toLowerCase());
  const powerEstimate = parseOptionalInteger(fields.powerEstimate);
  const externalUrl = normalizeExternalUrl(fields.externalUrl);
  const rawColorIdentity = String(rawInput.colorIdentity ?? "")
    .toUpperCase()
    .replace(/[\s,]+/g, "");

  if (!fields.name) {
    fieldErrors.name = "Deck name is required.";
  } else if (fields.name.length > maxDeckNameLength) {
    fieldErrors.name = `Use ${maxDeckNameLength} characters or fewer.`;
  }

  if (commanders.length === 0) {
    fieldErrors.commanders = "Add at least one commander.";
  } else if (
    commanders.some((commander) => commander.length > maxCommanderLength)
  ) {
    fieldErrors.commanders = `Use ${maxCommanderLength} characters or fewer per commander.`;
  }

  if (!/^[WUBRG]*$/.test(rawColorIdentity)) {
    fieldErrors.colorIdentity = "Use only W, U, B, R, and G.";
  }

  if (fields.bracket && !includesString(brackets, fields.bracket)) {
    fieldErrors.bracket = "Choose bracket 1 through 5.";
  }

  if (
    fields.powerEstimate &&
    (powerEstimate === null || powerEstimate < 1 || powerEstimate > 10)
  ) {
    fieldErrors.powerEstimate = "Use a power estimate from 1 to 10.";
  }

  if (fields.archetype.length > maxArchetypeLength) {
    fieldErrors.archetype = `Use ${maxArchetypeLength} characters or fewer.`;
  }

  if (tags.length > maxTags || tags.some((tag) => tag.length > maxTagLength)) {
    fieldErrors.tags = `Use up to ${maxTags} tags, ${maxTagLength} characters each.`;
  }

  if (!includesString(deckVisibilities, fields.visibility)) {
    fieldErrors.visibility = "Choose a deck visibility.";
  }

  if (fields.visibility === "playgroup" && !isUuid(fields.playgroupId)) {
    fieldErrors.playgroupId = "Choose a playgroup for playgroup visibility.";
  }

  if (fields.visibility !== "playgroup" && fields.playgroupId) {
    fields.playgroupId = "";
  }

  if (fields.externalUrl && externalUrl === null) {
    fieldErrors.externalUrl = "Use a valid http or https deck URL.";
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
    input: {
      name: fields.name,
      commanders,
      colorIdentity: fields.colorIdentity,
      bracket: fields.bracket || null,
      powerEstimate,
      archetype: fields.archetype,
      tags,
      visibility: fields.visibility,
      playgroupId:
        fields.visibility === "playgroup" ? fields.playgroupId : null,
      externalUrl,
    },
  };
}

function toUpdateFieldsFromValidInput(
  input: ValidDeckMetadataInput,
): UpdateDeckInput {
  return {
    name: input.name,
    commanders: input.commanders.join("\n"),
    colorIdentity: input.colorIdentity,
    bracket: input.bracket ?? "",
    powerEstimate: input.powerEstimate?.toString() ?? "",
    archetype: input.archetype,
    tags: input.tags.join(", "),
    visibility: input.visibility,
    playgroupId: input.playgroupId ?? "",
    externalUrl: input.externalUrl ?? "",
    deckId: "",
  };
}

export function validateDeckDeclarationInput(
  rawInput: Partial<
    Record<keyof DeckDeclarationInput, FormDataEntryValue | string>
  >,
): DeckDeclarationValidationResult {
  const fields: DeckDeclarationInput = {
    eventId: normalizeText(rawInput.eventId),
    deckId: normalizeText(rawInput.deckId),
    preference: String(rawInput.preference ?? "1").trim(),
  };
  const fieldErrors: Partial<Record<keyof DeckDeclarationInput, string>> = {};
  const preference = parseOptionalInteger(fields.preference);

  if (!isUuid(fields.eventId)) {
    fieldErrors.eventId = "Choose an event.";
  }

  if (!isUuid(fields.deckId)) {
    fieldErrors.deckId = "Choose one of your decks.";
  }

  if (preference === null || preference < 1 || preference > 5) {
    fieldErrors.preference = "Choose preference 1 through 5.";
  }

  if (Object.keys(fieldErrors).length > 0 || preference === null) {
    return {
      ok: false,
      fieldErrors,
      fields,
    };
  }

  return {
    ok: true,
    input: {
      eventId: fields.eventId,
      deckId: fields.deckId,
      preference,
    },
  };
}

export function validateUndeclareDeckInput(
  rawInput: Partial<
    Record<keyof UndeclareDeckInput, FormDataEntryValue | string>
  >,
): UndeclareDeckValidationResult {
  const fields: UndeclareDeckInput = {
    declarationId: normalizeText(rawInput.declarationId),
  };

  if (!isUuid(fields.declarationId)) {
    return {
      ok: false,
      fieldErrors: {
        declarationId: "Choose a declaration.",
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

function normalizeColorIdentity(
  value: FormDataEntryValue | string | undefined,
) {
  const raw = String(value ?? "").toUpperCase();
  const colors = new Set(raw.match(/[WUBRG]/g) ?? []);

  return ["W", "U", "B", "R", "G"]
    .filter((color) => colors.has(color))
    .join("");
}

function splitCommanderList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\n/)
        .map((part) => normalizeText(part))
        .filter(Boolean),
    ),
  );
}

function splitCommaList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((part) => normalizeText(part).toLowerCase())
        .filter(Boolean),
    ),
  );
}

function normalizeExternalUrl(value: string) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function parseOptionalInteger(value: string) {
  if (!value) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) ? parsed : null;
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
