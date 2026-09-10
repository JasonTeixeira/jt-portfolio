// Pure inbound-lead "intent" scoring — how likely a prospect is to close, so the operator chases
// the hottest first. Uses only the fields the marketing view already has (stage + recency). No I/O.
// Higher score = hotter. This is CLOSE-intent, distinct from the "needs a touch" staleness sort.

export const STAGE_WEIGHT = { engaged: 55, scoped: 35, new: 12, won: 0, lost: 0 };

// Recency of last activity: a prospect who engaged in the last day or two is red-hot; one that's
// been quiet for weeks has cooled. (Fresh + engaged = the deal to call right now.)
function recencyPoints(daysSinceActivity) {
  const d = Number(daysSinceActivity);
  if (!Number.isFinite(d)) return 0;
  if (d <= 1) return 35;
  if (d <= 3) return 25;
  if (d <= 7) return 14;
  if (d <= 14) return 6;
  return 0;
}

export function scoreLead(lead) {
  if (!lead) return { score: 0, tier: 'cool' };
  if (lead.stage === 'won' || lead.stage === 'lost') return { score: 0, tier: 'cool' }; // closed → never "hot"
  const sw = STAGE_WEIGHT[lead.stage] != null ? STAGE_WEIGHT[lead.stage] : 10;
  const score = Math.max(0, Math.min(100, sw + recencyPoints(lead.daysSinceActivity)));
  const tier = score >= 60 ? 'hot' : score >= 35 ? 'warm' : 'cool';
  return { score, tier };
}

// Rank hottest-first; tie-break toward the one that's been waiting longer for a touch.
export function rankLeads(leads) {
  return [...(leads || [])]
    .map((l) => ({ ...l, _score: scoreLead(l) }))
    .sort((a, b) => (b._score.score - a._score.score)
      || ((b.needsAction ? 1 : 0) - (a.needsAction ? 1 : 0))
      || ((b.daysSinceActivity || 0) - (a.daysSinceActivity || 0)));
}
