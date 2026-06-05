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
  userId: string | null;
  guestName?: string | null;
  displayName: string;
  rsvpStatus: PodGenerationRsvpStatus;
  arrivalTime: Date | null;
  leavingTime: Date | null;
  deckDeclaration: PodGenerationDeckSnapshot | null;
};

export type PodGenerationMatchupHistory = {
  leftUserId: string | null;
  rightUserId: string | null;
  leftDeckId: string | null;
  rightDeckId: string | null;
};

export type PodGenerationOptions = {
  matchupHistory?: readonly PodGenerationMatchupHistory[];
};

export type GeneratedPodSeat = {
  rsvpId: string;
  userId: string | null;
  guestName: string | null;
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
  options: PodGenerationOptions = {},
): GeneratedPodDraft[] {
  const eligibleParticipants = participants
    .filter(
      (participant) =>
        participant.rsvpStatus === "yes" || participant.rsvpStatus === "maybe",
    )
    .toSorted(compareParticipantsForSeating);
  const podSizes = choosePodSizes(eligibleParticipants.length);
  const scoringContext = createScoringContext(options.matchupHistory ?? []);
  const buckets = optimizePodBuckets(
    eligibleParticipants,
    podSizes,
    scoringContext,
  );

  return buckets.map((bucket, index) =>
    createPodDraft(bucket.toSorted(compareParticipantsForSeating), {
      eligibleParticipantCount: eligibleParticipants.length,
      position: index + 1,
      scoringContext,
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
    scoringContext: PodScoringContext;
  },
): GeneratedPodDraft {
  const score = scorePodParticipants(participants, input.scoringContext);
  const declaredDeckCount = participants.filter(
    (participant) => participant.deckDeclaration !== null,
  ).length;
  const guestCount = participants.filter(isGuestParticipant).length;

  return {
    name: `Pod ${input.position}`,
    position: input.position,
    sizeFitScore: score.sizeFitScore,
    bracketCompatibilityScore: score.bracketCompatibilityScore,
    repeatPlayerPairPenalty: score.repeatPlayerPairPenalty,
    repeatDeckMatchupPenalty: score.repeatDeckMatchupPenalty,
    guestPlacementScore: score.guestPlacementScore,
    availabilityWindowScore: score.availabilityWindowScore,
    totalScore: score.totalScore,
    scoringDetails: {
      method: "draft-pod-optimizer-v2",
      eligibleParticipantCount: input.eligibleParticipantCount,
      podSize: participants.length,
      yesCount: participants.filter(
        (participant) => participant.rsvpStatus === "yes",
      ).length,
      maybeCount: participants.filter(
        (participant) => participant.rsvpStatus === "maybe",
      ).length,
      declaredDeckCount,
      guestCount,
      bracketSpread: getBracketSpread(participants),
      deckVariety: score.deckVarietyDetails,
      repeatPairing: score.repeatPairingDetails,
      availability: score.availabilityDetails,
      guestPlacement: score.guestPlacementDetails,
      notes: getPodSizeNote(participants.length),
    },
    seats: participants.map((participant, index) => ({
      rsvpId: participant.rsvpId,
      userId: participant.userId,
      guestName: participant.guestName ?? null,
      seatPosition: index + 1,
      arrivalTime: participant.arrivalTime,
      leavingTime: participant.leavingTime,
      deckDeclaration: participant.deckDeclaration,
    })),
  };
}

type PodScore = {
  sizeFitScore: number;
  bracketCompatibilityScore: number;
  repeatPlayerPairPenalty: number;
  repeatDeckMatchupPenalty: number;
  availabilityWindowScore: number;
  guestPlacementScore: number;
  deckVarietyScore: number;
  totalScore: number;
  deckVarietyDetails: Record<string, unknown>;
  repeatPairingDetails: Record<string, unknown>;
  availabilityDetails: Record<string, unknown>;
  guestPlacementDetails: Record<string, unknown>;
};

type PodScoringContext = {
  repeatedPlayerPairs: ReadonlyMap<string, number>;
  repeatedDeckPairs: ReadonlyMap<string, number>;
};

function optimizePodBuckets(
  participants: PodGenerationParticipant[],
  podSizes: number[],
  scoringContext: PodScoringContext,
) {
  if (participants.length === 0) {
    return [];
  }

  const candidates = createInitialBucketCandidates(participants, podSizes);
  let bestBuckets = candidates[0] ?? [];
  let bestScore = scorePodBuckets(bestBuckets, scoringContext);
  let bestSignature = getBucketSignature(bestBuckets);

  for (const candidate of candidates) {
    const improved = improveBucketsBySwapping(candidate, scoringContext);
    const score = scorePodBuckets(improved, scoringContext);
    const signature = getBucketSignature(improved);

    if (
      score > bestScore ||
      (score === bestScore && signature.localeCompare(bestSignature) < 0)
    ) {
      bestBuckets = improved;
      bestScore = score;
      bestSignature = signature;
    }
  }

  return bestBuckets;
}

function createInitialBucketCandidates(
  participants: PodGenerationParticipant[],
  podSizes: number[],
) {
  const strongestFirst = participants.toSorted(compareParticipantsForSeating);
  const weakestFirst = strongestFirst.toReversed();
  const availabilityFirst = participants.toSorted(
    compareParticipantsByAvailability,
  );
  const alternatingStrength = interleaveEdges(strongestFirst);

  return [
    distributeRoundRobin(strongestFirst, podSizes),
    distributeContiguous(strongestFirst, podSizes),
    distributeRoundRobin(weakestFirst, podSizes),
    distributeContiguous(availabilityFirst, podSizes),
    distributeRoundRobin(alternatingStrength, podSizes),
  ];
}

function improveBucketsBySwapping(
  buckets: PodGenerationParticipant[][],
  scoringContext: PodScoringContext,
) {
  let currentBuckets = buckets.map((bucket) => [...bucket]);
  let currentScore = scorePodBuckets(currentBuckets, scoringContext);
  let currentSignature = getBucketSignature(currentBuckets);
  let improved = true;
  let iterations = 0;

  while (improved && iterations < 250) {
    improved = false;
    iterations += 1;
    let bestSwapBuckets = currentBuckets;
    let bestSwapScore = currentScore;
    let bestSwapSignature = currentSignature;

    for (
      let leftPodIndex = 0;
      leftPodIndex < currentBuckets.length;
      leftPodIndex += 1
    ) {
      const leftPod = currentBuckets[leftPodIndex] ?? [];

      for (
        let rightPodIndex = leftPodIndex + 1;
        rightPodIndex < currentBuckets.length;
        rightPodIndex += 1
      ) {
        const rightPod = currentBuckets[rightPodIndex] ?? [];

        for (
          let leftSeatIndex = 0;
          leftSeatIndex < leftPod.length;
          leftSeatIndex += 1
        ) {
          for (
            let rightSeatIndex = 0;
            rightSeatIndex < rightPod.length;
            rightSeatIndex += 1
          ) {
            const swapped = cloneBuckets(currentBuckets);
            const leftParticipant = swapped[leftPodIndex]?.[leftSeatIndex];
            const rightParticipant = swapped[rightPodIndex]?.[rightSeatIndex];

            if (!leftParticipant || !rightParticipant) {
              continue;
            }

            swapped[leftPodIndex]![leftSeatIndex] = rightParticipant;
            swapped[rightPodIndex]![rightSeatIndex] = leftParticipant;

            const score = scorePodBuckets(swapped, scoringContext);
            const signature = getBucketSignature(swapped);

            if (
              score > bestSwapScore ||
              (score === bestSwapScore &&
                signature.localeCompare(bestSwapSignature) < 0)
            ) {
              bestSwapBuckets = swapped;
              bestSwapScore = score;
              bestSwapSignature = signature;
            }
          }
        }
      }
    }

    if (
      bestSwapScore > currentScore ||
      (bestSwapScore === currentScore &&
        bestSwapSignature.localeCompare(currentSignature) < 0)
    ) {
      currentBuckets = bestSwapBuckets;
      currentScore = bestSwapScore;
      currentSignature = bestSwapSignature;
      improved = true;
    }
  }

  return currentBuckets;
}

function distributeRoundRobin(
  participants: PodGenerationParticipant[],
  podSizes: number[],
) {
  const buckets = podSizes.map(() => [] as PodGenerationParticipant[]);

  for (const participant of participants) {
    const targetIndex = buckets
      .map((bucket, index) => ({
        index,
        remaining: (podSizes[index] ?? 0) - bucket.length,
      }))
      .filter((candidate) => candidate.remaining > 0)
      .toSorted((left, right) => {
        const fillComparison =
          (podSizes[right.index] ?? 0) -
          buckets[right.index]!.length -
          ((podSizes[left.index] ?? 0) - buckets[left.index]!.length);

        if (fillComparison !== 0) {
          return fillComparison;
        }

        return left.index - right.index;
      })[0]?.index;

    if (targetIndex !== undefined) {
      buckets[targetIndex]?.push(participant);
    }
  }

  return buckets;
}

function distributeContiguous(
  participants: PodGenerationParticipant[],
  podSizes: number[],
) {
  let offset = 0;

  return podSizes.map((size) => {
    const bucket = participants.slice(offset, offset + size);
    offset += size;

    return bucket;
  });
}

function interleaveEdges(participants: PodGenerationParticipant[]) {
  const interleaved: PodGenerationParticipant[] = [];
  let left = 0;
  let right = participants.length - 1;

  while (left <= right) {
    const leftParticipant = participants[left];

    if (leftParticipant) {
      interleaved.push(leftParticipant);
    }

    if (right !== left) {
      const rightParticipant = participants[right];

      if (rightParticipant) {
        interleaved.push(rightParticipant);
      }
    }

    left += 1;
    right -= 1;
  }

  return interleaved;
}

function cloneBuckets(buckets: PodGenerationParticipant[][]) {
  return buckets.map((bucket) => [...bucket]);
}

function scorePodBuckets(
  buckets: PodGenerationParticipant[][],
  scoringContext: PodScoringContext,
) {
  return buckets.reduce(
    (score, bucket) =>
      score + scorePodParticipants(bucket, scoringContext).totalScore,
    0,
  );
}

function scorePodParticipants(
  participants: PodGenerationParticipant[],
  scoringContext: PodScoringContext,
): PodScore {
  const sizeFitScore = scorePodSize(participants.length);
  const bracketCompatibilityScore = scoreBracketCompatibility(participants);
  const deckVariety = scoreDeckVariety(participants);
  const availability = scoreAvailability(participants);
  const guestPlacement = scoreGuestPlacement(participants);
  const repeatPairing = scoreRepeatPairings(participants, scoringContext);
  const repeatPlayerPairPenalty = repeatPairing.playerPairCount * 35;
  const repeatDeckMatchupPenalty = repeatPairing.deckMatchupCount * 20;
  const totalScore =
    sizeFitScore +
    bracketCompatibilityScore +
    deckVariety.score +
    availability.score +
    guestPlacement.score -
    repeatPlayerPairPenalty -
    repeatDeckMatchupPenalty;

  return {
    sizeFitScore,
    bracketCompatibilityScore,
    repeatPlayerPairPenalty,
    repeatDeckMatchupPenalty,
    availabilityWindowScore: availability.score,
    guestPlacementScore: guestPlacement.score,
    deckVarietyScore: deckVariety.score,
    totalScore,
    deckVarietyDetails: deckVariety.details,
    repeatPairingDetails: {
      playerPairCount: repeatPairing.playerPairCount,
      deckMatchupCount: repeatPairing.deckMatchupCount,
      playerPenalty: repeatPlayerPairPenalty,
      deckPenalty: repeatDeckMatchupPenalty,
    },
    availabilityDetails: availability.details,
    guestPlacementDetails: guestPlacement.details,
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

function compareParticipantsByAvailability(
  left: PodGenerationParticipant,
  right: PodGenerationParticipant,
) {
  const statusComparison =
    rsvpStatusWeight(left.rsvpStatus) - rsvpStatusWeight(right.rsvpStatus);

  if (statusComparison !== 0) {
    return statusComparison;
  }

  const leftArrival = left.arrivalTime?.getTime() ?? 0;
  const rightArrival = right.arrivalTime?.getTime() ?? 0;

  if (leftArrival !== rightArrival) {
    return leftArrival - rightArrival;
  }

  const leftLeaving = left.leavingTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightLeaving = right.leavingTime?.getTime() ?? Number.MAX_SAFE_INTEGER;

  if (leftLeaving !== rightLeaving) {
    return rightLeaving - leftLeaving;
  }

  return compareParticipantsForSeating(left, right);
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
  const lateArrivalCount = participants.filter(
    (participant) => participant.arrivalTime !== null,
  ).length;
  const earlyLeavingCount = participants.filter(
    (participant) => participant.leavingTime !== null,
  ).length;
  const shortestOverlapMinutes = getShortestOverlapMinutes(participants);
  let penalty = maybeCount * 8;

  penalty += Math.max(0, lateArrivalCount - 1) ** 2 * 6;
  penalty += Math.max(0, earlyLeavingCount - 1) ** 2 * 6;

  if (shortestOverlapMinutes !== null) {
    if (shortestOverlapMinutes <= 0) {
      penalty += 30;
    } else if (shortestOverlapMinutes < 90) {
      penalty += 20;
    } else if (shortestOverlapMinutes < 120) {
      penalty += 10;
    }
  }

  return {
    score: Math.max(0, 40 - penalty),
    details: {
      maybeCount,
      lateArrivalCount,
      earlyLeavingCount,
      shortestOverlapMinutes,
    },
  };
}

function scoreDeckVariety(participants: PodGenerationParticipant[]) {
  const deckParticipants = participants.filter(
    (participant) => participant.deckDeclaration !== null,
  );
  const colorIdentityCounts = new Map<string, number>();
  const archetypeCounts = new Map<string, number>();
  const commanderCounts = new Map<string, number>();

  for (const participant of deckParticipants) {
    const deck = participant.deckDeclaration;

    if (!deck) {
      continue;
    }

    incrementCount(
      colorIdentityCounts,
      normalizeColorIdentity(deck.colorIdentitySnapshot),
    );

    if (deck.archetypeSnapshot.trim()) {
      incrementCount(
        archetypeCounts,
        deck.archetypeSnapshot.trim().toLowerCase(),
      );
    }

    for (const commander of deck.commanderSnapshot) {
      const normalizedCommander = commander.trim().toLowerCase();

      if (normalizedCommander) {
        incrementCount(commanderCounts, normalizedCommander);
      }
    }
  }

  const repeatedColorIdentityCount = countRepeatedValues(colorIdentityCounts);
  const repeatedArchetypeCount = countRepeatedValues(archetypeCounts);
  const repeatedCommanderCount = countRepeatedValues(commanderCounts);
  const penalty =
    repeatedColorIdentityCount * 5 +
    repeatedArchetypeCount * 8 +
    repeatedCommanderCount * 10;

  return {
    score: Math.max(0, 40 - penalty),
    details: {
      score: Math.max(0, 40 - penalty),
      declaredDeckCount: deckParticipants.length,
      uniqueColorIdentityCount: colorIdentityCounts.size,
      repeatedColorIdentityCount,
      repeatedArchetypeCount,
      repeatedCommanderCount,
    },
  };
}

function scoreGuestPlacement(participants: PodGenerationParticipant[]) {
  const guestCount = participants.filter(isGuestParticipant).length;
  const userBackedCount = participants.length - guestCount;
  const repeatedGuestCount = Math.max(0, guestCount - 1);
  const isolatedGuestPod = guestCount > 0 && userBackedCount === 0;
  let penalty = repeatedGuestCount * 24;

  if (guestCount === 0) {
    return {
      score: 0,
      details: {
        score: 0,
        guestCount,
        userBackedCount,
        repeatedGuestCount,
        isolatedGuestPod,
      },
    };
  }

  if (isolatedGuestPod) {
    penalty += 40;
  }

  if (guestCount >= 3 && userBackedCount === 1) {
    penalty += 12;
  }
  const score = Math.max(0, 40 - penalty);

  return {
    score,
    details: {
      score,
      guestCount,
      userBackedCount,
      repeatedGuestCount,
      isolatedGuestPod,
    },
  };
}

function isGuestParticipant(participant: PodGenerationParticipant) {
  return participant.userId === null;
}

function scoreRepeatPairings(
  participants: PodGenerationParticipant[],
  scoringContext: PodScoringContext,
) {
  let playerPairCount = 0;
  let deckMatchupCount = 0;

  for (const [left, right] of getParticipantPairs(participants)) {
    const playerPairKey = makePairKey(left.userId, right.userId);

    if (playerPairKey) {
      playerPairCount +=
        scoringContext.repeatedPlayerPairs.get(playerPairKey) ?? 0;
    }

    const leftDeckId = left.deckDeclaration?.deckId ?? null;
    const rightDeckId = right.deckDeclaration?.deckId ?? null;
    const deckPairKey = makePairKey(leftDeckId, rightDeckId);

    if (deckPairKey) {
      deckMatchupCount +=
        scoringContext.repeatedDeckPairs.get(deckPairKey) ?? 0;
    }
  }

  return {
    playerPairCount,
    deckMatchupCount,
  };
}

function createScoringContext(
  matchupHistory: readonly PodGenerationMatchupHistory[],
): PodScoringContext {
  const repeatedPlayerPairs = new Map<string, number>();
  const repeatedDeckPairs = new Map<string, number>();

  for (const matchup of matchupHistory) {
    const playerPairKey = makePairKey(matchup.leftUserId, matchup.rightUserId);
    const deckPairKey = makePairKey(matchup.leftDeckId, matchup.rightDeckId);

    if (playerPairKey) {
      incrementCount(repeatedPlayerPairs, playerPairKey);
    }

    if (deckPairKey) {
      incrementCount(repeatedDeckPairs, deckPairKey);
    }
  }

  return {
    repeatedPlayerPairs,
    repeatedDeckPairs,
  };
}

function getParticipantPairs(participants: PodGenerationParticipant[]) {
  const pairs: [PodGenerationParticipant, PodGenerationParticipant][] = [];

  for (let leftIndex = 0; leftIndex < participants.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < participants.length;
      rightIndex += 1
    ) {
      const left = participants[leftIndex];
      const right = participants[rightIndex];

      if (left && right) {
        pairs.push([left, right]);
      }
    }
  }

  return pairs;
}

function getShortestOverlapMinutes(participants: PodGenerationParticipant[]) {
  const arrivals = participants
    .map((participant) => participant.arrivalTime?.getTime())
    .filter((time) => time !== undefined);
  const departures = participants
    .map((participant) => participant.leavingTime?.getTime())
    .filter((time) => time !== undefined);

  if (arrivals.length === 0 || departures.length === 0) {
    return null;
  }

  const overlapStart = Math.max(...arrivals);
  const overlapEnd = Math.min(...departures);

  return Math.floor((overlapEnd - overlapStart) / 60_000);
}

function makePairKey(left: string | null, right: string | null) {
  if (!left || !right || left === right) {
    return null;
  }

  return [left, right].toSorted().join("\u0000");
}

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function countRepeatedValues(map: ReadonlyMap<string, number>) {
  return [...map.values()].reduce(
    (total, count) => total + Math.max(0, count - 1),
    0,
  );
}

function normalizeColorIdentity(colorIdentity: string) {
  const colors = new Set(colorIdentity.trim().toUpperCase().split(""));

  return ["W", "U", "B", "R", "G"]
    .filter((color) => colors.has(color))
    .join("");
}

function getBucketSignature(buckets: PodGenerationParticipant[][]) {
  return buckets
    .map((bucket) =>
      bucket
        .map((participant) => getParticipantIdentity(participant))
        .toSorted()
        .join(","),
    )
    .join("|");
}

function getParticipantIdentity(participant: PodGenerationParticipant) {
  return participant.userId ?? `guest:${participant.rsvpId}`;
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
