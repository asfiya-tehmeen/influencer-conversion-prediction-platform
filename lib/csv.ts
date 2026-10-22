import Papa from "papaparse";
import { influencerSchema, validate, type FieldErrors, type InfluencerInput } from "./validation";

/** CSV column -> form/schema field. Column names are matched case-insensitively. */
export const CSV_COLUMNS: Record<string, keyof InfluencerInput> = {
  name: "name",
  handle: "handle",
  platform: "platform",
  niche: "niche",
  country: "country",
  followers: "followers",
  avg_views_per_post: "avgViewsPerPost",
  avg_likes: "avgLikes",
  avg_comments: "avgComments",
  avg_shares: "avgShares",
  avg_saves: "avgSaves",
  follower_growth_30d_pct: "followerGrowth30dPct",
  audience_country_split: "audienceCountrySplit",
  audience_age_split: "audienceAgeSplit",
  fee_per_post: "feePerPost",
  comment_quality: "commentQuality",
  growth_spike: "growthSpike",
};
export const REQUIRED_COLUMNS = ["name", "handle", "platform", "niche"];
const FIELD_TO_COLUMN = Object.fromEntries(Object.entries(CSV_COLUMNS).map(([c, f]) => [f, c]));

export type CsvRowResult =
  | { line: number; ok: true; data: InfluencerInput; exists: boolean }
  | { line: number; ok: false; errors: FieldErrors; handle: string };

export const MAX_ROWS = 2000;

/**
 * Parse and validate an influencer CSV. Errors are keyed by CSV column name so messages match the file.
 * `existing` holds "platform|handle" keys already in the database (those rows become updates).
 */
export function parseInfluencerCsv(text: string, existing: Set<string> = new Set()): { rows: CsvRowResult[] } | { fileError: string } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length) return { fileError: `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. See the sample CSV for the expected header.` };
  const unknown = headers.filter((h) => h && !(h in CSV_COLUMNS));
  if (unknown.length) return { fileError: `Unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Expected: ${Object.keys(CSV_COLUMNS).join(", ")}.` };
  if (parsed.data.length === 0) return { fileError: "The file has a header but no data rows." };
  if (parsed.data.length > MAX_ROWS) return { fileError: `Too many rows (${parsed.data.length}); the limit is ${MAX_ROWS} per import.` };

  const seen = new Map<string, number>();
  return {
    rows: parsed.data.map((raw, idx) => {
      const line = idx + 2; // header is line 1
      const input: Record<string, unknown> = {};
      for (const [col, field] of Object.entries(CSV_COLUMNS)) input[field] = raw[col];
      const r = validate(influencerSchema, input);
      if (!r.ok) {
        const errors: FieldErrors = {};
        for (const [field, msg] of Object.entries(r.errors)) errors[FIELD_TO_COLUMN[field] ?? field] = msg;
        return { line, ok: false, errors, handle: String(raw.handle ?? "") };
      }
      const key = `${r.data.platform}|${r.data.handle.toLowerCase()}`;
      const dup = seen.get(key);
      if (dup) return { line, ok: false, errors: { handle: `Duplicate of line ${dup} (same platform and handle)` }, handle: r.data.handle };
      seen.set(key, line);
      return { line, ok: true, data: r.data, exists: existing.has(key) };
    }),
  };
}
