import { sql } from "drizzle-orm";
import { DEFAULT_NICHE_FIT, type Platform } from "@/lib/engine/config";
import type { Split } from "@/lib/engine/types";
import type { DB } from "./index";
import { brands, campaignResults, campaigns, influencers, settings, type NewInfluencer } from "./schema";

// Common audience shapes, reused to keep the seed readable.
const GULF: Split = { AE: 0.45, SA: 0.3, KW: 0.1, EG: 0.05, US: 0.1 };
const SAUDI: Split = { SA: 0.65, AE: 0.15, KW: 0.08, EG: 0.07, US: 0.05 };
const EGYPT: Split = { EG: 0.7, SA: 0.12, AE: 0.08, US: 0.1 };
const GLOBAL: Split = { US: 0.35, GB: 0.15, IN: 0.2, AE: 0.1, SA: 0.05, EG: 0.05, DE: 0.1 };
const YOUNG: Split = { "13-17": 0.15, "18-24": 0.45, "25-34": 0.3, "35-44": 0.08, "45-54": 0.02 };
const ADULT: Split = { "18-24": 0.25, "25-34": 0.45, "35-44": 0.2, "45-54": 0.07, "55+": 0.03 };
const MATURE: Split = { "18-24": 0.1, "25-34": 0.3, "35-44": 0.3, "45-54": 0.2, "55+": 0.1 };

type Row = [
  name: string,
  handle: string,
  platform: Platform,
  niche: string,
  country: string,
  followers: number,
  views: number | null,
  likes: number | null,
  comments: number | null,
  shares: number | null,
  saves: number | null,
  growth30d: number | null,
  countries: Split | null,
  ages: Split | null,
  fee: number,
  commentQuality: number | null,
  growthSpike: boolean,
];

// prettier-ignore
const INFLUENCERS: Row[] = [
  // fitness
  ["Omar Fit", "omarfit", "instagram", "fitness", "AE", 85_000, 14_000, 720, 85, 40, 110, 3.1, GULF, ADULT, 900, 0.82, false],
  ["Layla Moves", "laylamoves", "tiktok", "fitness", "SA", 240_000, 65_000, 4_800, 260, 380, 300, 5.4, SAUDI, YOUNG, 1_800, 0.78, false],
  ["Coach Karim", "coachkarim", "youtube", "fitness", "EG", 130_000, 22_000, 950, 140, 30, 0, 1.8, EGYPT, ADULT, 2_200, 0.88, false],
  ["Iron Hessa", "ironhessa", "instagram", "fitness", "KW", 32_000, 5_500, 420, 60, 15, 70, 2.2, { KW: 0.55, AE: 0.2, SA: 0.2, US: 0.05 }, ADULT, 350, 0.9, false],
  ["Gains Daily", "gainsdaily", "instagram", "fitness", "AE", 1_200_000, 40_000, 560, 30, 10, 40, 35.0, GLOBAL, YOUNG, 6_500, 0.3, true],
  // beauty
  ["Glow by Nora", "glowbynora", "instagram", "beauty", "AE", 420_000, 18_000, 300, 40, 5, 20, 48.0, GULF, YOUNG, 3_800, 0.25, true],
  ["Mira Makeup", "miramakeup", "tiktok", "beauty", "SA", 610_000, 150_000, 11_000, 420, 900, 1_500, 4.0, SAUDI, YOUNG, 4_200, 0.75, false],
  ["Dalia Skin Lab", "daliaskinlab", "youtube", "beauty", "EG", 210_000, 38_000, 1_500, 210, 60, 0, 2.5, EGYPT, ADULT, 3_100, 0.85, false],
  ["Rania Glam", "raniaglam", "instagram", "beauty", "SA", 58_000, 9_000, 650, 95, 25, 140, 2.9, SAUDI, ADULT, 650, 0.8, false],
  ["Sara Shades", "sarashades", "tiktok", "beauty", "AE", 18_000, 6_500, 610, 40, 30, 55, 6.5, GULF, YOUNG, 180, 0.7, false],
  // tech
  ["Tech with Tariq", "techwithtariq", "youtube", "tech", "AE", 540_000, 95_000, 4_200, 600, 150, 0, 1.5, { ...GULF, US: 0.2, AE: 0.35 }, ADULT, 7_500, 0.9, false],
  ["Gadget Guru", "gadgetguru", "tiktok", "tech", "SA", 850_000, 60_000, 900, 60, 20, 0, 22.0, SAUDI, YOUNG, 5_000, 0.35, false],
  ["Byte Sized Hana", "bytesizedhana", "instagram", "tech", "AE", 74_000, 12_000, 520, 70, 45, 160, 3.3, GULF, ADULT, 800, 0.84, false],
  ["Unboxed Yusuf", "unboxedyusuf", "youtube", "tech", "EG", 95_000, 16_000, 820, 130, 25, 0, 2.0, EGYPT, ADULT, 1_400, 0.86, false],
  ["Dev Diaries", "devdiaries", "tiktok", "tech", "US", 140_000, 42_000, 2_900, 180, 300, 420, 4.6, GLOBAL, ADULT, 1_200, 0.8, false],
  // food
  ["Chef Amal", "chefamal", "instagram", "food", "SA", 310_000, 42_000, 1_900, 160, 120, 600, 2.4, SAUDI, MATURE, 2_600, 0.83, false],
  ["Street Eats Dubai", "streeteatsdxb", "tiktok", "food", "AE", 470_000, 120_000, 7_400, 310, 650, 500, 6.0, GULF, YOUNG, 3_000, 0.72, false],
  ["Kitchen Khalid", "kitchenkhalid", "youtube", "food", "KW", 160_000, null, null, null, null, null, 1.2, null, null, 1_900, null, false],
  ["Sweet Tooth Reem", "sweettoothreem", "instagram", "food", "AE", 26_000, 4_200, 380, 55, 20, 90, 3.6, GULF, ADULT, 280, 0.88, false],
  ["Koshary Kings", "kosharykings", "tiktok", "food", "EG", 95_000, 30_000, 2_100, 140, 180, 160, 4.1, EGYPT, YOUNG, 650, 0.77, false],
  // travel
  ["Wander Faisal", "wanderfaisal", "youtube", "travel", "SA", 380_000, 60_000, 2_600, 300, 90, 0, 1.9, { ...SAUDI, GB: 0.05 }, MATURE, 5_200, 0.89, false],
  ["Nomad Noor", "nomadnoor", "instagram", "travel", "AE", 145_000, 21_000, 1_050, 120, 80, 420, 2.7, GULF, ADULT, 1_500, 0.86, false],
  ["Jet Set Jana", "jetsetjana", "tiktok", "travel", "AE", 290_000, 80_000, 4_600, 210, 420, 380, 5.1, { ...GULF, GB: 0.05, US: 0.05 }, YOUNG, 2_100, 0.74, false],
  ["Desert Drives", "desertdrives", "instagram", "travel", "KW", 680_000, 25_000, 420, 25, 10, 30, 3.0, GULF, MATURE, 5_500, 0.45, false],
  ["Hidden Gems Egypt", "hiddengemsegypt", "youtube", "travel", "EG", 48_000, 9_500, 480, 70, 15, 0, 2.6, { EG: 0.5, GB: 0.15, DE: 0.15, US: 0.2 }, MATURE, 700, 0.9, false],
];

