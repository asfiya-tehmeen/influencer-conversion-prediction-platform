import type { EngineConfig, FollowerTier, Platform } from "./config";
import type {
  AuthenticityReason,
  BrandTarget,
  CalibrationGroup,
  InfluencerMetrics,
  Prediction,
  PredictionContext,
  Split,
} from "./types";

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** A usable non-negative number, or null for missing / NaN / negative input. */
export function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

export const calibrationKey = (platform: Platform, niche: string) => `${platform}|${niche.trim().toLowerCase()}`;

// ---------------------------------------------------------------------------
// 1. Effective reach
// ---------------------------------------------------------------------------

export function effectiveReach(m: InfluencerMetrics, config: EngineConfig): { reach: number; source: Prediction["reachSource"] } {
  const views = num(m.avgViewsPerPost);
  if (views !== null && views > 0) return { reach: views, source: "views" };
  const followers = num(m.followers);
  if (followers !== null && followers > 0) {
    return { reach: followers * config.reachRatio[m.platform], source: "followers_estimate" };
  }
  return { reach: 0, source: "missing" };
}

export function followerTier(followers: number | null, config: EngineConfig): FollowerTier {
  const f = num(followers) ?? 0;
  const t = config.tierMaxFollowers;
  if (f <= t.nano) return "nano";
  if (f <= t.micro) return "micro";
  if (f <= t.mid) return "mid";
  if (f <= t.macro) return "macro";
  return "mega";
}

// ---------------------------------------------------------------------------
// 2. Engagement rate
// ---------------------------------------------------------------------------

/** (likes + comments + shares + saves) / reach. Missing parts are skipped; null if all are missing or reach is 0. */
export function engagementRate(m: InfluencerMetrics, reach: number): number | null {
  const parts = [m.avgLikes, m.avgComments, m.avgShares, m.avgSaves].map(num).filter((v): v is number => v !== null);
  if (parts.length === 0 || reach <= 0) return null;
  return parts.reduce((a, b) => a + b, 0) / reach;
}

// ---------------------------------------------------------------------------
// 3. Audience match
// ---------------------------------------------------------------------------

function normalisedEntries(split: Split | null): [string, number][] | null {
  if (!split) return null;
  const entries = Object.entries(split)
    .map(([k, v]) => [k, num(v)] as const)
    .filter((e): e is readonly [string, number] => e[1] !== null);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (total <= 0) return null;
  return entries.map(([k, v]) => [k, v / total]);
}

/** Parse "18-24" -> [18, 24], "55+" -> [55, 64]. */
export function parseAgeBucket(bucket: string): [number, number] | null {
  const range = bucket.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (range) return [Number(range[1]), Number(range[2])];
  const plus = bucket.match(/^\s*(\d+)\s*\+\s*$/);
  if (plus) return [Number(plus[1]), Number(plus[1]) + 9];
  return null;
}

export function countryShare(split: Split | null, targetCountries: string[]): number | null {
  if (targetCountries.length === 0) return 1;
  const entries = normalisedEntries(split);
  if (!entries) return null;
  const targets = new Set(targetCountries.map((c) => c.trim().toUpperCase()));
  return entries.filter(([c]) => targets.has(c.trim().toUpperCase())).reduce((a, [, v]) => a + v, 0);
}

/** Share of the audience inside [min, max], assuming ages are spread evenly within each bucket. */
export function ageShare(split: Split | null, min: number, max: number): number | null {
  const entries = normalisedEntries(split);
  if (!entries) return null;
  let share = 0;
  for (const [bucket, v] of entries) {
    const range = parseAgeBucket(bucket);
    if (!range) continue;
    const [lo, hi] = range;
    const overlap = Math.max(0, Math.min(hi, max) - Math.max(lo, min) + 1);
    share += v * (overlap / (hi - lo + 1));
  }
  return share;
}

/**
 * Share of the audience in the brand's target countries AND age range.
 * Country and age are assumed independent (we only have the two marginal splits).
 */
export function audienceMatch(m: InfluencerMetrics, brand: BrandTarget, config: EngineConfig): Prediction["audienceDetail"] & { match: number } {
  const notes: string[] = [];
  const c = countryShare(m.audienceCountrySplit, brand.targetCountries);
  const a = ageShare(m.audienceAgeSplit, brand.targetAgeMin, brand.targetAgeMax);
  if (c === null) notes.push(`No country split; assumed ${pct(config.audience.missingMatch)} in target countries.`);
  if (a === null) notes.push(`No age split; assumed ${pct(config.audience.missingMatch)} in target ages.`);
  let match: number;
  if (c === null && a === null) match = config.audience.missingMatch;
  else match = (c ?? config.audience.missingMatch) * (a ?? config.audience.missingMatch);
  return { match: clamp(match, 0, 1), countryShare: c, ageShare: a, notes };
}

