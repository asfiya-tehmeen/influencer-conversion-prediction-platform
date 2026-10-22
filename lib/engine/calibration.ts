import type { EngineConfig } from "./config";
import { calibrationKey, num, predict } from "./predict";
import type { BrandTarget, Calibration, CalibrationGroup, InfluencerMetrics, PredictionContext } from "./types";

/** One past CampaignResult with the influencer and brand it belongs to. Clicks/conversions are campaign totals. */
export interface ResultObservation {
  influencer: InfluencerMetrics;
  brand: BrandTarget;
  posts: number;
  actualClicks: number | null;
  actualConversions: number | null;
}

/** Shrinkage weight: how much to trust observed data over the benchmark. */
export function shrinkageWeight(count: number, k: number): number {
  if (count <= 0) return 0;
  return count / (count + Math.max(0, k));
}

/**
 * Learn per platform+niche corrections from past results.
 *
 * CTR: we back out the "implied base CTR" = clicks / (qualified reach x engagement multiplier x niche fit),
 * i.e. the base CTR that would have produced the observed clicks, then blend with the platform benchmark.
 *
 * CVR: brands differ, so we learn a multiplier = observed conversions / (clicks x brand baseline CVR),
 * blended with 1.0 (no correction).
 *
 * Both use weight = n / (n + k) where n is the number of usable results in the group.
 */
export function buildCalibration(
  observations: ResultObservation[],
  config: EngineConfig,
  nicheFit: PredictionContext["nicheFit"],
): Calibration {
  const acc = new Map<
    string,
    { platform: InfluencerMetrics["platform"]; niche: string; clicks: number; denom: number; ctrN: number; conv: number; expConv: number; cvrN: number }
  >();

  for (const o of observations) {
    const posts = num(o.posts);
    if (!posts) continue;
    const key = calibrationKey(o.influencer.platform, o.influencer.niche);
    const a = acc.get(key) ?? {
      platform: o.influencer.platform,
      niche: o.influencer.niche.trim().toLowerCase(),
      clicks: 0,
      denom: 0,
      ctrN: 0,
      conv: 0,
      expConv: 0,
      cvrN: 0,
    };
    // Uncalibrated prediction gives us the multipliers in force for this influencer/brand pair.
    const p = predict(o.influencer, o.brand, config, { nicheFit });
    const clicks = num(o.actualClicks);
    const denom = p.qualifiedReach * p.engagementMultiplier * p.nicheFit;
    if (clicks !== null && denom > 0) {
      a.clicks += clicks / posts;
      a.denom += denom;
      a.ctrN += 1;
    }
    const conversions = num(o.actualConversions);
    if (clicks !== null && clicks > 0 && conversions !== null) {
      a.conv += conversions;
      a.expConv += clicks * p.cvr;
      a.cvrN += 1;
    }
    acc.set(key, a);
  }

  const out: Calibration = {};
  for (const [key, a] of acc) {
    const benchmark = config.baseCtr[a.platform];
    const observedBaseCtr = a.ctrN > 0 ? a.clicks / a.denom : null;
    const ctrWeight = observedBaseCtr === null ? 0 : shrinkageWeight(a.ctrN, config.calibrationK);
    const observedCvrMultiplier = a.cvrN > 0 && a.expConv > 0 ? a.conv / a.expConv : null;
    const cvrWeight = observedCvrMultiplier === null ? 0 : shrinkageWeight(a.cvrN, config.calibrationK);
    const group: CalibrationGroup = {
      platform: a.platform,
      niche: a.niche,
      ctrCount: observedBaseCtr === null ? 0 : a.ctrN,
      observedBaseCtr,
      benchmarkBaseCtr: benchmark,
      ctrWeight,
      blendedBaseCtr: ctrWeight * (observedBaseCtr ?? 0) + (1 - ctrWeight) * benchmark,
      cvrCount: observedCvrMultiplier === null ? 0 : a.cvrN,
      observedCvrMultiplier,
      cvrWeight,
      blendedCvrMultiplier: cvrWeight * (observedCvrMultiplier ?? 0) + (1 - cvrWeight) * 1,
    };
    out[key] = group;
  }
  return out;
}
