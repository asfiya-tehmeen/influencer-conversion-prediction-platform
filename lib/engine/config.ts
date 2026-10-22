/**
 * Every benchmark constant used by the prediction engine lives here.
 *
 * These are the DEFAULTS. The admin page can override any value; overrides
 * are stored in the `settings` table and deep-merged on top of this object
 * (see `mergeConfig`). All rates are fractions (0.012 = 1.2%).
 */

export const PLATFORMS = ["instagram", "tiktok", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const FOLLOWER_TIERS = ["nano", "micro", "mid", "macro", "mega"] as const;
export type FollowerTier = (typeof FOLLOWER_TIERS)[number];

/** Age buckets used for audience_age_split. "55+" is treated as 55-64. */
export const AGE_BUCKETS = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"] as const;

export interface EngineConfig {
  /** Share of followers who typically see a post, used only when avg_views_per_post is missing. */
  reachRatio: Record<Platform, number>;
  /** Click-through rate on a sponsored post with an average engagement rate and neutral niche fit. */
  baseCtr: Record<Platform, number>;
  /** Upper follower bound (inclusive) for each tier. The last tier ("mega") has no upper bound. */
  tierMaxFollowers: Record<Exclude<FollowerTier, "mega">, number>;
  /** "Normal" engagement rate per view, by platform and follower tier. Bigger accounts engage less. */
  engagementBenchmark: Record<Platform, Record<FollowerTier, number>>;
  /** CTR is scaled by engagement_rate / benchmark, clamped to this range. */
  engagementMultiplier: { min: number; max: number };
  /** Bounds and fallback for the niche x industry fit multiplier. */
  nicheFit: { min: number; max: number; fallback: number };
  authenticity: {
    /** Score never goes below this, even if every penalty applies. */
    floor: number;
    /** Engagement ratio (ER / benchmark) below this counts as "low engagement". */
    lowEngagementRatio: number;
    lowEngagementPenalty: number;
    /** Below this ratio it counts as "very low" and the bigger penalty applies instead. */
    veryLowEngagementRatio: number;
    veryLowEngagementPenalty: number;
    /** Applied when fake_follower_signals.growth_spike is true. */
    growthSpikePenalty: number;
    /** 30-day follower growth above this % is treated as a spike even if the flag is not set. */
    suspiciousGrowthPct: number;
    /** comment_quality (0-1) below this is "low"... */
    lowCommentQuality: number;
    lowCommentQualityPenalty: number;
    /** ...and below this (but above "low") is "mediocre". */
    mediocreCommentQuality: number;
    mediocreCommentQualityPenalty: number;
  };
  audience: {
    /** Audience match assumed when the influencer has no audience split data at all. */
    missingMatch: number;
  };
  /** Levels the "Know your value" page treats as healthy when looking for the weakest metric. */
  insights: {
    /** Audience match with the reference brand at or above this is considered healthy. */
    healthyAudienceMatch: number;
  };
  /** Controls the low/high band around expected conversions. Expressed as +/- fraction of the estimate. */
  uncertainty: {
    /** Narrowest possible band, even with lots of past results. */
    minHalfWidth: number;
    /** Extra width when the influencer has no past results; decays as results accumulate. */
    noHistoryHalfWidth: number;
    /** Decay speed: extra width = noHistoryHalfWidth * k / (k + results_count). */
    historyK: number;
    /** Added when reach is estimated from followers (no views data). */
    estimatedReachPenalty: number;
    /** Added when audience splits are missing. */
    missingAudiencePenalty: number;
    /** Added when likes/comments/shares/saves are all missing. */
    missingEngagementPenalty: number;
    /** Hard cap so the low end never reaches zero. */
    maxHalfWidth: number;
  };
  /** Shrinkage constant for calibration: weight = n / (n + k). */
  calibrationK: number;
  /** Used for a brand that has no baseline conversion rate set. */
  defaultCvr: number;
  /**
   * Generic brand used on the influencer "Know your value" page when no specific brand is chosen.
   * Neutral niche fit (no industry), all countries, broad adult age range.
   */
  referenceBrand: {
    avgOrderValue: number;
    marginPct: number;
    baselineConversionRate: number;
    targetAgeMin: number;
    targetAgeMax: number;
  };
}

export const DEFAULT_CONFIG: EngineConfig = {
  reachRatio: { instagram: 0.12, tiktok: 0.2, youtube: 0.15 },
  baseCtr: { instagram: 0.012, tiktok: 0.01, youtube: 0.018 },
  tierMaxFollowers: { nano: 10_000, micro: 100_000, mid: 500_000, macro: 1_000_000 },
  // Engagement here is interactions per VIEW, which runs higher than the usual per-follower figure.
  engagementBenchmark: {
    instagram: { nano: 0.08, micro: 0.06, mid: 0.045, macro: 0.035, mega: 0.03 },
    tiktok: { nano: 0.1, micro: 0.08, mid: 0.07, macro: 0.06, mega: 0.05 },
    youtube: { nano: 0.06, micro: 0.05, mid: 0.04, macro: 0.035, mega: 0.03 },
  },
  engagementMultiplier: { min: 0.5, max: 2.0 },
  nicheFit: { min: 0.5, max: 1.5, fallback: 1.0 },
  authenticity: {
    floor: 0.3,
    lowEngagementRatio: 0.5,
    lowEngagementPenalty: 0.15,
    veryLowEngagementRatio: 0.25,
    veryLowEngagementPenalty: 0.3,
    growthSpikePenalty: 0.2,
    suspiciousGrowthPct: 30,
    lowCommentQuality: 0.4,
    lowCommentQualityPenalty: 0.25,
    mediocreCommentQuality: 0.6,
    mediocreCommentQualityPenalty: 0.1,
  },
  audience: { missingMatch: 0.5 },
  insights: { healthyAudienceMatch: 0.7 },
  uncertainty: {
    minHalfWidth: 0.15,
    noHistoryHalfWidth: 0.45,
    historyK: 5,
    estimatedReachPenalty: 0.15,
    missingAudiencePenalty: 0.1,
    missingEngagementPenalty: 0.1,
    maxHalfWidth: 0.9,
  },
  calibrationK: 5,
  defaultCvr: 0.02,
  referenceBrand: {
    avgOrderValue: 60,
    marginPct: 0.4,
    baselineConversionRate: 0.02,
    targetAgeMin: 18,
    targetAgeMax: 44,
  },
};

/** Niche x industry fit. 1.0 = neutral, >1 the audience is primed to buy, <1 a poor fit. */
export type NicheFitMatrix = Record<string, Record<string, number>>;

export const DEFAULT_NICHE_FIT: NicheFitMatrix = {
  fitness: { supplements: 1.4, sportswear: 1.4, cosmetics: 0.9, consumer_electronics: 0.9, banking: 0.6, food_delivery: 0.8, travel: 0.9 },
  beauty: { supplements: 1.0, sportswear: 0.9, cosmetics: 1.5, consumer_electronics: 0.7, banking: 0.6, food_delivery: 0.8, travel: 0.9 },
  tech: { supplements: 0.6, sportswear: 0.7, cosmetics: 0.6, consumer_electronics: 1.5, banking: 1.1, food_delivery: 0.8, travel: 0.8 },
  food: { supplements: 0.9, sportswear: 0.6, cosmetics: 0.7, consumer_electronics: 0.7, banking: 0.6, food_delivery: 1.5, travel: 1.1 },
  travel: { supplements: 0.7, sportswear: 0.9, cosmetics: 0.9, consumer_electronics: 1.0, banking: 1.0, food_delivery: 0.9, travel: 1.5 },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type ConfigOverrides = DeepPartial<EngineConfig>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge overrides onto defaults. Non-finite or wrongly-typed override values are ignored. */
export function mergeConfig(base: EngineConfig, overrides: unknown): EngineConfig {
  const merge = (b: unknown, o: unknown): unknown => {
    if (isPlainObject(b)) {
      if (!isPlainObject(o)) return b;
      const out: Record<string, unknown> = { ...b };
      for (const key of Object.keys(b)) out[key] = merge(b[key], o[key]);
      return out;
    }
    if (typeof b === "number") return typeof o === "number" && Number.isFinite(o) ? o : b;
    return b;
  };
  return merge(base, overrides) as EngineConfig;
}
