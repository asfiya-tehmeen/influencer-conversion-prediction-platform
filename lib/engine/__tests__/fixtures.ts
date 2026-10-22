import type { BrandTarget, InfluencerMetrics } from "../types";

export const baseInfluencer: InfluencerMetrics = {
  platform: "instagram",
  niche: "fitness",
  followers: 50_000,
  avgViewsPerPost: 10_000,
  avgLikes: 500,
  avgComments: 50,
  avgShares: 30,
  avgSaves: 20,
  followerGrowth30dPct: 2,
  audienceCountrySplit: { AE: 0.5, SA: 0.3, US: 0.2 },
  audienceAgeSplit: { "18-24": 0.4, "25-34": 0.4, "35-44": 0.2 },
  feePerPost: 500,
  fakeFollowerSignals: { commentQuality: 0.8, growthSpike: false },
};

export const baseBrand: BrandTarget = {
  industry: "supplements",
  targetCountries: ["AE", "SA"],
  targetAgeMin: 18,
  targetAgeMax: 34,
  avgOrderValue: 50,
  marginPct: 0.4,
  baselineConversionRate: 0.02,
};
