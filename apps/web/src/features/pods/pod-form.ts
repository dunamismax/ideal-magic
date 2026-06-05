export type GeneratePodsInput = {
  eventId: string;
};

export type GeneratePodsValidationResult =
  | {
      ok: true;
      input: GeneratePodsInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof GeneratePodsInput, string>>;
      fields: GeneratePodsInput;
    };

export function validateGeneratePodsInput(
  rawInput: Partial<
    Record<keyof GeneratePodsInput, FormDataEntryValue | string>
  >,
): GeneratePodsValidationResult {
  const fields: GeneratePodsInput = {
    eventId: normalizeText(rawInput.eventId),
  };

  if (!isUuid(fields.eventId)) {
    return {
      ok: false,
      fieldErrors: {
        eventId: "Choose an event.",
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
  return String(value ?? "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
