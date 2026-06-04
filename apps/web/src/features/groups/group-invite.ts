export type CreateGroupInviteInput = {
  playgroupId: string;
};

export type RevokeGroupInviteInput = {
  inviteId: string;
};

export type CreateGroupInviteValidationResult =
  | {
      ok: true;
      input: CreateGroupInviteInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof CreateGroupInviteInput, string>>;
      fields: CreateGroupInviteInput;
    };

export type RevokeGroupInviteValidationResult =
  | {
      ok: true;
      input: RevokeGroupInviteInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof RevokeGroupInviteInput, string>>;
      fields: RevokeGroupInviteInput;
    };

export function validateCreateGroupInviteInput(
  rawInput: Partial<
    Record<keyof CreateGroupInviteInput, FormDataEntryValue | string>
  >,
): CreateGroupInviteValidationResult {
  const fields = {
    playgroupId: normalizeText(rawInput.playgroupId),
  };

  if (!isUuid(fields.playgroupId)) {
    return {
      ok: false,
      fieldErrors: {
        playgroupId: "Choose a group.",
      },
      fields,
    };
  }

  return {
    ok: true,
    input: fields,
  };
}

export function validateRevokeGroupInviteInput(
  rawInput: Partial<
    Record<keyof RevokeGroupInviteInput, FormDataEntryValue | string>
  >,
): RevokeGroupInviteValidationResult {
  const fields = {
    inviteId: normalizeText(rawInput.inviteId),
  };

  if (!isUuid(fields.inviteId)) {
    return {
      ok: false,
      fieldErrors: {
        inviteId: "Choose an invite.",
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
