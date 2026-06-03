import {
  decks,
  eventDeckDeclarations,
  eventHosts,
  eventLocations,
  eventRsvps,
  events,
  gamePlayers,
  gameResults,
  games,
  matchupHistory,
  playgroupMemberships,
  playgroups,
  podSeats,
  pods,
  users,
} from "./schema";
import { type AppDatabase, runInTransaction } from "./client";

export const developmentSeedIds = {
  users: {
    nora: "10000000-0000-4000-8000-000000000001",
    theo: "10000000-0000-4000-8000-000000000002",
    mara: "10000000-0000-4000-8000-000000000003",
    sol: "10000000-0000-4000-8000-000000000004",
    priya: "10000000-0000-4000-8000-000000000005",
  },
  playgroups: {
    cityLeague: "10000000-0000-4000-8000-000000000101",
  },
  locations: {
    exampleTabletopRoom: "10000000-0000-4000-8000-000000000201",
  },
  events: {
    wednesdayCommander: "10000000-0000-4000-8000-000000000301",
    sundayPods: "10000000-0000-4000-8000-000000000302",
  },
  rsvps: {
    noraWednesday: "10000000-0000-4000-8000-000000000401",
    theoWednesday: "10000000-0000-4000-8000-000000000402",
    maraWednesday: "10000000-0000-4000-8000-000000000403",
    solWednesday: "10000000-0000-4000-8000-000000000404",
    priyaWednesday: "10000000-0000-4000-8000-000000000405",
    guestWednesday: "10000000-0000-4000-8000-000000000406",
  },
  decks: {
    muldrotha: "10000000-0000-4000-8000-000000000501",
    alela: "10000000-0000-4000-8000-000000000502",
    isshin: "10000000-0000-4000-8000-000000000503",
    etali: "10000000-0000-4000-8000-000000000504",
    shorikai: "10000000-0000-4000-8000-000000000505",
  },
  deckDeclarations: {
    noraWednesday: "10000000-0000-4000-8000-000000000601",
    theoWednesday: "10000000-0000-4000-8000-000000000602",
    maraWednesday: "10000000-0000-4000-8000-000000000603",
    solWednesday: "10000000-0000-4000-8000-000000000604",
    priyaWednesday: "10000000-0000-4000-8000-000000000605",
  },
  pods: {
    alpha: "10000000-0000-4000-8000-000000000701",
  },
  podSeats: {
    nora: "10000000-0000-4000-8000-000000000801",
    theo: "10000000-0000-4000-8000-000000000802",
    mara: "10000000-0000-4000-8000-000000000803",
    sol: "10000000-0000-4000-8000-000000000804",
  },
  games: {
    alphaRoundOne: "10000000-0000-4000-8000-000000000901",
  },
  gameResults: {
    alphaRoundOne: "10000000-0000-4000-8000-000000001001",
  },
  matchupHistory: {
    noraTheo: "10000000-0000-4000-8000-000000001101",
    noraMara: "10000000-0000-4000-8000-000000001102",
  },
} as const;

const startsAt = {
  wednesdayCommander: new Date("2026-06-10T23:00:00.000Z"),
  sundayPods: new Date("2026-06-14T18:00:00.000Z"),
  alphaRoundOne: new Date("2026-05-27T01:15:00.000Z"),
};

type SeedDatabase = Pick<AppDatabase, "insert" | "transaction">;
type SeedInsertTarget = Pick<AppDatabase, "insert">;

export async function seedDevelopmentData(db: SeedDatabase) {
  return runInTransaction(db, async (tx) => {
    await insertDevelopmentSeedRows(tx);
  });
}

