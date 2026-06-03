import {
  createCommander,
  createInitialLifeCounterSession,
  createInitialLifeCounterSnapshot,
  type LifeCounterSession,
  type LifeCounterSnapshot,
  type Player,
} from "./session";

type LinkedPlayer = {
  id: string;
  name: string;
  commanders: string[];
  deckLabel: string;
  color?: string;
};

type LinkedPodSeat = LinkedPlayer & {
  seat: string;
};

type LinkedEvent = {
  id: string;
  title: string;
  dateLabel: string;
  participants: LinkedPlayer[];
  pods: LinkedPod[];
};

type LinkedPod = {
  id: string;
  label: string;
  published: boolean;
  seats: LinkedPodSeat[];
};

export type LinkedLifeCounterContext = {
  kind: "event" | "pod";
  eventId: string;
  podId?: string;
  title: string;
  eyebrow: string;
  statusLabel: string;
  importedPlayerCount: number;
  session: LifeCounterSession;
};

const linkedEvents = [
  {
    id: "commander-night-demo",
    title: "Wednesday Commander Night",
    dateLabel: "June 3, 2026",
    participants: [
      {
        id: "nora",
        name: "Nora",
        commanders: ["Muldrotha, the Gravetide"],
        deckLabel: "Graveyard Value",
        color: "player-a",
      },
      {
        id: "theo",
        name: "Theo",
        commanders: ["Alela, Artful Provocateur"],
        deckLabel: "Faerie Tempo",
        color: "player-b",
      },
      {
        id: "mara",
        name: "Mara",
        commanders: ["Isshin, Two Heavens as One"],
        deckLabel: "Attack Triggers",
        color: "player-c",
      },
      {
        id: "sol",
        name: "Sol",
        commanders: ["Etali, Primal Conqueror"],
        deckLabel: "Big Mana",
        color: "player-d",
      },
      {
        id: "jules",
        name: "Jules",
        commanders: ["Kraum, Ludevic's Opus", "Tymna the Weaver"],
        deckLabel: "Partner Midrange",
        color: "player-e",
      },
      {
        id: "priya",
        name: "Priya",
        commanders: ["Shorikai, Genesis Engine"],
        deckLabel: "Artifact Control",
        color: "player-f",
      },
    ],
    pods: [
      {
        id: "pod-alpha",
        label: "Pod Alpha",
        published: true,
        seats: [
          {
            id: "nora",
            name: "Nora",
            commanders: ["Muldrotha, the Gravetide"],
            deckLabel: "Graveyard Value",
            seat: "North",
            color: "player-a",
          },
          {
            id: "theo",
            name: "Theo",
            commanders: ["Alela, Artful Provocateur"],
            deckLabel: "Faerie Tempo",
            seat: "East",
            color: "player-b",
          },
          {
            id: "mara",
            name: "Mara",
            commanders: ["Isshin, Two Heavens as One"],
            deckLabel: "Attack Triggers",
            seat: "South",
            color: "player-c",
          },
          {
            id: "sol",
            name: "Sol",
            commanders: ["Etali, Primal Conqueror"],
            deckLabel: "Big Mana",
            seat: "West",
            color: "player-d",
          },
        ],
      },
      {
        id: "pod-beta",
        label: "Pod Beta",
        published: true,
        seats: [
          {
            id: "jules",
            name: "Jules",
            commanders: ["Kraum, Ludevic's Opus", "Tymna the Weaver"],
            deckLabel: "Partner Midrange",
            seat: "North",
            color: "player-e",
          },
          {
            id: "priya",
            name: "Priya",
            commanders: ["Shorikai, Genesis Engine"],
            deckLabel: "Artifact Control",
            seat: "East",
            color: "player-f",
          },
          {
            id: "guest-1",
            name: "Guest 1",
            commanders: ["Tatyova, Benthic Druid"],
            deckLabel: "Lands",
            seat: "South",
            color: "player-g",
          },
        ],
      },
    ],
  },
] satisfies LinkedEvent[];

export function getEventLifeCounterContext(
  eventId: string,
  now = new Date().toISOString(),
): LinkedLifeCounterContext | null {
  const event = linkedEvents.find((entry) => entry.id === eventId);

  if (!event) {
    return null;
  }

  const snapshot = createSnapshotFromLinkedPlayers(event.participants);

  return {
    kind: "event",
    eventId,
    title: `${event.title} Life Counter`,
    eyebrow: `Event-linked local session - ${event.dateLabel}`,
    statusLabel: `${snapshot.playerCount} event players imported from RSVPs and declared decks. Server save is not enabled yet.`,
    importedPlayerCount: snapshot.playerCount,
    session: createInitialLifeCounterSession(now, {
      id: createLinkedSessionId("event", eventId),
      snapshot,
    }),
  };
}

export function getPodLifeCounterContext(
  eventId: string,
  podId: string,
  now = new Date().toISOString(),
): LinkedLifeCounterContext | null {
  const event = linkedEvents.find((entry) => entry.id === eventId);
  const pod = event?.pods.find((entry) => entry.id === podId);

  if (!event || !pod || !pod.published) {
    return null;
  }

  const snapshot = createSnapshotFromLinkedPlayers(pod.seats);

  return {
    kind: "pod",
    eventId,
    podId,
    title: `${pod.label} Life Counter`,
    eyebrow: `Pod-linked local session - ${event.title}`,
    statusLabel: `${snapshot.playerCount} published pod seats imported in table order. Server save is not enabled yet.`,
    importedPlayerCount: snapshot.playerCount,
    session: createInitialLifeCounterSession(now, {
      id: createLinkedSessionId("pod", eventId, podId),
      snapshot,
    }),
  };
}

function createLinkedSessionId(
  kind: LinkedLifeCounterContext["kind"],
  eventId: string,
  podId?: string,
) {
  return ["linked-life", kind, eventId, podId].filter(Boolean).join(":");
}

function createSnapshotFromLinkedPlayers(
  linkedPlayers: (LinkedPlayer | LinkedPodSeat)[],
): LifeCounterSnapshot {
  const snapshot = createInitialLifeCounterSnapshot();
  const playerCount = Math.min(8, Math.max(2, linkedPlayers.length));
  const mappedPlayers = snapshot.players.map((player, index) => {
    const linkedPlayer = linkedPlayers[index];

    if (!linkedPlayer) {
      return player;
    }

    return mapLinkedPlayer(player, linkedPlayer, index);
  });

  return {
    ...snapshot,
    playerCount,
    activePlayerId: mappedPlayers[0]?.id ?? "player-1",
    players: mappedPlayers,
  };
}

function mapLinkedPlayer(
  player: Player,
  linkedPlayer: LinkedPlayer | LinkedPodSeat,
  index: number,
): Player {
  const commanders =
    linkedPlayer.commanders.length > 0
      ? linkedPlayer.commanders
      : [`${linkedPlayer.name}'s Commander`];

  return {
    ...player,
    id: `player-${index + 1}`,
    name: linkedPlayer.name,
    seat: "seat" in linkedPlayer ? linkedPlayer.seat : player.seat,
    commanders: commanders.map((commanderName, commanderIndex) => ({
      ...createCommander(`player-${index + 1}`, commanderIndex + 1),
      name: commanderName,
    })),
    deck: linkedPlayer.deckLabel,
    color: linkedPlayer.color ?? player.color,
  };
}
