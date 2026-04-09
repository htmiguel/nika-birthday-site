/** People-count milestones; after 1000, next target steps by 500. */
const MILESTONES = [10, 25, 50, 100, 250, 500, 1000] as const;

export function nextMilestone(uniquePeople: number): number {
  const found = MILESTONES.find((g) => g > uniquePeople);
  if (found != null) return found;
  const n = uniquePeople + 1;
  return Math.ceil(n / 500) * 500;
}

/** Largest fixed milestone still at or below `uniquePeople` (0 if none). */
function fixedFloor(uniquePeople: number): number {
  const atOrBelow = MILESTONES.filter((m) => m <= uniquePeople);
  return atOrBelow.length ? atOrBelow[atOrBelow.length - 1] : 0;
}

export function progressTowardNextGoal(uniquePeople: number): {
  nextGoal: number;
  prevTier: number;
  progressPct: number;
  remaining: number;
} {
  const nextGoal = nextMilestone(uniquePeople);

  let prevTier: number;
  if (nextGoal <= 1000) {
    prevTier = fixedFloor(uniquePeople);
  } else {
    prevTier = nextGoal - 500;
  }

  const span = nextGoal - prevTier;
  const progressPct =
    span <= 0 ? 100 : Math.min(100, Math.round(((uniquePeople - prevTier) / span) * 100));
  const remaining = Math.max(0, nextGoal - uniquePeople);
  return { nextGoal, prevTier, progressPct, remaining };
}
