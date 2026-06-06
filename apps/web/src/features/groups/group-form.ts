export type CreateGroupInput = {
  name: string;
  description: string;
};

export type UpdateGroupInput = CreateGroupInput & {
  playgroupId: string;
};

export type ArchiveGroupInput = {
  playgroupId: string;
};

export type CreateGroupValidationResult =
  | {
      ok: true;
      input: CreateGroupInput & {
        slugBase: string;
      };
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof CreateGroupInput, string>>;
      fields: CreateGroupInput;
    };

export type UpdateGroupValidationResult =
  | {
      ok: true;
      input: UpdateGroupInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof UpdateGroupInput, string>>;
      fields: UpdateGroupInput;
    };

export type ArchiveGroupValidationResult =
  | {
      ok: true;
      input: ArchiveGroupInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof ArchiveGroupInput, string>>;
      fields: ArchiveGroupInput;
    };

const maxGroupNameLength = 80;
const maxGroupDescriptionLength = 500;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCreateGroupInput(
  rawInput: Partial<
    Record<keyof CreateGroupInput, FormDataEntryValue | string>
  >,
): CreateGroupValidationResult {
  const fields = {
    name: normalizeText(rawInput.name),
    description: normalizeText(rawInput.description),
  };
  const fieldErrors: Partial<Record<keyof CreateGroupInput, string>> = {};

  if (!fields.name) {
    fieldErrors.name = "Name is required.";
  } else if (fields.name.length > maxGroupNameLength) {
    fieldErrors.name = `Use ${maxGroupNameLength} characters or fewer.`;
  }

  if (fields.description.length > maxGroupDescriptionLength) {
    fieldErrors.description = `Use ${maxGroupDescriptionLength} characters or fewer.`;
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
      ...fields,
      slugBase: createPlaygroupSlugBase(fields.name),
    },
  };
}

export function validateUpdateGroupInput(
  rawInput: Partial<
    Record<keyof UpdateGroupInput, FormDataEntryValue | string>
  >,
): UpdateGroupValidationResult {
  const fields = {
    playgroupId: normalizeText(rawInput.playgroupId),
    name: normalizeText(rawInput.name),
    description: normalizeText(rawInput.description),
  };
  const fieldErrors: Partial<Record<keyof UpdateGroupInput, string>> = {};

  if (!uuidPattern.test(fields.playgroupId)) {
    fieldErrors.playgroupId = "Choose a group to edit.";
  }

  if (!fields.name) {
    fieldErrors.name = "Name is required.";
  } else if (fields.name.length > maxGroupNameLength) {
    fieldErrors.name = `Use ${maxGroupNameLength} characters or fewer.`;
  }

  if (fields.description.length > maxGroupDescriptionLength) {
    fieldErrors.description = `Use ${maxGroupDescriptionLength} characters or fewer.`;
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

export function validateArchiveGroupInput(
  rawInput: Partial<
    Record<keyof ArchiveGroupInput, FormDataEntryValue | string>
  >,
): ArchiveGroupValidationResult {
  const fields = {
    playgroupId: normalizeText(rawInput.playgroupId),
  };

  if (!uuidPattern.test(fields.playgroupId)) {
    return {
      ok: false,
      fields,
      fieldErrors: {
        playgroupId: "Choose a group to archive.",
      },
    };
  }

  return {
    ok: true,
    input: fields,
  };
}

export function createPlaygroupSlugBase(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "playgroup";
}

function normalizeText(value: FormDataEntryValue | string | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}
