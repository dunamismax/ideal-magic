export type PodGenerationRsvpStatus = "yes" | "maybe";

export type PodGenerationDeckSnapshot = {
  id: string;
  deckId: string;
  deckNameSnapshot: string;
  commanderSnapshot: string[];
  colorIdentitySnapshot: string;
  bracketSnapshot: "1" | "2" | "3" | "4" | "5" | null;
  powerEstimateSnapshot: number | null;
  archetypeSnapshot: string;
};

export type PodGenerationParticipant = {
  rsvpId: string;
  userId: string;
  displayName: string;
  rsvpStatus: PodGenerationRsvpStatus;
  arrivalTime: Date | null;
  leavingTime: Date | null;
  deckDeclaration: PodGenerationDeckSnapshot | null;
};

export type GeneratedPodSeat = {
  rsvpId: string;
  userId: string;
  seatPosition: number;
  arrivalTime: Date | null;
  leavingTime: Date | null;
  deckDeclaration: PodGenerationDeckSnapshot | null;
};

export type GeneratedPodDraft = {
  name: string;
  position: number;
  sizeFitScore: number;
  bracketCompatibilityScore: number;
  repeatPlayerPairPenalty: number;
  repeatDeckMatchupPenalty: number;
  guestPlacementScore: number;
  availabilityWindowScore: number;
  totalScore: number;
  scoringDetails: Record<string, unknown>;
  seats: GeneratedPodSeat[];
};

export function generateDraftPodAssignments(
  participants: PodGenerationParticipant[],
): GeneratedPodDraft[] {
  const eligibleParticipants = participants
    .filter(
      (participant) =>
        participant.rsvpStatus === "yes" || participant.rsvpStatus === "maybe",
    )
    .toSorted(compareParticipantsForSeating);
  const podSizes = choosePodSizes(eligibleParticipants.length);
  const buckets = podSizes.map(() => [] as PodGenerationParticipant[]);

  eligibleParticipants.forEach((participant, index) => {
    buckets[index % buckets.length]?.push(participant);
  });

  return buckets.map((bucket, index) =>
    createPodDraft(bucket, {
      eligibleParticipantCount: eligibleParticipants.length,
      position: index + 1,
    }),
  );
}

export function choosePodSizes(playerCount: number): number[] {
  if (playerCount <= 0) {
    return [];
  }

  if (playerCount <= 5) {
    return [playerCount];
  }

  const sizes: number[] = [];
  let remaining = playerCount;

  while (remaining > 0) {
    if (remaining === 5) {
      sizes.push(5);
      remaining = 0;
    } else if (remaining === 6) {
      sizes.push(3, 3);
      remaining = 0;
    } else if (remaining === 7) {
      sizes.push(4, 3);
      remaining = 0;
    } else {
      sizes.push(4);
      remaining -= 4;
    }
  }

  return sizes;
}

function createPodDraft(
  participants: PodGenerationParticipant[],
  input: {
    eligibleParticipantCount: number;
    position: number;
  },
): GeneratedPodDraft {
  const sizeFitScore = scorePodSize(participants.length);
  const bracketCompatibilityScore = scoreBracketCompatibility(participants);
  const availabilityWindowScore = scoreAvailability(participants);
  const declaredDeckCount = participants.filter(
    (participant) => participant.deckDeclaration !== null,
  ).length;
  const totalScore =
    sizeFitScore + bracketCompatibilityScore + availabilityWindowScore;

  return {
    name: `Pod ${input.position}`,
    position: input.position,
    sizeFitScore,
    bracketCompatibilityScore,
    repeatPlayerPairPenalty: 0,
    repeatDeckMatchupPenalty: 0,
    guestPlacementScore: 0,
    availabilityWindowScore,
    totalScore,
    scoringDetails: {
      method: "draft-rsvp-declaration-v1",
      eligibleParticipantCount: input.eligibleParticipantCount,
      podSize: participants.length,
      yesCount: participants.filter(
        (participant) => participant.rsvpStatus === "yes",
      ).length,
      maybeCount: participants.filter(
        (participant) => participant.rsvpStatus === "maybe",
      ).length,
      declaredDeckCount,
      bracketSpread: getBracketSpread(participants),
      notes: getPodSizeNote(participants.length),
    },
    seats: participants.map((participant, index) => ({
      rsvpId: participant.rsvpId,
      userId: participant.userId,
      seatPosition: index + 1,
      arrivalTime: participant.arrivalTime,
      leavingTime: participant.leavingTime,
      deckDeclaration: participant.deckDeclaration,
    })),
  };
}

function compareParticipantsForSeating(
  left: PodGenerationParticipant,
  right: PodGenerationParticipant,
) {
  const statusComparison =
    rsvpStatusWeight(left.rsvpStatus) - rsvpStatusWeight(right.rsvpStatus);

  if (statusComparison !== 0) {
    return statusComparison;
  }

  const strengthComparison =
    participantDeckStrength(right) - participantDeckStrength(left);

  if (strengthComparison !== 0) {
    return strengthComparison;
  }

  return left.displayName.localeCompare(right.displayName, "en-US", {
    sensitivity: "base",
  });
}

function rsvpStatusWeight(status: PodGenerationRsvpStatus) {
  return status === "yes" ? 0 : 1;
}

function participantDeckStrength(participant: PodGenerationParticipant) {
  const bracket = Number(participant.deckDeclaration?.bracketSnapshot ?? 0);
  const power = participant.deckDeclaration?.powerEstimateSnapshot ?? 0;

  return bracket * 10 + power;
}

function scorePodSize(size: number) {
  switch (size) {
    case 4:
      return 100;
    case 3:
    case 5:
      return 75;
    case 2:
      return 35;
    case 1:
      return 10;
    default:
      return 0;
  }
}

function scoreBracketCompatibility(participants: PodGenerationParticipant[]) {
  const spread = getBracketSpread(participants);

  if (spread === null) {
    return 50;
  }

  if (spread === 0) {
    return 100;
  }

  if (spread === 1) {
    return 85;
  }

  if (spread === 2) {
    return 65;
  }

  if (spread === 3) {
    return 40;
  }

  return 20;
}

function scoreAvailability(participants: PodGenerationParticipant[]) {
  const maybeCount = participants.filter(
    (participant) => participant.rsvpStatus === "maybe",
  ).length;

  return Math.max(0, 30 - maybeCount * 10);
}

function getBracketSpread(participants: PodGenerationParticipant[]) {
  const brackets = participants
    .map((participant) => Number(participant.deckDeclaration?.bracketSnapshot))
    .filter((bracket) => Number.isInteger(bracket) && bracket >= 1);

  if (brackets.length < 2) {
    return null;
  }

  return Math.max(...brackets) - Math.min(...brackets);
}

function getPodSizeNote(size: number) {
  if (size === 4) {
    return "Preferred four-player Commander pod.";
  }

  if (size === 5) {
    return "Single five-player pod avoids leaving one player isolated.";
  }

  if (size === 3) {
    return "Three-player pod used to handle odd attendance cleanly.";
  }

  return "Small pod retained because attendance is below a normal Commander pod.";
}
