"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createDatabase } from "@/db/client";
import { createPlaygroupForUser } from "@/db/queries/playgroups";
import { requireServerSession } from "@/features/auth/server";
import {
  type CreateGroupInput,
  validateCreateGroupInput,
} from "@/features/groups/group-form";

export type CreateGroupActionState = {
  message: string | null;
  fieldErrors: Partial<Record<keyof CreateGroupInput, string>>;
  fields: CreateGroupInput;
};

export async function createGroupAction(
  _previousState: CreateGroupActionState,
  formData: FormData,
): Promise<CreateGroupActionState> {
  const session = await requireServerSession("/groups");
  const validation = validateCreateGroupInput({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Fix the highlighted fields.",
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await createPlaygroupForUser(createDatabase(), {
      userId: session.user.id,
      ownerDisplayName: session.user.name,
      ...validation.input,
    });
  } catch (error) {
    console.error("Playgroup creation failed", error);

    return {
      message: "Could not create the group. Try again.",
      fieldErrors: {},
      fields: {
        name: validation.input.name,
        description: validation.input.description,
      },
    };
  }

  revalidatePath("/groups");
  redirect("/groups");
}
