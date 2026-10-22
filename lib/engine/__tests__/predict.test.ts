import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_NICHE_FIT, mergeConfig } from "../config";
import {
  ageShare,
  audienceMatch,
  authenticity,
  countryShare,
  effectiveReach,
  engagementRate,
  followerTier,
  nicheFit,
  parseAgeBucket,
  predict,
  rangeHalfWidth,
} from "../predict";
import type { InfluencerMetrics } from "../types";
import { baseBrand, baseInfluencer } from "./fixtures";

const config = DEFAULT_CONFIG;
const ctx = { nicheFit: DEFAULT_NICHE_FIT };

describe("predict: normal case", () => {
  const p = predict(baseInfluencer, baseBrand, config, ctx);

  it("computes each factor", () => {
    expect(p.effectiveReach).toBe(10_000);
    expect(p.reachSource).toBe("views");
    expect(p.followerTier).toBe("micro");
    expect(p.engagementRate).toBeCloseTo(0.06);
    expect(p.engagementRatio).toBeCloseTo(1);
    expect(p.engagementMultiplier).toBeCloseTo(1);
    expect(p.audienceMatch).toBeCloseTo(0.64);
    expect(p.authenticity).toBe(1);
    expect(p.authenticityReasons).toEqual([]);
    expect(p.nicheFit).toBe(1.4);
    expect(p.ctr).toBeCloseTo(0.0168);
    expect(p.cvr).toBe(0.02);
  });

  it("multiplies the factors into conversions, CPA and fair value", () => {
    // 10,000 x 0.64 x 1.0 x 0.0168 x 0.02
    expect(p.expectedClicks).toBeCloseTo(107.52);
    expect(p.expectedConversions).toBeCloseTo(2.1504);
    expect(p.cpa).toBeCloseTo(500 / 2.1504);
    expect(p.profitPerConversion).toBeCloseTo(20);
    expect(p.fairValuePerPost).toBeCloseTo(43.008);
    expect(p.warnings).toEqual([]);
  });

  it("gives a wide range with no history", () => {
    expect(p.range.halfWidth).toBeCloseTo(0.6);
    expect(p.range.low).toBeCloseTo(2.1504 * 0.4);
    expect(p.range.high).toBeCloseTo(2.1504 * 1.6);
  });
});

describe("effective reach", () => {
  it("falls back to followers x platform ratio when views are missing", () => {
    for (const [platform, ratio] of [["instagram", 0.12], ["tiktok", 0.2], ["youtube", 0.15]] as const) {
      const r = effectiveReach({ ...baseInfluencer, platform, avgViewsPerPost: null }, config);
      expect(r.source).toBe("followers_estimate");
      expect(r.reach).toBeCloseTo(50_000 * ratio);
    }
  });

  it("treats zero views as missing", () => {
    expect(effectiveReach({ ...baseInfluencer, avgViewsPerPost: 0 }, config).source).toBe("followers_estimate");
  });

  it("returns 0 when both views and followers are missing", () => {
    expect(effectiveReach({ ...baseInfluencer, avgViewsPerPost: null, followers: null }, config)).toEqual({ reach: 0, source: "missing" });
  });

  it("ignores negative and NaN values", () => {
    expect(effectiveReach({ ...baseInfluencer, avgViewsPerPost: -5, followers: NaN }, config).reach).toBe(0);
  });
});

describe("engagement rate", () => {
  it("skips missing parts", () => {
    expect(engagementRate({ ...baseInfluencer, avgShares: null, avgSaves: null }, 10_000)).toBeCloseTo(0.055);
  });
  it("is null when everything is missing or reach is 0", () => {
    expect(engagementRate({ ...baseInfluencer, avgLikes: null, avgComments: null, avgShares: null, avgSaves: null }, 10_000)).toBeNull();
    expect(engagementRate(baseInfluencer, 0)).toBeNull();
  });
  it("is 0 when all interactions are 0", () => {
    expect(engagementRate({ ...baseInfluencer, avgLikes: 0, avgComments: 0, avgShares: 0, avgSaves: 0 }, 10_000)).toBe(0);
  });
});

describe("follower tiers", () => {
  it("bins by follower count", () => {
    expect(followerTier(5_000, config)).toBe("nano");
    expect(followerTier(10_000, config)).toBe("nano");
    expect(followerTier(10_001, config)).toBe("micro");
    expect(followerTier(250_000, config)).toBe("mid");
    expect(followerTier(900_000, config)).toBe("macro");
    expect(followerTier(5_000_000, config)).toBe("mega");
    expect(followerTier(null, config)).toBe("nano");
  });
});

