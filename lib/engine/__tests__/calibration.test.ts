import { describe, expect, it } from "vitest";
import { buildCalibration, shrinkageWeight, type ResultObservation } from "../calibration";
import { DEFAULT_CONFIG, DEFAULT_NICHE_FIT } from "../config";
import { predict } from "../predict";
import { baseBrand, baseInfluencer } from "./fixtures";

const config = DEFAULT_CONFIG;
const ctx = { nicheFit: DEFAULT_NICHE_FIT };
const uncal = predict(baseInfluencer, baseBrand, config, ctx);

/** Observation where the influencer produced `ctrFactor` x and `cvrFactor` x the predicted clicks / CVR. */
function obs(ctrFactor: number, cvrFactor: number, posts = 2): ResultObservation {
  const clicks = uncal.expectedClicks * ctrFactor * posts;
  return { influencer: baseInfluencer, brand: baseBrand, posts, actualClicks: clicks, actualConversions: clicks * uncal.cvr * cvrFactor };
}

describe("shrinkage weight", () => {
  it("is n / (n + k)", () => {
    expect(shrinkageWeight(0, 5)).toBe(0);
    expect(shrinkageWeight(5, 5)).toBe(0.5);
    expect(shrinkageWeight(15, 5)).toBe(0.75);
  });
});

describe("buildCalibration", () => {
  it("returns nothing with no results", () => {
    expect(buildCalibration([], config, DEFAULT_NICHE_FIT)).toEqual({});
  });

  it("recovers the benchmark when results match the prediction", () => {
    const cal = buildCalibration([obs(1, 1), obs(1, 1)], config, DEFAULT_NICHE_FIT);
    const g = cal["instagram|fitness"];
    expect(g.ctrCount).toBe(2);
    expect(g.observedBaseCtr).toBeCloseTo(0.012);
    expect(g.blendedBaseCtr).toBeCloseTo(0.012);
    expect(g.observedCvrMultiplier).toBeCloseTo(1);
  });

  it("blends observed and benchmark with weight n/(n+5)", () => {
    // 5 results, each with double the predicted clicks and half the predicted CVR.
    const cal = buildCalibration(Array.from({ length: 5 }, () => obs(2, 0.5)), config, DEFAULT_NICHE_FIT);
    const g = cal["instagram|fitness"];
    expect(g.ctrWeight).toBeCloseTo(0.5);
    expect(g.observedBaseCtr).toBeCloseTo(0.024);
    expect(g.blendedBaseCtr).toBeCloseTo(0.5 * 0.024 + 0.5 * 0.012);
    expect(g.observedCvrMultiplier).toBeCloseTo(0.5);
    expect(g.blendedCvrMultiplier).toBeCloseTo(0.75);
  });

  it("feeds into predict so predictions move toward observations", () => {
    const cal = buildCalibration([obs(2, 1)], config, DEFAULT_NICHE_FIT);
    const p = predict(baseInfluencer, baseBrand, config, { ...ctx, calibration: cal, influencerResultsCount: 1 });
    // weight 1/6: base CTR = 1/6 x 0.024 + 5/6 x 0.012 = 0.014
    expect(p.baseCtr).toBeCloseTo(0.014);
    expect(p.baseCtrSource).toBe("calibrated");
    expect(p.expectedConversions).toBeGreaterThan(uncal.expectedConversions);
    expect(p.range.halfWidth).toBeLessThan(uncal.range.halfWidth);
  });

  it("only affects the matching platform+niche group", () => {
    const cal = buildCalibration([obs(3, 1)], config, DEFAULT_NICHE_FIT);
    const other = predict({ ...baseInfluencer, platform: "tiktok" }, baseBrand, config, { ...ctx, calibration: cal });
    expect(other.baseCtrSource).toBe("benchmark");
  });

  it("skips results with zero clicks for CVR, and zero-reach influencers for CTR", () => {
    const zeroClicks = { ...obs(1, 1), actualClicks: 0, actualConversions: 0 };
    const g = buildCalibration([zeroClicks], config, DEFAULT_NICHE_FIT)["instagram|fitness"];
    expect(g.ctrCount).toBe(1);
    expect(g.observedBaseCtr).toBe(0);
    expect(g.cvrCount).toBe(0);
    expect(g.blendedCvrMultiplier).toBe(1);

    const noReach = { ...obs(1, 1), influencer: { ...baseInfluencer, followers: null, avgViewsPerPost: null } };
    const g2 = buildCalibration([noReach], config, DEFAULT_NICHE_FIT)["instagram|fitness"];
    expect(g2.ctrCount).toBe(0);
    expect(g2.blendedBaseCtr).toBe(0.012);
  });

  it("ignores results with missing clicks or zero posts", () => {
    const cal = buildCalibration([{ ...obs(1, 1), actualClicks: null }, { ...obs(1, 1), posts: 0 }], config, DEFAULT_NICHE_FIT);
    const g = cal["instagram|fitness"];
    expect(g?.ctrCount ?? 0).toBe(0);
  });
});
