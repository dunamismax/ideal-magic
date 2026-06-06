import {
  createCommander,
  createInitialLifeCounterSession,
  createInitialLifeCounterSnapshot,
  seats,
  type LifeCounterSession,
  type LifeCounterSnapshot,
  type Player,
} from "./session";
import type { EventLifeCounterParticipantSummary } from "@/db/queries/event-planning";
import type { EventPodSummary } from "@/db/queries/pods";

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

type PublishedPodLifeCounterInput = {
  event: {
    id: string;
    title: string;
    startsAt: Date;
  };
  pod: Pick<EventPodSummary, "id" | "name" | "seats">;
  now?: string;
};

export function createEventLifeCounterContextFromParticipants({
  event,
  participants,
  now = new Date().toISOString(),
}: {
  event: {
    id: string;
    title: string;
    startsAt: Date;
  };
  participants: readonly EventLifeCounterParticipantSummary[];
  now?: string;
}): LinkedLifeCounterContext {
  const snapshot = createSnapshotFromLinkedPlayers(
    participants.map((participant, index) => ({
      id: participant.id,
      name: participant.participantName,
      commanders: participant.deck?.commanderSnapshot ?? [],
      deckLabel: participant.deck?.deckNameSnapshot ?? "",
      seat: seats[index] ?? `Seat ${index + 1}`,
    })),
  );

  return {
    kind: "event",
    eventId: event.id,
    title: `${event.title} Life Counter`,
    eyebrow: `Event-linked local session - ${event.startsAt.toLocaleDateString(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    )}`,
    statusLabel: `${participants.length} event players imported from RSVPs and declared decks. Save a completed result when the game is ready for group history.`,
    importedPlayerCount: participants.length,
    session: createInitialLifeCounterSession(now, {
      id: createLinkedSessionId("event", event.id),
      snapshot,
    }),
  };
}

export function createPodLifeCounterContextFromPublishedPod({
  event,
  pod,
  now = new Date().toISOString(),
}: PublishedPodLifeCounterInput): LinkedLifeCounterContext {
  const snapshot = createSnapshotFromLinkedPlayers(
    pod.seats.map((seat) => ({
      id: seat.id,
      name: seat.participantName,
      commanders: seat.deck?.commanderSnapshot ?? [],
      deckLabel: seat.deck?.deckNameSnapshot ?? "",
      seat: seats[seat.seatPosition - 1] ?? `Seat ${seat.seatPosition}`,
    })),
  );

  return {
    kind: "pod",
    eventId: event.id,
    podId: pod.id,
    title: `${pod.name} Life Counter`,
    eyebrow: `Pod-linked local session - ${event.title}`,
    statusLabel: `${snapshot.playerCount} published pod seats imported in table order. Save a completed result when the game is ready for group history.`,
    importedPlayerCount: snapshot.playerCount,
    session: createInitialLifeCounterSession(now, {
      id: createLinkedSessionId("pod", event.id, pod.id),
      snapshot,
    }),
  };
}

export function createScopedLinkedLifeTableSession(
  session: LifeCounterSession,
  scopedSession: LifeCounterSession,
): LifeCounterSession {
  const scopedPlayers = scopedSession.players.slice(
    0,
    scopedSession.playerCount,
  );

  return {
    ...session,
    playerCount: Math.min(session.playerCount, scopedSession.playerCount),
    players: session.players.map((player, index) => {
      const scopedPlayer = scopedPlayers[index];

      if (!scopedPlayer) {
        return player;
      }

      return {
        ...player,
        name: scopedPlayer.name,
        deck: scopedPlayer.deck,
        commanders: scopedPlayer.commanders.map((commander, commanderIndex) => {
          const liveCommander = player.commanders[commanderIndex];

          return {
            ...(liveCommander ?? commander),
            name: commander.name,
          };
        }),
      };
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