describe("audience match", () => {
  it("parses age buckets", () => {
    expect(parseAgeBucket("18-24")).toEqual([18, 24]);
    expect(parseAgeBucket("55+")).toEqual([55, 64]);
    expect(parseAgeBucket("adults")).toBeNull();
  });

  it("counts partial bucket overlap", () => {
    // 25-34 is 10 years; 25-29 overlaps 5 of them.
    expect(ageShare({ "25-34": 1 }, 25, 29)).toBeCloseTo(0.5);
  });

  it("normalises splits that do not sum to 1 (e.g. percentages)", () => {
    expect(countryShare({ AE: 50, US: 50 }, ["ae"])).toBeCloseTo(0.5);
  });

  it("counts every country when brand has no target countries", () => {
    expect(countryShare(null, [])).toBe(1);
  });

  it("uses the configured fallback when splits are missing", () => {
    const a = audienceMatch({ ...baseInfluencer, audienceCountrySplit: null, audienceAgeSplit: null }, baseBrand, config);
    expect(a.match).toBe(0.5);
    expect(a.notes).toHaveLength(2);
    const onlyAge = audienceMatch({ ...baseInfluencer, audienceCountrySplit: null }, baseBrand, config);
    expect(onlyAge.match).toBeCloseTo(0.5 * 0.8);
  });

  it("is 0 when no audience is in target countries", () => {
    expect(audienceMatch(baseInfluencer, { ...baseBrand, targetCountries: ["JP"] }, config).match).toBe(0);
  });

  it("treats an all-zero split as missing", () => {
    expect(countryShare({ AE: 0, US: 0 }, ["AE"])).toBeNull();
  });
});

describe("authenticity", () => {
  it("penalises low and very low engagement", () => {
    expect(authenticity(baseInfluencer, 0.4, config).score).toBeCloseTo(0.85);
    expect(authenticity(baseInfluencer, 0.2, config).score).toBeCloseTo(0.7);
    expect(authenticity(baseInfluencer, 0.2, config).reasons[0].code).toBe("very_low_engagement");
  });

  it("penalises a flagged growth spike or steep 30d growth", () => {
    expect(authenticity({ ...baseInfluencer, fakeFollowerSignals: { growthSpike: true, commentQuality: 0.9 } }, 1, config).score).toBeCloseTo(0.8);
    expect(authenticity({ ...baseInfluencer, followerGrowth30dPct: 45 }, 1, config).reasons[0].code).toBe("growth_spike");
  });

  it("penalises low comment quality", () => {
    const r = authenticity({ ...baseInfluencer, fakeFollowerSignals: { commentQuality: 0.2 } }, 1, config);
    expect(r.score).toBeCloseTo(0.75);
    expect(authenticity({ ...baseInfluencer, fakeFollowerSignals: { commentQuality: 0.5 } }, 1, config).score).toBeCloseTo(0.9);
  });

  it("never goes below the floor and explains it", () => {
    const r = authenticity({ ...baseInfluencer, followerGrowth30dPct: 80, fakeFollowerSignals: { commentQuality: 0.1, growthSpike: true } }, 0.1, config);
    // 1 - 0.3 - 0.2 - 0.25 = 0.25 -> floored to 0.3
    expect(r.score).toBe(0.3);
    expect(r.reasons.map((x) => x.code)).toContain("floor");
  });

  it("does not penalise when signals are missing", () => {
    expect(authenticity({ ...baseInfluencer, fakeFollowerSignals: null, followerGrowth30dPct: null }, null, config).score).toBe(1);
  });
});

describe("niche fit", () => {
  it("reads from the matrix, case-insensitively", () => {
    expect(nicheFit(DEFAULT_NICHE_FIT, "Fitness", "Banking", config)).toEqual({ value: 0.6, source: "matrix" });
  });
  it("falls back for unknown combinations and no industry", () => {
    expect(nicheFit(DEFAULT_NICHE_FIT, "gaming", "banking", config)).toEqual({ value: 1, source: "fallback" });
    expect(nicheFit(DEFAULT_NICHE_FIT, "fitness", null, config).source).toBe("no_industry");
  });
  it("clamps out-of-range matrix values", () => {
    expect(nicheFit({ fitness: { banking: 9 } }, "fitness", "banking", config).value).toBe(1.5);
  });
});

