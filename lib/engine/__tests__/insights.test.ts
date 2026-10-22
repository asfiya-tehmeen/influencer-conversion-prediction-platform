import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_NICHE_FIT } from "../config";
import { applyWhatIf, metricHealth, percentileRank, referenceBrand } from "../insights";
import { pickBestMix } from "../optimize";
import { engagementRate, predict } from "../predict";
import { baseInfluencer } from "./fixtures";

const config = DEFAULT_CONFIG;
const ctx = { nicheFit: DEFAULT_NICHE_FIT };

describe("pickBestMix", () => {
  const cands = [
    { id: "a", feePerPost: 100, conversionsPerPost: 2 }, // 0.02 / $
    { id: "b", feePerPost: 300, conversionsPerPost: 9 }, // 0.03 / $
    { id: "c", feePerPost: 500, conversionsPerPost: 5 }, // 0.01 / $
    { id: "d", feePerPost: null, conversionsPerPost: 50 }, // no fee: skipped
    { id: "e", feePerPost: 50, conversionsPerPost: 0 }, // no conversions: skipped
  ];

  it("takes the best conversions per dollar that fit", () => {
    const r = pickBestMix(cands, 450, 1);
    expect(r.selected).toEqual(["b", "a"]);
    expect(r.totalCost).toBe(400);
    expect(r.totalConversions).toBe(11);
    expect(r.remainingBudget).toBe(50);
  });

  it("accounts for posts per influencer", () => {
    const r = pickBestMix(cands, 700, 2);
    expect(r.selected).toEqual(["b"]);
    expect(r.totalConversions).toBe(18);
  });

  it("handles zero or invalid budget", () => {
    expect(pickBestMix(cands, 0, 1).selected).toEqual([]);
    expect(pickBestMix(cands, NaN, 1).selected).toEqual([]);
  });

  it("puts free posts first", () => {
    expect(pickBestMix([...cands, { id: "free", feePerPost: 0, conversionsPerPost: 1 }], 100, 1).selected[0]).toBe("free");
  });
});

describe("percentileRank", () => {
  it("ranks within peers", () => {
    expect(percentileRank(5, [1, 2, 3, 4])).toBe(100);
    expect(percentileRank(0, [1, 2, 3, 4])).toBe(0);
    expect(percentileRank(3, [1, 2, 3, 4])).toBe(62.5);
    expect(percentileRank(1, [])).toBeNull();
  });
});

describe("metricHealth", () => {
  it("flags missing engagement as the weakest metric", () => {
    const m = { ...baseInfluencer, avgLikes: null, avgComments: null, avgShares: null, avgSaves: null };
    const h = metricHealth(m, predict(m, referenceBrand(config), config, ctx), config);
    expect(h[0].key).toBe("engagement");
    expect(h[0].score).toBe(0);
  });

  it("flags authenticity for a growth spike", () => {
    const m = { ...baseInfluencer, avgViewsPerPost: 6_000, fakeFollowerSignals: { growthSpike: true, commentQuality: 0.2 } };
    const h = metricHealth(m, predict(m, referenceBrand(config), config, ctx), config);
    expect(h[0].key).toBe("authenticity");
    expect(h[0].suggestion).toMatch(/grow steadily/);
  });
});

describe("applyWhatIf", () => {
  it("raises engagement rate by the requested points", () => {
    const m = applyWhatIf(baseInfluencer, { engagementDeltaPts: 1 }, config);
    expect(engagementRate(m, 10_000)).toBeCloseTo(0.07);
    expect(m.avgLikes).toBeCloseTo(500 * (0.07 / 0.06));
  });

  it("increases value when engagement rises", () => {
    const brand = referenceBrand(config);
    const before = predict(baseInfluencer, brand, config, ctx).fairValuePerPost;
    const after = predict(applyWhatIf(baseInfluencer, { engagementDeltaPts: 1 }, config), brand, config, ctx).fairValuePerPost;
    expect(after).toBeGreaterThan(before);
  });

  it("keeps engagement rate constant when only views change", () => {
    const m = applyWhatIf(baseInfluencer, { viewsDeltaPct: 50 }, config);
    expect(m.avgViewsPerPost).toBe(15_000);
    expect(engagementRate(m, 15_000)).toBeCloseTo(0.06);
  });

  it("works when there is no engagement data", () => {
    const m = applyWhatIf({ ...baseInfluencer, avgLikes: null, avgComments: null, avgShares: null, avgSaves: null }, { engagementDeltaPts: 2 }, config);
    expect(engagementRate(m, 10_000)).toBeCloseTo(0.02);
  });

  it("never produces negative engagement", () => {
    const m = applyWhatIf(baseInfluencer, { engagementDeltaPts: -50 }, config);
    expect(engagementRate(m, 10_000)).toBe(0);
  });
});
