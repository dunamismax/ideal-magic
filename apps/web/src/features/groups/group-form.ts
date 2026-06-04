export type CreateGroupInput = {
  name: string;
  description: string;
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

const maxGroupNameLength = 80;
const maxGroupDescriptionLength = 500;

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