// ---------------------------------------------------------------------------
// 4. Authenticity
// ---------------------------------------------------------------------------

export function authenticity(
  m: InfluencerMetrics,
  engagementRatio: number | null,
  config: EngineConfig,
): { score: number; reasons: AuthenticityReason[] } {
  const a = config.authenticity;
  const reasons: AuthenticityReason[] = [];

  if (engagementRatio !== null) {
    if (engagementRatio < a.veryLowEngagementRatio) {
      reasons.push({
        code: "very_low_engagement",
        label: `Engagement is ${pct(engagementRatio, 0)} of the normal level for this platform and size`,
        penalty: a.veryLowEngagementPenalty,
      });
    } else if (engagementRatio < a.lowEngagementRatio) {
      reasons.push({
        code: "low_engagement",
        label: `Engagement is ${pct(engagementRatio, 0)} of the normal level for this platform and size`,
        penalty: a.lowEngagementPenalty,
      });
    }
  }

  const growth = typeof m.followerGrowth30dPct === "number" && Number.isFinite(m.followerGrowth30dPct) ? m.followerGrowth30dPct : null;
  const flagged = m.fakeFollowerSignals?.growthSpike === true;
  const steep = growth !== null && growth > a.suspiciousGrowthPct;
  if (flagged || steep) {
    reasons.push({
      code: "growth_spike",
      label: steep
        ? `Followers grew ${growth}% in 30 days (above ${a.suspiciousGrowthPct}%), a common sign of bought followers`
        : "Sudden follower spike detected",
      penalty: a.growthSpikePenalty,
    });
  }

  const quality = m.fakeFollowerSignals?.commentQuality;
  if (typeof quality === "number" && Number.isFinite(quality)) {
    if (quality < a.lowCommentQuality) {
      reasons.push({ code: "low_comment_quality", label: `Comment quality is low (${quality.toFixed(2)}): many generic or bot-like comments`, penalty: a.lowCommentQualityPenalty });
    } else if (quality < a.mediocreCommentQuality) {
      reasons.push({ code: "mediocre_comment_quality", label: `Comment quality is mediocre (${quality.toFixed(2)})`, penalty: a.mediocreCommentQualityPenalty });
    }
  }

  const raw = 1 - reasons.reduce((s, r) => s + r.penalty, 0);
  if (raw < a.floor) {
    reasons.push({ code: "floor", label: `Score floored at ${a.floor}`, penalty: 0 });
  }
  return { score: clamp(raw, a.floor, 1), reasons };
}

// ---------------------------------------------------------------------------
// 5-6. CTR and niche fit
// ---------------------------------------------------------------------------

export function nicheFit(
  matrix: PredictionContext["nicheFit"],
  niche: string,
  industry: string | null,
  config: EngineConfig,
): { value: number; source: Prediction["nicheFitSource"] } {
  if (!industry) return { value: config.nicheFit.fallback, source: "no_industry" };
  const v = matrix[niche.trim().toLowerCase()]?.[industry.trim().toLowerCase()];
  if (typeof v === "number" && Number.isFinite(v)) {
    return { value: clamp(v, config.nicheFit.min, config.nicheFit.max), source: "matrix" };
  }
  return { value: config.nicheFit.fallback, source: "fallback" };
}

export function engagementMultiplier(engagementRatio: number | null, config: EngineConfig): number {
  if (engagementRatio === null) return 1;
  return clamp(engagementRatio, config.engagementMultiplier.min, config.engagementMultiplier.max);
}

// ---------------------------------------------------------------------------
// Range
// ---------------------------------------------------------------------------

export function rangeHalfWidth(
  resultsCount: number,
  flags: { estimatedReach: boolean; missingAudience: boolean; missingEngagement: boolean },
  config: EngineConfig,
): { halfWidth: number; notes: string[] } {
  const u = config.uncertainty;
  const n = Math.max(0, resultsCount);
  const notes: string[] = [];
  let hw = u.minHalfWidth + u.noHistoryHalfWidth * (u.historyK / (u.historyK + n));
  notes.push(n === 0 ? "No past campaign results for this influencer" : `${n} past campaign result${n === 1 ? "" : "s"} narrow the range`);
  if (flags.estimatedReach) {
    hw += u.estimatedReachPenalty;
    notes.push("Reach estimated from followers");
  }
  if (flags.missingAudience) {
    hw += u.missingAudiencePenalty;
    notes.push("Audience split missing");
  }
  if (flags.missingEngagement) {
    hw += u.missingEngagementPenalty;
    notes.push("Engagement data missing");
  }
  return { halfWidth: Math.min(hw, u.maxHalfWidth), notes };
}

