import { describe, expect, test } from "vitest";

import {
  validateCreateDeckInput,
  validateDeckDeclarationInput,
  validateUndeclareDeckInput,
} from "./deck-form";

const playgroupId = "20000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000002";
const deckId = "20000000-0000-4000-8000-000000000003";
const declarationId = "20000000-0000-4000-8000-000000000004";

describe("deck form validation", () => {
  test("normalizes valid planning deck metadata", () => {
    expect(
      validateCreateDeckInput({
        name: "  Atraxa   Counters  ",
        commanders: " Atraxa, Grand Unifier\nTekuthal, Inquiry Dominus ",
        colorIdentity: "gwuub",
        bracket: "3",
        powerEstimate: "7",
        archetype: "  Proliferate counters ",
        tags: "Counters, Midrange, counters",
        visibility: "playgroup",
        playgroupId,
        externalUrl: "https://example.test/decks/atraxa",
      }),
    ).toEqual({
      ok: true,
      input: {
        name: "Atraxa Counters",
        commanders: ["Atraxa, Grand Unifier", "Tekuthal, Inquiry Dominus"],
        colorIdentity: "WUBG",
        bracket: "3",
        powerEstimate: 7,
        archetype: "Proliferate counters",
        tags: ["counters", "midrange"],
        visibility: "playgroup",
        playgroupId,
        externalUrl: "https://example.test/decks/atraxa",
      },
    });
  });

  test("rejects invalid deck fields without full deckbuilder behavior", () => {
    expect(
      validateCreateDeckInput({
        name: "",
        commanders: "",
        colorIdentity: "wuX",
        bracket: "6",
        powerEstimate: "11",
        archetype: "x".repeat(81),
        tags: Array.from({ length: 9 }, (_, index) => `tag${index}`).join(","),
        visibility: "playgroup",
        playgroupId: "",
        externalUrl: "ftp://example.test/deck",
      }),
    ).toEqual({
      ok: false,
      fields: {
        name: "",
        commanders: "",
        colorIdentity: "WU",
        bracket: "6",
        powerEstimate: "11",
        archetype: "x".repeat(81),
        tags: Array.from({ length: 9 }, (_, index) => `tag${index}`).join(","),
        visibility: "playgroup",
        playgroupId: "",
        externalUrl: "ftp://example.test/deck",
      },
      fieldErrors: {
        name: "Deck name is required.",
        commanders: "Add at least one commander.",
        colorIdentity: "Use only W, U, B, R, and G.",
        bracket: "Choose bracket 1 through 5.",
        powerEstimate: "Use a power estimate from 1 to 10.",
        archetype: "Use 80 characters or fewer.",
        tags: "Use up to 8 tags, 32 characters each.",
        playgroupId: "Choose a playgroup for playgroup visibility.",
        externalUrl: "Use a valid http or https deck URL.",
      },
    });
  });

  test("normalizes event declaration input", () => {
    expect(
      validateDeckDeclarationInput({
        eventId,
        deckId,
        preference: "2",
      }),
    ).toEqual({
      ok: true,
      input: {
        eventId,
        deckId,
        preference: 2,
      },
    });
  });

  test("rejects invalid declaration inputs", () => {
    expect(
      validateDeckDeclarationInput({
        eventId: "not-an-event",
        deckId: "not-a-deck",
        preference: "7",
      }),
    ).toEqual({
      ok: false,
      fields: {
        eventId: "not-an-event",
        deckId: "not-a-deck",
        preference: "7",
      },
      fieldErrors: {
        eventId: "Choose an event.",
        deckId: "Choose one of your decks.",
        preference: "Choose preference 1 through 5.",
      },
    });

    expect(validateUndeclareDeckInput({ declarationId })).toEqual({
      ok: true,
      input: {
        declarationId,
      },
    });
    expect(validateUndeclareDeckInput({ declarationId: "bad" })).toEqual({
      ok: false,
      fields: {
        declarationId: "bad",
      },
      fieldErrors: {
        declarationId: "Choose a declaration.",
      },
    });
  });
});
