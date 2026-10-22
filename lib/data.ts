/**
 * Server-side glue between the database and the pure engine.
 * Pages call these; nothing here should be imported by client components.
 */
import { eq, sql } from "drizzle-orm";
import { getDb, type DB } from "@/lib/db";
import { brands, campaignResults, campaigns, influencers, settings, type Brand, type Campaign, type Influencer } from "@/lib/db/schema";
import {
  buildCalibration,
  DEFAULT_CONFIG,
  DEFAULT_NICHE_FIT,
  mergeConfig,
  predict,
  type BrandTarget,
  type Calibration,
  type EngineConfig,
  type InfluencerMetrics,
  type NicheFitMatrix,
  type Prediction,
} from "@/lib/engine";

export function toMetrics(i: Influencer): InfluencerMetrics {
  return {
    platform: i.platform,
    niche: i.niche,
    followers: i.followers,
    avgViewsPerPost: i.avgViewsPerPost,
    avgLikes: i.avgLikes,
    avgComments: i.avgComments,
    avgShares: i.avgShares,
    avgSaves: i.avgSaves,
    followerGrowth30dPct: i.followerGrowth30dPct,
    audienceCountrySplit: i.audienceCountrySplit,
    audienceAgeSplit: i.audienceAgeSplit,
    feePerPost: i.feePerPost,
    fakeFollowerSignals: i.fakeFollowerSignals
      ? { commentQuality: i.fakeFollowerSignals.comment_quality ?? null, growthSpike: i.fakeFollowerSignals.growth_spike ?? null }
      : null,
  };
}

/** Campaign-level audience overrides win over the brand's defaults. */
export function toBrandTarget(b: Brand, c?: Campaign | null): BrandTarget {
  return {
    industry: b.industry,
    targetCountries: c?.targetCountries?.length ? c.targetCountries : b.targetCountries,
    targetAgeMin: c?.targetAgeMin ?? b.targetAgeMin,
    targetAgeMax: c?.targetAgeMax ?? b.targetAgeMax,
    avgOrderValue: b.avgOrderValue,
    marginPct: b.marginPct,
    baselineConversionRate: b.baselineConversionRate,
  };
}

export function loadSettings(db: DB = getDb()): { config: EngineConfig; nicheFit: NicheFitMatrix; overrides: unknown } {
  const rows = db.select().from(settings).all();
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const overrides = get("engine_config") ?? {};
  const matrix = get("niche_fit");
  return {
    config: mergeConfig(DEFAULT_CONFIG, overrides),
    nicheFit: matrix && typeof matrix === "object" ? (matrix as NicheFitMatrix) : DEFAULT_NICHE_FIT,
    overrides,
  };
}

export interface ResultRow {
  resultId: number;
  campaign: Campaign;
  brand: Brand;
  influencer: Influencer;
  actualClicks: number;
  actualConversions: number;
}

export function loadResults(db: DB = getDb(), campaignId?: number): ResultRow[] {
  const q = db
    .select()
    .from(campaignResults)
    .innerJoin(campaigns, eq(campaignResults.campaignId, campaigns.id))
    .innerJoin(brands, eq(campaigns.brandId, brands.id))
    .innerJoin(influencers, eq(campaignResults.influencerId, influencers.id));
  const rows = campaignId ? q.where(eq(campaigns.id, campaignId)).all() : q.all();
  return rows.map((r) => ({
    resultId: r.campaign_results.id,
    campaign: r.campaigns,
    brand: r.brands,
    influencer: r.influencers,
    actualClicks: r.campaign_results.actualClicks,
    actualConversions: r.campaign_results.actualConversions,
  }));
}

export interface EngineContext {
  config: EngineConfig;
  nicheFit: NicheFitMatrix;
  calibration: Calibration;
  resultsCount: Map<number, number>;
}

/** Everything the engine needs, including calibration learned from all past results. */
export function loadEngineContext(db: DB = getDb()): EngineContext {
  const { config, nicheFit } = loadSettings(db);
  const results = loadResults(db);
  const calibration = buildCalibration(
    results.map((r) => ({
      influencer: toMetrics(r.influencer),
      brand: toBrandTarget(r.brand, r.campaign),
      posts: r.campaign.postsPerInfluencer,
      actualClicks: r.actualClicks,
      actualConversions: r.actualConversions,
    })),
    config,
    nicheFit,
  );
  const resultsCount = new Map<number, number>();
  for (const r of results) resultsCount.set(r.influencer.id, (resultsCount.get(r.influencer.id) ?? 0) + 1);
  return { config, nicheFit, calibration, resultsCount };
}

export function predictFor(ctx: EngineContext, i: Influencer, target: BrandTarget, calibrated = true): Prediction {
  return predict(toMetrics(i), target, ctx.config, {
    nicheFit: ctx.nicheFit,
    calibration: calibrated ? ctx.calibration : undefined,
    influencerResultsCount: ctx.resultsCount.get(i.id) ?? 0,
  });
}

/** Serializable summary of an influencer for client components. */
export interface InfluencerSummary {
  id: number;
  name: string;
  handle: string;
  platform: Influencer["platform"];
  niche: string;
  country: string | null;
  followers: number | null;
  feePerPost: number | null;
}

export const summarize = (i: Influencer): InfluencerSummary => ({
  id: i.id,
  name: i.name,
  handle: i.handle,
  platform: i.platform,
  niche: i.niche,
  country: i.country,
  followers: i.followers,
  feePerPost: i.feePerPost,
});

export function allInfluencers(db: DB = getDb()) {
  return db.select().from(influencers).orderBy(influencers.name).all();
}

export function getInfluencer(id: number, db: DB = getDb()) {
  return Number.isInteger(id) ? (db.select().from(influencers).where(eq(influencers.id, id)).get() ?? null) : null;
}

export function allBrands(db: DB = getDb()) {
  return db.select().from(brands).orderBy(brands.name).all();
}

export function getBrand(id: number, db: DB = getDb()) {
  return Number.isInteger(id) ? (db.select().from(brands).where(eq(brands.id, id)).get() ?? null) : null;
}

export function getCampaign(id: number, db: DB = getDb()) {
  if (!Number.isInteger(id)) return null;
  const row = db.select().from(campaigns).innerJoin(brands, eq(campaigns.brandId, brands.id)).where(eq(campaigns.id, id)).get();
  return row ? { campaign: row.campaigns, brand: row.brands } : null;
}

export function allCampaigns(db: DB = getDb()) {
  return db
    .select({
      campaign: campaigns,
      brand: brands,
      results: sql<number>`(SELECT COUNT(*) FROM ${campaignResults} WHERE ${campaignResults.campaignId} = ${campaigns.id})`,
    })
    .from(campaigns)
    .innerJoin(brands, eq(campaigns.brandId, brands.id))
    .orderBy(campaigns.id)
    .all();
}

/** Distinct niches across influencers and the niche-fit matrix, for dropdowns. */
export function knownNiches(db: DB = getDb()): string[] {
  const fromData = db.selectDistinct({ niche: influencers.niche }).from(influencers).all().map((r) => r.niche);
  return [...new Set([...Object.keys(loadSettings(db).nicheFit), ...fromData])].sort();
}

export function knownIndustries(db: DB = getDb()): string[] {
  const { nicheFit } = loadSettings(db);
  const set = new Set<string>();
  for (const row of Object.values(nicheFit)) for (const k of Object.keys(row)) set.add(k);
  return [...set].sort();
}