// ---------------------------------------------------------------------------
// Full prediction
// ---------------------------------------------------------------------------

/**
 * Expected conversions per post =
 *   effective_reach x audience_match x authenticity x CTR x CVR
 */
export function predict(m: InfluencerMetrics, brand: BrandTarget, config: EngineConfig, ctx: PredictionContext): Prediction {
  const warnings: string[] = [];

  const { reach, source: reachSource } = effectiveReach(m, config);
  if (reachSource === "followers_estimate") warnings.push(`No views data; reach estimated as followers x ${config.reachRatio[m.platform]}.`);
  if (reachSource === "missing") warnings.push("No views or follower data; reach is 0.");

  const tierFollowers = num(m.followers) ?? (reach > 0 ? reach / config.reachRatio[m.platform] : 0);
  const tier = followerTier(tierFollowers, config);
  const benchmarkER = config.engagementBenchmark[m.platform][tier];
  const er = engagementRate(m, reach);
  const erRatio = er === null ? null : er / benchmarkER;
  if (er === null && reach > 0) warnings.push("No engagement data; engagement treated as average.");

  const audience = audienceMatch(m, brand, config);
  const auth = authenticity(m, erRatio, config);
  const fit = nicheFit(ctx.nicheFit, m.niche, brand.industry, config);
  if (fit.source === "fallback") warnings.push(`No niche-fit value for ${m.niche} x ${brand.industry}; using ${config.nicheFit.fallback}.`);

  const group: CalibrationGroup | undefined = ctx.calibration?.[calibrationKey(m.platform, m.niche)];
  const useCalibratedCtr = !!group && group.ctrCount > 0;
  const baseCtr = useCalibratedCtr ? group.blendedBaseCtr : config.baseCtr[m.platform];
  const erMult = engagementMultiplier(erRatio, config);
  const ctr = baseCtr * erMult * fit.value;

  const brandCvr = num(brand.baselineConversionRate);
  const baselineCvr = brandCvr !== null && brandCvr > 0 ? brandCvr : config.defaultCvr;
  const useCalibratedCvr = !!group && group.cvrCount > 0;
  const cvr = useCalibratedCvr ? baselineCvr * group.blendedCvrMultiplier : baselineCvr;
  const cvrSource: Prediction["cvrSource"] = useCalibratedCvr ? "calibrated" : brandCvr !== null && brandCvr > 0 ? "brand_baseline" : "default";
  if (cvrSource === "default") warnings.push(`Brand has no baseline conversion rate; using ${pct(config.defaultCvr)}.`);

  const qualifiedReach = reach * audience.match * auth.score;
  const expectedClicks = qualifiedReach * ctr;
  const expectedConversions = expectedClicks * cvr;

  const resultsCount = ctx.influencerResultsCount ?? 0;
  const { halfWidth, notes } = rangeHalfWidth(
    resultsCount,
    {
      estimatedReach: reachSource !== "views",
      missingAudience: audience.countryShare === null || audience.ageShare === null,
      missingEngagement: er === null,
    },
    config,
  );

  const fee = num(m.feePerPost);
  if (fee === null) warnings.push("No fee per post; CPA cannot be computed.");
  const cpa = fee !== null && expectedConversions > 0 ? fee / expectedConversions : null;

  const profitPerConversion = (num(brand.avgOrderValue) ?? 0) * (num(brand.marginPct) ?? 0);

  return {
    effectiveReach: reach,
    reachSource,
    followerTier: tier,
    engagementRate: er,
    benchmarkEngagementRate: benchmarkER,
    engagementRatio: erRatio,
    audienceMatch: audience.match,
    audienceDetail: { countryShare: audience.countryShare, ageShare: audience.ageShare, notes: audience.notes },
    authenticity: auth.score,
    authenticityReasons: auth.reasons,
    nicheFit: fit.value,
    nicheFitSource: fit.source,
    baseCtr,
    baseCtrSource: useCalibratedCtr ? "calibrated" : "benchmark",
    engagementMultiplier: erMult,
    ctr,
    cvr,
    cvrSource,
    qualifiedReach,
    engagedUsers: er === null ? 0 : reach * er,
    expectedClicks,
    expectedConversions,
    range: {
      low: expectedConversions * (1 - halfWidth),
      high: expectedConversions * (1 + halfWidth),
      halfWidth,
      resultsCount,
      notes,
    },
    cpa,
    profitPerConversion,
    fairValuePerPost: expectedConversions * profitPerConversion,
    warnings,
  };
}

/** Format a fraction as a percentage string. Shared by engine labels and UI. */
export function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

