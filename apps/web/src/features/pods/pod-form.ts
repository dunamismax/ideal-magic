export type GeneratePodsInput = {
  eventId: string;
};

export type MovePodSeatInput = {
  eventId: string;
  seatId: string;
  targetPodId: string;
  targetSeatPosition: number;
};

export type PodPublicationInput = {
  eventId: string;
  intent: "publish" | "unpublish";
};

export type PodSeatLockInput = {
  eventId: string;
  seatId: string;
  intent: "lock" | "unlock";
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

export type MovePodSeatValidationResult =
  | {
      ok: true;
      input: MovePodSeatInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof MovePodSeatInput, string>>;
      fields: MovePodSeatInput;
    };

export type PodPublicationValidationResult =
  | {
      ok: true;
      input: PodPublicationInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof PodPublicationInput, string>>;
      fields: PodPublicationInput;
    };

export type PodSeatLockValidationResult =
  | {
      ok: true;
      input: PodSeatLockInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof PodSeatLockInput, string>>;
      fields: PodSeatLockInput;
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

export function validateMovePodSeatInput(
  rawInput: Partial<
    Record<keyof MovePodSeatInput, FormDataEntryValue | string | number>
  >,
): MovePodSeatValidationResult {
  const fields: MovePodSeatInput = {
    eventId: normalizeText(rawInput.eventId),
    seatId: normalizeText(rawInput.seatId),
    targetPodId: normalizeText(rawInput.targetPodId),
    targetSeatPosition: Number(rawInput.targetSeatPosition),
  };
  const fieldErrors: Partial<Record<keyof MovePodSeatInput, string>> = {};

  if (!isUuid(fields.eventId)) {
    fieldErrors.eventId = "Choose an event.";
  }

  if (!isUuid(fields.seatId)) {
    fieldErrors.seatId = "Choose a seat.";
  }

  if (!isUuid(fields.targetPodId)) {
    fieldErrors.targetPodId = "Choose a target pod.";
  }

  if (
    !Number.isInteger(fields.targetSeatPosition) ||
    fields.targetSeatPosition < 1
  ) {
    fieldErrors.targetSeatPosition = "Choose a positive seat position.";
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

export function validatePodPublicationInput(
  rawInput: Partial<
    Record<keyof PodPublicationInput, FormDataEntryValue | string>
  >,
): PodPublicationValidationResult {
  const intent = normalizeText(rawInput.intent);
  const fields: PodPublicationInput = {
    eventId: normalizeText(rawInput.eventId),
    intent: intent === "unpublish" ? "unpublish" : "publish",
  };
  const fieldErrors: Partial<Record<keyof PodPublicationInput, string>> = {};

  if (!isUuid(fields.eventId)) {
    fieldErrors.eventId = "Choose an event.";
  }

  if (intent !== "publish" && intent !== "unpublish") {
    fieldErrors.intent = "Choose publish or unpublish.";
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

export function validatePodSeatLockInput(
  rawInput: Partial<
    Record<keyof PodSeatLockInput, FormDataEntryValue | string>
  >,
): PodSeatLockValidationResult {
  const intent = normalizeText(rawInput.intent);
  const fields: PodSeatLockInput = {
    eventId: normalizeText(rawInput.eventId),
    seatId: normalizeText(rawInput.seatId),
    intent: intent === "unlock" ? "unlock" : "lock",
  };
  const fieldErrors: Partial<Record<keyof PodSeatLockInput, string>> = {};

  if (!isUuid(fields.eventId)) {
    fieldErrors.eventId = "Choose an event.";
  }

  if (!isUuid(fields.seatId)) {
    fieldErrors.seatId = "Choose a seat.";
  }

  if (intent !== "lock" && intent !== "unlock") {
    fieldErrors.intent = "Choose lock or unlock.";
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

function normalizeText(
  value: FormDataEntryValue | string | number | undefined,
) {
  return String(value ?? "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
