import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Platform } from "@/lib/engine/config";
import type { Split } from "@/lib/engine/types";

export interface FakeFollowerSignals {
  comment_quality?: number | null;
  growth_spike?: boolean | null;
}

/** Where an influencer's metrics came from. API connectors will add their own values. */
export type MetricsSource = "manual" | "csv" | "seed" | `api:${Platform}`;

const createdAt = () => text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`);

export const influencers = sqliteTable(
  "influencers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    handle: text("handle").notNull(),
    platform: text("platform").$type<Platform>().notNull(),
    niche: text("niche").notNull(),
    country: text("country"),
    followers: integer("followers"),
    avgViewsPerPost: integer("avg_views_per_post"),
    avgLikes: integer("avg_likes"),
    avgComments: integer("avg_comments"),
    avgShares: integer("avg_shares"),
    avgSaves: integer("avg_saves"),
    followerGrowth30dPct: real("follower_growth_30d_pct"),
    audienceCountrySplit: text("audience_country_split", { mode: "json" }).$type<Split>(),
    audienceAgeSplit: text("audience_age_split", { mode: "json" }).$type<Split>(),
    feePerPost: real("fee_per_post"),
    fakeFollowerSignals: text("fake_follower_signals", { mode: "json" }).$type<FakeFollowerSignals>(),
    // Connector plumbing: lets a future Instagram/TikTok/YouTube sync upsert by external id.
    source: text("source").$type<MetricsSource>().notNull().default("manual"),
    externalId: text("external_id"),
    lastSyncedAt: text("last_synced_at"),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [uniqueIndex("influencers_platform_handle").on(t.platform, t.handle)],
);

export const brands = sqliteTable("brands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  targetCountries: text("target_countries", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  targetAgeMin: integer("target_age_min").notNull().default(18),
  targetAgeMax: integer("target_age_max").notNull().default(44),
  avgOrderValue: real("avg_order_value").notNull(),
  marginPct: real("margin_pct").notNull(),
  baselineConversionRate: real("baseline_conversion_rate").notNull().default(0.02),
  createdAt: createdAt(),
});

export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  budget: real("budget").notNull(),
  postsPerInfluencer: integer("posts_per_influencer").notNull().default(1),
  /** null = any niche */
  targetNiche: text("target_niche"),
  /** Optional per-campaign audience override; null = use the brand's targets. */
  targetCountries: text("target_countries", { mode: "json" }).$type<string[]>(),
  targetAgeMin: integer("target_age_min"),
  targetAgeMax: integer("target_age_max"),
  createdAt: createdAt(),
});

export const campaignResults = sqliteTable(
  "campaign_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    influencerId: integer("influencer_id")
      .notNull()
      .references(() => influencers.id, { onDelete: "cascade" }),
    /** Totals across all posts in the campaign. */
    actualClicks: integer("actual_clicks").notNull(),
    actualConversions: integer("actual_conversions").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("campaign_results_campaign_influencer").on(t.campaignId, t.influencerId)],
);

/** Key/value JSON settings: "engine_config" (overrides) and "niche_fit" (matrix). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});

export type Influencer = typeof influencers.$inferSelect;
export type NewInfluencer = typeof influencers.$inferInsert;
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignResult = typeof campaignResults.$inferSelect;
