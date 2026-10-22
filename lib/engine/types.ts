import type { FollowerTier, Platform } from "./config";

/** Shares keyed by country code or age bucket. Values are fractions; they are normalised before use. */
export type Split = Record<string, number>;

/** Engine view of an influencer. Every metric may be missing (null). */
export interface InfluencerMetrics {
  platform: Platform;
  niche: string;
  followers: number | null;
  avgViewsPerPost: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  avgShares: number | null;
  avgSaves: number | null;
  followerGrowth30dPct: number | null;
  audienceCountrySplit: Split | null;
  audienceAgeSplit: Split | null;
  feePerPost: number | null;
  fakeFollowerSignals: { commentQuality?: number | null; growthSpike?: boolean | null } | null;
}

/** Who the brand wants to reach and what a conversion is worth. */
export interface BrandTarget {
  /** null = no industry, niche fit is neutral. */
  industry: string | null;
  /** Empty = every country counts. */
  targetCountries: string[];
  targetAgeMin: number;
  targetAgeMax: number;
  avgOrderValue: number;
  /** Fraction, 0.4 = 40%. */
  marginPct: number;
  /** Landing page conversion rate, fraction. */
  baselineConversionRate: number | null;
}

export interface AuthenticityReason {
  code: "low_engagement" | "very_low_engagement" | "growth_spike" | "low_comment_quality" | "mediocre_comment_quality" | "floor";
  label: string;
  penalty: number;
}

/** Calibration for one platform+niche group. */
export interface CalibrationGroup {
  platform: Platform;
  niche: string;
  /** Results that informed CTR (had reach > 0). */
  ctrCount: number;
  observedBaseCtr: number | null;
  benchmarkBaseCtr: number;
  ctrWeight: number;
  blendedBaseCtr: number;
  /** Results that informed CVR (had clicks > 0). */
  cvrCount: number;
  /** Observed CVR divided by the brand's baseline CVR (1.0 = landing page performed as expected). */
  observedCvrMultiplier: number | null;
  cvrWeight: number;
  blendedCvrMultiplier: number;
}

export type Calibration = Record<string, CalibrationGroup>;

export interface PredictionContext {
  nicheFit: Record<string, Record<string, number>>;
  calibration?: Calibration;
  /** How many past CampaignResults exist for THIS influencer (narrows the range). */
  influencerResultsCount?: number;
}

export interface Prediction {
  effectiveReach: number;
  reachSource: "views" | "followers_estimate" | "missing";
  followerTier: FollowerTier;
  engagementRate: number | null;
  benchmarkEngagementRate: number;
  /** engagementRate / benchmark, null when engagement is unknown. */
  engagementRatio: number | null;
  audienceMatch: number;
  audienceDetail: { countryShare: number | null; ageShare: number | null; notes: string[] };
  authenticity: number;
  authenticityReasons: AuthenticityReason[];
  nicheFit: number;
  nicheFitSource: "matrix" | "fallback" | "no_industry";
  baseCtr: number;
  baseCtrSource: "benchmark" | "calibrated";
  engagementMultiplier: number;
  ctr: number;
  cvr: number;
  cvrSource: "brand_baseline" | "default" | "calibrated";
  /** effective_reach x audience_match x authenticity */
  qualifiedReach: number;
  /** effective_reach x engagement_rate (context only, not used in the formula) */
  engagedUsers: number;
  expectedClicks: number;
  expectedConversions: number;
  range: { low: number; high: number; halfWidth: number; resultsCount: number; notes: string[] };
  /** null when fee is missing or conversions are 0. */
  cpa: number | null;
  profitPerConversion: number;
  fairValuePerPost: number;
  warnings: string[];
}
