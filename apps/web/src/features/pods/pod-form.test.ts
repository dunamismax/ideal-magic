import { describe, expect, test } from "vitest";

import {
  validateGeneratePodsInput,
  validateMovePodSeatInput,
} from "./pod-form";

describe("pod form validation", () => {
  test("accepts valid pod generation input", () => {
    expect(
      validateGeneratePodsInput({
        eventId: "20000000-0000-4000-8000-000000000001",
      }),
    ).toMatchObject({
      ok: true,
      input: {
        eventId: "20000000-0000-4000-8000-000000000001",
      },
    });
  });

  test("validates manual pod seat movement input", () => {
    expect(
      validateMovePodSeatInput({
        eventId: "20000000-0000-4000-8000-000000000001",
        seatId: "20000000-0000-4000-8000-000000000002",
        targetPodId: "20000000-0000-4000-8000-000000000003",
        targetSeatPosition: "2",
      }),
    ).toMatchObject({
      ok: true,
      input: {
        eventId: "20000000-0000-4000-8000-000000000001",
        seatId: "20000000-0000-4000-8000-000000000002",
        targetPodId: "20000000-0000-4000-8000-000000000003",
        targetSeatPosition: 2,
      },
    });

    expect(
      validateMovePodSeatInput({
        eventId: "not-an-event",
        seatId: "",
        targetPodId: "not-a-pod",
        targetSeatPosition: "0",
      }),
    ).toMatchObject({
      ok: false,
      fieldErrors: {
        eventId: "Choose an event.",
        seatId: "Choose a seat.",
        targetPodId: "Choose a target pod.",
        targetSeatPosition: "Choose a positive seat position.",
      },
    });
  });
});