describe("CTR engagement multiplier", () => {
  it("is clamped to [0.5, 2.0]", () => {
    const viral = predict({ ...baseInfluencer, avgLikes: 5_000 }, baseBrand, config, ctx);
    expect(viral.engagementMultiplier).toBe(2);
    const dead = predict({ ...baseInfluencer, avgLikes: 10, avgComments: 0, avgShares: 0, avgSaves: 0 }, baseBrand, config, ctx);
    expect(dead.engagementMultiplier).toBe(0.5);
  });
});

describe("missing data and zero values", () => {
  it("never throws and returns 0 conversions with no reach", () => {
    const empty: InfluencerMetrics = {
      platform: "tiktok",
      niche: "",
      followers: null,
      avgViewsPerPost: null,
      avgLikes: null,
      avgComments: null,
      avgShares: null,
      avgSaves: null,
      followerGrowth30dPct: null,
      audienceCountrySplit: null,
      audienceAgeSplit: null,
      feePerPost: null,
      fakeFollowerSignals: null,
    };
    const p = predict(empty, baseBrand, config, ctx);
    expect(p.expectedConversions).toBe(0);
    expect(p.cpa).toBeNull();
    expect(p.fairValuePerPost).toBe(0);
    expect(p.range.low).toBe(0);
    expect(Number.isFinite(p.range.high)).toBe(true);
    expect(p.warnings.length).toBeGreaterThan(0);
  });

  it("CPA is null without a fee and 0 for a free post", () => {
    expect(predict({ ...baseInfluencer, feePerPost: null }, baseBrand, config, ctx).cpa).toBeNull();
    expect(predict({ ...baseInfluencer, feePerPost: 0 }, baseBrand, config, ctx).cpa).toBe(0);
  });

  it("uses the default CVR when the brand has none", () => {
    const p = predict(baseInfluencer, { ...baseBrand, baselineConversionRate: null }, config, ctx);
    expect(p.cvr).toBe(config.defaultCvr);
    expect(p.cvrSource).toBe("default");
    expect(predict(baseInfluencer, { ...baseBrand, baselineConversionRate: 0 }, config, ctx).cvrSource).toBe("default");
  });

  it("estimates reach from followers and widens the range", () => {
    const p = predict({ ...baseInfluencer, avgViewsPerPost: null }, baseBrand, config, ctx);
    expect(p.effectiveReach).toBeCloseTo(6_000);
    expect(p.range.halfWidth).toBeCloseTo(0.75);
  });

  it("treats missing engagement as average (multiplier 1)", () => {
    const p = predict({ ...baseInfluencer, avgLikes: null, avgComments: null, avgShares: null, avgSaves: null }, baseBrand, config, ctx);
    expect(p.engagementRate).toBeNull();
    expect(p.engagementMultiplier).toBe(1);
    expect(p.authenticity).toBe(1);
  });
});

describe("range width", () => {
  const none = { estimatedReach: false, missingAudience: false, missingEngagement: false };
  it("narrows as results accumulate", () => {
    const w0 = rangeHalfWidth(0, none, config).halfWidth;
    const w5 = rangeHalfWidth(5, none, config).halfWidth;
    const w50 = rangeHalfWidth(50, none, config).halfWidth;
    expect(w0).toBeCloseTo(0.6);
    expect(w5).toBeCloseTo(0.375);
    expect(w50).toBeLessThan(w5);
    expect(w50).toBeGreaterThan(config.uncertainty.minHalfWidth);
  });
  it("is capped", () => {
    expect(rangeHalfWidth(0, { estimatedReach: true, missingAudience: true, missingEngagement: true }, config).halfWidth).toBeLessThanOrEqual(0.9);
  });
});

describe("mergeConfig", () => {
  it("overrides nested numbers and ignores junk", () => {
    const c = mergeConfig(DEFAULT_CONFIG, { baseCtr: { tiktok: 0.02, youtube: "x" }, bogus: 1, calibrationK: NaN });
    expect(c.baseCtr.tiktok).toBe(0.02);
    expect(c.baseCtr.youtube).toBe(0.018);
    expect(c.calibrationK).toBe(5);
    expect("bogus" in c).toBe(false);
  });
});
