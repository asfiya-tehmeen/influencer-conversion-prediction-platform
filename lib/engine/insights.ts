import type { EngineConfig } from "./config";
import { effectiveReach, num, pct } from "./predict";
import type { BrandTarget, InfluencerMetrics, Prediction } from "./types";

/** The generic brand used to value an influencer when no real brand is chosen. */
export function referenceBrand(config: EngineConfig): BrandTarget {
  const r = config.referenceBrand;
  return {
    industry: null,
    targetCountries: [],
    targetAgeMin: r.targetAgeMin,
    targetAgeMax: r.targetAgeMax,
    avgOrderValue: r.avgOrderValue,
    marginPct: r.marginPct,
    baselineConversionRate: r.baselineConversionRate,
  };
}

/** Percentile rank (0-100) of `value` among `peers`: share below plus half the ties. */
export function percentileRank(value: number, peers: number[]): number | null {
  const valid = peers.filter((p) => Number.isFinite(p));
  if (valid.length === 0) return null;
  const below = valid.filter((p) => p < value).length;
  const equal = valid.filter((p) => p === value).length;
  return ((below + equal / 2) / valid.length) * 100;
}

export interface MetricHealth {
  key: "engagement" | "reach" | "authenticity" | "audience";
  label: string;
  /** 1.0 = at benchmark; lower is worse. */
  score: number;
  detail: string;
  suggestion: string;
}

/** Score each driver against its benchmark. Sorted weakest first. */
export function metricHealth(m: InfluencerMetrics, p: Prediction, config: EngineConfig): MetricHealth[] {
  const out: MetricHealth[] = [];

  if (p.engagementRatio === null) {
    out.push({
      key: "engagement",
      label: "Engagement rate",
      score: 0,
      detail: "No likes, comments, shares or saves recorded.",
      suggestion: "Add your average likes, comments, shares and saves. Without them brands see an unverified profile and a wider prediction range.",
    });
  } else {
    out.push({
      key: "engagement",
      label: "Engagement rate",
      score: p.engagementRatio,
      detail: `${pct(p.engagementRate ?? 0, 2)} vs ${pct(p.benchmarkEngagementRate, 1)} typical for ${p.followerTier} ${m.platform} accounts.`,
      suggestion:
        "Ask a direct question or add a clear call to action in each post, reply to early comments, and post when your audience is online. Engagement lifts both CTR and authenticity.",
    });
  }

  const views = num(m.avgViewsPerPost);
  const followers = num(m.followers);
  if (views !== null && followers !== null && followers > 0) {
    const ratio = views / followers / config.reachRatio[m.platform];
    out.push({
      key: "reach",
      label: "Reach per post",
      score: ratio,
      detail: `${Math.round((views / followers) * 100)}% of followers see a post vs ${Math.round(config.reachRatio[m.platform] * 100)}% typical.`,
      suggestion: "Lean into formats the platform pushes (short video, carousels), keep a consistent posting schedule and use hooks in the first 2 seconds.",
    });
  } else if (effectiveReach(m, config).source !== "views") {
    out.push({
      key: "reach",
      label: "Reach per post",
      score: 0.5,
      detail: "Average views per post not provided; reach is estimated from followers.",
      suggestion: "Add your average views per post. Measured reach beats an estimate and narrows the range brands see.",
    });
  }

  const authReasons = p.authenticityReasons.filter((r) => r.penalty > 0);
  out.push({
    key: "authenticity",
    label: "Authenticity",
    score: p.authenticity,
    detail: authReasons.length ? authReasons.map((r) => r.label).join("; ") : "No red flags.",
    suggestion: authReasons.some((r) => r.code === "growth_spike")
      ? "Avoid giveaways or follow-for-follow that bring in bursts of low-quality followers; grow steadily. Remove obvious bot followers."
      : authReasons.some((r) => r.code.includes("comment"))
        ? "Filter spam comments and encourage real conversation (questions, polls). Comment quality is a strong trust signal for brands."
        : "Keep engagement organic; authenticity penalties come from low engagement, follower spikes and spammy comments.",
  });

  out.push({
    key: "audience",
    label: "Audience fit",
    score: p.audienceMatch / config.insights.healthyAudienceMatch,
    detail: `${pct(p.audienceMatch, 0)} of your audience is in the target range (healthy is ${pct(config.insights.healthyAudienceMatch, 0)}+).`,
    suggestion:
      p.audienceDetail.ageShare === null || p.audienceDetail.countryShare === null
        ? "Add your audience country and age split from your platform insights. Missing data is assumed at 50%."
        : "Brands pay most for audiences in their target markets. Content in the language and time zone of your core market helps.",
  });

  return out.sort((a, b) => a.score - b.score);
}

export interface WhatIf {
  /** Change engagement rate by this many percentage points (1 = +1 point). */
  engagementDeltaPts?: number;
  /** Change views per post by this percentage (10 = +10%). */
  viewsDeltaPct?: number;
}

/**
 * Return a copy of the metrics adjusted for a scenario.
 * Views change keeps engagement rate constant (interactions scale with views);
 * engagement change scales all interactions proportionally.
 */
export function applyWhatIf(m: InfluencerMetrics, scenario: WhatIf, config: EngineConfig): InfluencerMetrics {
  const out: InfluencerMetrics = { ...m };
  const interactions = ["avgLikes", "avgComments", "avgShares", "avgSaves"] as const;
  const scale = (factor: number) => {
    for (const k of interactions) {
      const v = num(out[k]);
      if (v !== null) out[k] = v * factor;
    }
  };

  const reach = effectiveReach(m, config).reach;
  const viewsFactor = 1 + (scenario.viewsDeltaPct ?? 0) / 100;
  let newReach = reach;
  if (scenario.viewsDeltaPct && reach > 0) {
    newReach = Math.max(0, reach * viewsFactor);
    out.avgViewsPerPost = newReach;
    scale(newReach / reach);
  }

  if (scenario.engagementDeltaPts && newReach > 0) {
    const values = interactions.map((k) => num(out[k])).filter((v): v is number => v !== null);
    const total = values.reduce((a, b) => a + b, 0);
    const currentER = total / newReach;
    const targetER = Math.max(0, currentER + scenario.engagementDeltaPts / 100);
    if (total > 0) scale(targetER / currentER);
    else out.avgLikes = targetER * newReach;
  }
  return out;
}