async function insertDevelopmentSeedRows(db: SeedInsertTarget) {
  await db
    .insert(users)
    .values([
      {
        id: developmentSeedIds.users.nora,
        email: "nora@example.test",
        name: "Nora Vale",
      },
      {
        id: developmentSeedIds.users.theo,
        email: "theo@example.test",
        name: "Theo Park",
      },
      {
        id: developmentSeedIds.users.mara,
        email: "mara@example.test",
        name: "Mara Chen",
      },
      {
        id: developmentSeedIds.users.sol,
        email: "sol@example.test",
        name: "Sol Reyes",
      },
      {
        id: developmentSeedIds.users.priya,
        email: "priya@example.test",
        name: "Priya Shah",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(playgroups)
    .values({
      id: developmentSeedIds.playgroups.cityLeague,
      name: "Example City Commander League",
      slug: "example-city-commander",
      description: "Fixture-safe planning group for local development.",
      createdByUserId: developmentSeedIds.users.nora,
    })
    .onConflictDoNothing();

  await db
    .insert(playgroupMemberships)
    .values([
      {
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        userId: developmentSeedIds.users.nora,
        role: "owner",
        displayName: "Nora",
      },
      {
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        userId: developmentSeedIds.users.theo,
        role: "host",
        displayName: "Theo",
      },
      {
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        userId: developmentSeedIds.users.mara,
        role: "member",
        displayName: "Mara",
      },
      {
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        userId: developmentSeedIds.users.sol,
        role: "member",
        displayName: "Sol",
      },
      {
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        userId: developmentSeedIds.users.priya,
        role: "viewer",
        displayName: "Priya",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(eventLocations)
    .values({
      id: developmentSeedIds.locations.exampleTabletopRoom,
      playgroupId: developmentSeedIds.playgroups.cityLeague,
      name: "Example Tabletop Room",
      addressLine1: "101 Example Tabletop Way",
      city: "Playtest City",
      stateProvince: "TS",
      postalCode: "00000",
      country: "US",
      notes: "Synthetic local fixture address. Not a real host location.",
      createdByUserId: developmentSeedIds.users.nora,
    })
    .onConflictDoNothing();

  await db
    .insert(events)
    .values([
      {
        id: developmentSeedIds.events.wednesdayCommander,
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        title: "Wednesday Commander Night",
        description: "Fake fixture event for planning and pod smoke tests.",
        startsAt: startsAt.wednesdayCommander,
        locationId: developmentSeedIds.locations.exampleTabletopRoom,
        visibility: "members",
        createdByUserId: developmentSeedIds.users.nora,
      },
      {
        id: developmentSeedIds.events.sundayPods,
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        title: "Sunday Pod Tune-Up",
        startsAt: startsAt.sundayPods,
        visibility: "invite_only",
        createdByUserId: developmentSeedIds.users.theo,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(eventHosts)
    .values({
      eventId: developmentSeedIds.events.wednesdayCommander,
      userId: developmentSeedIds.users.theo,
      addressVisibility: "rsvps",
    })
    .onConflictDoNothing();

  await db
    .insert(eventRsvps)
    .values([
      {
        id: developmentSeedIds.rsvps.noraWednesday,
        eventId: developmentSeedIds.events.wednesdayCommander,
        userId: developmentSeedIds.users.nora,
        status: "yes",
      },
      {
        id: developmentSeedIds.rsvps.theoWednesday,
        eventId: developmentSeedIds.events.wednesdayCommander,
        userId: developmentSeedIds.users.theo,
        status: "yes",
      },
      {
        id: developmentSeedIds.rsvps.maraWednesday,
        eventId: developmentSeedIds.events.wednesdayCommander,
        userId: developmentSeedIds.users.mara,
        status: "maybe",
      },
      {
        id: developmentSeedIds.rsvps.solWednesday,
        eventId: developmentSeedIds.events.wednesdayCommander,
        userId: developmentSeedIds.users.sol,
        status: "no",
      },
      {
        id: developmentSeedIds.rsvps.priyaWednesday,
        eventId: developmentSeedIds.events.wednesdayCommander,
        userId: developmentSeedIds.users.priya,
        status: "waitlist",
      },
      {
        id: developmentSeedIds.rsvps.guestWednesday,
        eventId: developmentSeedIds.events.wednesdayCommander,
        guestName: "Example Guest",
        status: "yes",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(decks)
    .values([
      {
        id: developmentSeedIds.decks.muldrotha,
        ownerUserId: developmentSeedIds.users.nora,
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        name: "Graveyard Value",
        commanders: ["Muldrotha, the Gravetide"],
        colorIdentity: "BUG",
        bracket: "3",
        powerEstimate: 7,
        archetype: "Graveyard",
        tags: ["recursion", "value"],
        visibility: "playgroup",
      },
      {
        id: developmentSeedIds.decks.alela,
        ownerUserId: developmentSeedIds.users.theo,
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        name: "Faerie Tempo",
        commanders: ["Alela, Artful Provocateur"],
        colorIdentity: "WUB",
        bracket: "2",
        powerEstimate: 6,
        archetype: "Tempo",
        tags: ["flying", "tokens"],
        visibility: "playgroup",
      },
      {
        id: developmentSeedIds.decks.isshin,
        ownerUserId: developmentSeedIds.users.mara,
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        name: "Attack Triggers",
        commanders: ["Isshin, Two Heavens as One"],
        colorIdentity: "WBR",
        bracket: "3",
        powerEstimate: 7,
        archetype: "Combat",
        tags: ["combat", "tokens"],
        visibility: "playgroup",
      },
      {
        id: developmentSeedIds.decks.etali,
        ownerUserId: developmentSeedIds.users.sol,
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        name: "Big Mana",
        commanders: ["Etali, Primal Conqueror"],
        colorIdentity: "RG",
        bracket: "3",
        powerEstimate: 7,
        archetype: "Ramp",
        tags: ["ramp", "battlecruiser"],
        visibility: "playgroup",
      },
      {
        id: developmentSeedIds.decks.shorikai,
        ownerUserId: developmentSeedIds.users.priya,
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        name: "Artifact Control",
        commanders: ["Shorikai, Genesis Engine"],
        colorIdentity: "WU",
        bracket: "4",
        powerEstimate: 8,
        archetype: "Control",
        tags: ["artifacts", "control"],
        visibility: "private",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(eventDeckDeclarations)
    .values([
      {
        id: developmentSeedIds.deckDeclarations.noraWednesday,
        eventId: developmentSeedIds.events.wednesdayCommander,
        userId: developmentSeedIds.users.nora,
        deckId: developmentSeedIds.decks.muldrotha,
        preference: 1,
        commanderSnapshot: ["Muldrotha, the Gravetide"],
        deckNameSnapshot: "Graveyard Value",
        colorIdentitySnapshot: "BUG",
        bracketSnapshot: "3",
      },
      {
        id: developmentSeedIds.deckDeclarations.theoWednesday,
        eventId: developmentSeedIds.events.wednesdayCommander,
        userId: developmentSeedIds.users.theo,
        deckId: developmentSeedIds.decks.alela,
        preference: 1,
        commanderSnapshot: ["Alela, Artful Provocateur"],
        deckNameSnapshot: "Faerie Tempo",
        colorIdentitySnapshot: "WUB",
        bracketSnapshot: "2",
      },
      {
        id: developmentSeedIds.deckDeclarations.maraWednesday,
        eventId: developmentSeedIds.events.wednesdayCommander,
        userId: developmentSeedIds.users.mara,
        deckId: developmentSeedIds.decks.isshin,
        preference: 1,
        commanderSnapshot: ["Isshin, Two Heavens as One"],
        deckNameSnapshot: "Attack Triggers",
        colorIdentitySnapshot: "WBR",
        bracketSnapshot: "3",
      },
      {
        id: developmentSeedIds.deckDeclarations.solWednesday,
        eventId: developmentSeedIds.events.wednesdayCommander,
        userId: developmentSeedIds.users.sol,
        deckId: developmentSeedIds.decks.etali,
        preference: 1,
        commanderSnapshot: ["Etali, Primal Conqueror"],
        deckNameSnapshot: "Big Mana",
        colorIdentitySnapshot: "RG",
        bracketSnapshot: "3",
      },
      {
        id: developmentSeedIds.deckDeclarations.priyaWednesday,
        eventId: developmentSeedIds.events.wednesdayCommander,
        userId: developmentSeedIds.users.priya,
        deckId: developmentSeedIds.decks.shorikai,
        preference: 2,
        commanderSnapshot: ["Shorikai, Genesis Engine"],
        deckNameSnapshot: "Artifact Control",
        colorIdentitySnapshot: "WU",
        bracketSnapshot: "4",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(pods)
    .values({
      id: developmentSeedIds.pods.alpha,
      eventId: developmentSeedIds.events.wednesdayCommander,
      name: "Pod Alpha",
      state: "completed",
      position: 1,
      sizeFitScore: 4,
      bracketCompatibilityScore: 3,
      totalScore: 7,
      publishedAt: startsAt.wednesdayCommander,
    })
    .onConflictDoNothing();

  await db
    .insert(podSeats)
    .values([
      {
        id: developmentSeedIds.podSeats.nora,
        podId: developmentSeedIds.pods.alpha,
        eventId: developmentSeedIds.events.wednesdayCommander,
        rsvpId: developmentSeedIds.rsvps.noraWednesday,
        userId: developmentSeedIds.users.nora,
        deckDeclarationId: developmentSeedIds.deckDeclarations.noraWednesday,
        deckId: developmentSeedIds.decks.muldrotha,
        seatPosition: 1,
        locked: true,
      },
      {
        id: developmentSeedIds.podSeats.theo,
        podId: developmentSeedIds.pods.alpha,
        eventId: developmentSeedIds.events.wednesdayCommander,
        rsvpId: developmentSeedIds.rsvps.theoWednesday,
        userId: developmentSeedIds.users.theo,
        deckDeclarationId: developmentSeedIds.deckDeclarations.theoWednesday,
        deckId: developmentSeedIds.decks.alela,
        seatPosition: 2,
        locked: true,
      },
      {
        id: developmentSeedIds.podSeats.mara,
        podId: developmentSeedIds.pods.alpha,
        eventId: developmentSeedIds.events.wednesdayCommander,
        rsvpId: developmentSeedIds.rsvps.maraWednesday,
        userId: developmentSeedIds.users.mara,
        deckDeclarationId: developmentSeedIds.deckDeclarations.maraWednesday,
        deckId: developmentSeedIds.decks.isshin,
        seatPosition: 3,
        locked: true,
      },
      {
        id: developmentSeedIds.podSeats.sol,
        podId: developmentSeedIds.pods.alpha,
        eventId: developmentSeedIds.events.wednesdayCommander,
        rsvpId: developmentSeedIds.rsvps.solWednesday,
        userId: developmentSeedIds.users.sol,
        deckDeclarationId: developmentSeedIds.deckDeclarations.solWednesday,
        deckId: developmentSeedIds.decks.etali,
        seatPosition: 4,
        locked: true,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(games)
    .values({
      id: developmentSeedIds.games.alphaRoundOne,
      eventId: developmentSeedIds.events.wednesdayCommander,
      podId: developmentSeedIds.pods.alpha,
      loggedByUserId: developmentSeedIds.users.nora,
      resultType: "combat_win",
      turnCount: 11,
      durationMinutes: 74,
      firstPlayerUserId: developmentSeedIds.users.theo,
      tags: ["fixture", "combat"],
      completedAt: startsAt.alphaRoundOne,
    })
    .onConflictDoNothing();

  await db
    .insert(gamePlayers)
    .values([
      {
        gameId: developmentSeedIds.games.alphaRoundOne,
        podSeatId: developmentSeedIds.podSeats.nora,
        userId: developmentSeedIds.users.nora,
        deckId: developmentSeedIds.decks.muldrotha,
        seatPosition: 1,
        finishPosition: 1,
        isWinner: true,
      },
      {
        gameId: developmentSeedIds.games.alphaRoundOne,
        podSeatId: developmentSeedIds.podSeats.theo,
        userId: developmentSeedIds.users.theo,
        deckId: developmentSeedIds.decks.alela,
        seatPosition: 2,
        finishPosition: 2,
        eliminationOrder: 3,
        eliminatedTurn: 11,
      },
      {
        gameId: developmentSeedIds.games.alphaRoundOne,
        podSeatId: developmentSeedIds.podSeats.mara,
        userId: developmentSeedIds.users.mara,
        deckId: developmentSeedIds.decks.isshin,
        seatPosition: 3,
        finishPosition: 3,
        eliminationOrder: 2,
        eliminatedTurn: 10,
      },
      {
        gameId: developmentSeedIds.games.alphaRoundOne,
        podSeatId: developmentSeedIds.podSeats.sol,
        userId: developmentSeedIds.users.sol,
        deckId: developmentSeedIds.decks.etali,
        seatPosition: 4,
        finishPosition: 4,
        eliminationOrder: 1,
        eliminatedTurn: 8,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(gameResults)
    .values({
      id: developmentSeedIds.gameResults.alphaRoundOne,
      gameId: developmentSeedIds.games.alphaRoundOne,
      resultType: "combat_win",
      winnerUserId: developmentSeedIds.users.nora,
      winningDeckId: developmentSeedIds.decks.muldrotha,
    })
    .onConflictDoNothing();

  await db
    .insert(matchupHistory)
    .values([
      {
        id: developmentSeedIds.matchupHistory.noraTheo,
        gameId: developmentSeedIds.games.alphaRoundOne,
        eventId: developmentSeedIds.events.wednesdayCommander,
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        leftUserId: developmentSeedIds.users.nora,
        rightUserId: developmentSeedIds.users.theo,
        leftDeckId: developmentSeedIds.decks.muldrotha,
        rightDeckId: developmentSeedIds.decks.alela,
      },
      {
        id: developmentSeedIds.matchupHistory.noraMara,
        gameId: developmentSeedIds.games.alphaRoundOne,
        eventId: developmentSeedIds.events.wednesdayCommander,
        playgroupId: developmentSeedIds.playgroups.cityLeague,
        leftUserId: developmentSeedIds.users.nora,
        rightUserId: developmentSeedIds.users.mara,
        leftDeckId: developmentSeedIds.decks.muldrotha,
        rightDeckId: developmentSeedIds.decks.isshin,
      },
    ])
    .onConflictDoNothing();
}
