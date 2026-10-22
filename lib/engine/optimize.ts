export interface MixCandidate<Id> {
  id: Id;
  /** Fee per post; null = unknown, never selected. */
  feePerPost: number | null;
  conversionsPerPost: number;
}

export interface MixResult<Id> {
  selected: Id[];
  totalCost: number;
  totalConversions: number;
  remainingBudget: number;
}

/**
 * Greedy budget allocation: sort by conversions per dollar and take each influencer whose
 * full booking (fee x posts) still fits in the remaining budget.
 * Not guaranteed optimal (that is a knapsack problem) but simple, explainable and usually close.
 */
export function pickBestMix<Id>(candidates: MixCandidate<Id>[], budget: number, postsPerInfluencer: number): MixResult<Id> {
  const posts = Math.max(1, Math.floor(postsPerInfluencer) || 1);
  let remaining = Number.isFinite(budget) && budget > 0 ? budget : 0;
  const usable = candidates
    .filter((c) => c.feePerPost !== null && Number.isFinite(c.feePerPost) && c.feePerPost >= 0 && c.conversionsPerPost > 0)
    .map((c) => {
      const cost = (c.feePerPost as number) * posts;
      const conv = c.conversionsPerPost * posts;
      // Free posts have infinite value per dollar and sort first.
      return { c, cost, conv, perDollar: cost === 0 ? Infinity : conv / cost };
    })
    .sort((a, b) => (a.perDollar === b.perDollar ? b.conv - a.conv : b.perDollar > a.perDollar ? 1 : -1));

  const selected: Id[] = [];
  let totalCost = 0;
  let totalConversions = 0;
  for (const u of usable) {
    if (u.cost <= remaining) {
      selected.push(u.c.id);
      remaining -= u.cost;
      totalCost += u.cost;
      totalConversions += u.conv;
    }
  }
  return { selected, totalCost, totalConversions, remainingBudget: remaining };
}