const BRANDS = [
  { name: "PeakFuel Nutrition", industry: "supplements", targetCountries: ["AE", "SA", "KW"], targetAgeMin: 18, targetAgeMax: 34, avgOrderValue: 55, marginPct: 0.45, baselineConversionRate: 0.025 },
  { name: "Lumiere Skin", industry: "cosmetics", targetCountries: ["AE", "SA", "EG"], targetAgeMin: 18, targetAgeMax: 34, avgOrderValue: 40, marginPct: 0.6, baselineConversionRate: 0.03 },
  { name: "Nimbus Bank", industry: "banking", targetCountries: ["AE"], targetAgeMin: 25, targetAgeMax: 44, avgOrderValue: 120, marginPct: 0.5, baselineConversionRate: 0.01 },
  { name: "ByteGear", industry: "consumer_electronics", targetCountries: ["AE", "SA", "US"], targetAgeMin: 18, targetAgeMax: 44, avgOrderValue: 180, marginPct: 0.25, baselineConversionRate: 0.015 },
];

// [campaign index, influencer handle, clicks, conversions] (totals across all posts)
const RESULTS: [number, string, number, number][] = [
  [0, "omarfit", 410, 12],
  [0, "laylamoves", 2_150, 41],
  [0, "ironhessa", 190, 6],
  [0, "gainsdaily", 60, 0],
  [1, "techwithtariq", 1_480, 19],
  [1, "bytesizedhana", 175, 3],
  [1, "devdiaries", 590, 5],
];

export function toInfluencerRow(r: Row): NewInfluencer {
  const [name, handle, platform, niche, country, followers, views, likes, comments, shares, saves, growth, countries, ages, fee, cq, spike] = r;
  return {
    name,
    handle,
    platform,
    niche,
    country,
    followers,
    avgViewsPerPost: views,
    avgLikes: likes,
    avgComments: comments,
    avgShares: shares,
    avgSaves: saves,
    followerGrowth30dPct: growth,
    audienceCountrySplit: countries,
    audienceAgeSplit: ages,
    feePerPost: fee,
    fakeFollowerSignals: cq === null && !spike ? null : { comment_quality: cq, growth_spike: spike },
    source: "seed",
  };
}

/** Wipe all data and load the demo dataset. */
export function seed(db: DB) {
  db.transaction((tx) => {
    tx.delete(campaignResults).run();
    tx.delete(campaigns).run();
    tx.delete(brands).run();
    tx.delete(influencers).run();
    tx.delete(settings).run();
    tx.run(sql`DELETE FROM sqlite_sequence`);

    const infl = tx.insert(influencers).values(INFLUENCERS.map(toInfluencerRow)).returning({ id: influencers.id, handle: influencers.handle }).all();
    const byHandle = new Map(infl.map((i) => [i.handle, i.id]));

    const br = tx.insert(brands).values(BRANDS).returning({ id: brands.id }).all();
    const camps = tx
      .insert(campaigns)
      .values([
        { brandId: br[0].id, name: "Ramadan Protein Push", budget: 15_000, postsPerInfluencer: 2, targetNiche: "fitness" },
        { brandId: br[3].id, name: "Earbuds Launch", budget: 25_000, postsPerInfluencer: 1, targetNiche: "tech" },
      ])
      .returning({ id: campaigns.id })
      .all();

    tx.insert(campaignResults)
      .values(
        RESULTS.map(([c, handle, clicks, conv]) => ({
          campaignId: camps[c].id,
          influencerId: byHandle.get(handle)!,
          actualClicks: clicks,
          actualConversions: conv,
        })),
      )
      .run();

    tx.insert(settings)
      .values([
        { key: "niche_fit", value: DEFAULT_NICHE_FIT },
        { key: "engine_config", value: {} },
      ])
      .run();
  });
  return { influencers: INFLUENCERS.length, brands: BRANDS.length, campaigns: 2, results: RESULTS.length };
}
