import { z } from "zod";
import { PLATFORMS } from "@/lib/engine/config";
import { parseAgeBucket } from "@/lib/engine/predict";
import type { Split } from "@/lib/engine/types";

export type FieldErrors = Record<string, string>;
export type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Optional number from a form/CSV string. "", null, undefined -> null. Commas and "%" are stripped. */
const optNumber = (label: string, opts: { min?: number; max?: number; int?: boolean } = {}) =>
  z.preprocess(
    (v) => (blank(v) ? null : typeof v === "string" ? Number(v.replace(/[,%$\s]/g, "")) : v),
    z
      .number({ error: `${label} must be a number` })
      .refine((n) => Number.isFinite(n), `${label} must be a number`)
      .refine((n) => opts.min === undefined || n >= opts.min, `${label} must be at least ${opts.min}`)
      .refine((n) => opts.max === undefined || n <= opts.max, `${label} must be at most ${opts.max}`)
      .transform((n) => (opts.int ? Math.round(n) : n))
      .nullable(),
  );

const reqNumber = (label: string, opts: { min?: number; max?: number; int?: boolean } = {}) =>
  optNumber(label, opts).refine((v) => v !== null, `${label} is required`).transform((v) => v as number);

const reqString = (label: string, max = 100) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v ?? ""),
    z.string().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`),
  );

const optBool = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (blank(v)) return false;
  const s = String(v).trim().toLowerCase();
  if (["true", "yes", "y", "1", "on"].includes(s)) return true;
  if (["false", "no", "n", "0", "off"].includes(s)) return false;
  return v;
}, z.boolean({ error: "Must be true or false" }));

/**
 * Parse an audience split. Accepts JSON ({"AE":0.5}) or "AE:0.5; SA:0.3" / "AE=50, SA=30".
 * Values may be fractions or percentages. If shares add to less than 100%, the rest is stored as "OTHER".
 */
export function parseSplit(input: unknown, kind: "country" | "age"): { ok: true; value: Split | null } | { ok: false; error: string } {
  if (blank(input)) return { ok: true, value: null };
  let entries: [string, unknown][];
  if (typeof input === "object") {
    entries = Object.entries(input as Record<string, unknown>);
  } else {
    const text = String(input).trim();
    if (text.startsWith("{")) {
      try {
        entries = Object.entries(JSON.parse(text));
      } catch {
        return { ok: false, error: "Not valid JSON" };
      }
    } else {
      entries = [];
      for (const part of text.split(/[;|,]/).map((p) => p.trim()).filter(Boolean)) {
        const m = part.match(/^(.+?)\s*[:=]\s*([\d.]+)\s*%?$/);
        if (!m) return { ok: false, error: `Could not read "${part}". Use KEY:VALUE pairs, e.g. ${kind === "country" ? "AE:0.6; SA:0.4" : "18-24:0.5; 25-34:0.5"}` };
        entries.push([m[1].trim(), m[2]]);
      }
    }
  }
  if (entries.length === 0) return { ok: true, value: null };

  const out: Split = {};
  for (const [rawKey, rawVal] of entries) {
    const val = Number(rawVal);
    if (!Number.isFinite(val) || val < 0) return { ok: false, error: `Share for "${rawKey}" must be a number of at least 0` };
    let key = rawKey.trim();
    if (kind === "country") {
      key = key.toUpperCase();
      if (!/^[A-Z]{2}$/.test(key) && key !== "OTHER") return { ok: false, error: `"${rawKey}" is not a 2-letter country code (e.g. AE, SA, US)` };
    } else if (!parseAgeBucket(key)) {
      return { ok: false, error: `"${rawKey}" is not an age bucket (use e.g. 18-24 or 55+)` };
    }
    out[key] = (out[key] ?? 0) + val;
  }

  let total = Object.values(out).reduce((a, b) => a + b, 0);
  if (total > 1.5) {
    for (const k of Object.keys(out)) out[k] /= 100;
    total /= 100;
  }
  if (total <= 0) return { ok: false, error: "Shares add up to 0" };
  if (total > 1.02) return { ok: false, error: `Shares add up to ${(total * 100).toFixed(0)}%; they should add to 100% or less` };
  if (kind === "country" && total < 0.99) out.OTHER = (out.OTHER ?? 0) + (1 - total);
  return { ok: true, value: out };
}

const splitField = (kind: "country" | "age") =>
  z.unknown().transform((v, ctx) => {
    const r = parseSplit(v, kind);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.error });
      return z.NEVER;
    }
    return r.value;
  });

export const influencerSchema = z.object({
  name: reqString("Name"),
  handle: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(/^@/, "") : v ?? ""),
    z.string().min(1, "Handle is required").regex(/^[A-Za-z0-9._-]{1,60}$/, "Handle may only contain letters, numbers, dots, dashes and underscores"),
  ),
  platform: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.enum(PLATFORMS, { error: `Platform must be one of: ${PLATFORMS.join(", ")}` }),
  ),
  niche: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v ?? ""),
    z.string().min(2, "Niche is required").max(40).regex(/^[a-z0-9 _-]+$/, "Niche may only contain letters, numbers, spaces, dashes"),
  ),
  country: z.preprocess(
    (v) => (blank(v) ? null : String(v).trim().toUpperCase()),
    z.string().regex(/^[A-Z]{2}$/, "Country must be a 2-letter code like AE").nullable(),
  ),
  followers: optNumber("Followers", { min: 0, int: true }),
  avgViewsPerPost: optNumber("Avg views per post", { min: 0, int: true }),
  avgLikes: optNumber("Avg likes", { min: 0, int: true }),
  avgComments: optNumber("Avg comments", { min: 0, int: true }),
  avgShares: optNumber("Avg shares", { min: 0, int: true }),
  avgSaves: optNumber("Avg saves", { min: 0, int: true }),
  followerGrowth30dPct: optNumber("30-day follower growth", { min: -100, max: 10_000 }),
  audienceCountrySplit: splitField("country"),
  audienceAgeSplit: splitField("age"),
  feePerPost: optNumber("Fee per post", { min: 0 }),
  commentQuality: optNumber("Comment quality", { min: 0, max: 1 }),
  growthSpike: optBool,
});
export type InfluencerInput = z.infer<typeof influencerSchema>;

const countryList = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? v
      : blank(v)
        ? []
        : String(v)
            .split(/[\s,;]+/)
            .filter(Boolean),
  z.array(z.string().transform((s) => s.trim().toUpperCase()).pipe(z.string().regex(/^[A-Z]{2}$/, "Countries must be 2-letter codes, e.g. AE, SA"))),
);

const ageRangeRefine = <T extends { targetAgeMin: number | null; targetAgeMax: number | null }>(v: T, ctx: z.RefinementCtx) => {
  if (v.targetAgeMin !== null && v.targetAgeMax !== null && v.targetAgeMin > v.targetAgeMax) {
    ctx.addIssue({ code: "custom", path: ["targetAgeMax"], message: "Max age must be at least min age" });
  }
};

export const brandSchema = z
  .object({
    name: reqString("Brand name"),
    industry: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v ?? ""), z.string().min(2, "Industry is required").max(40)),
    targetCountries: countryList,
    targetAgeMin: reqNumber("Min age", { min: 13, max: 80, int: true }),
    targetAgeMax: reqNumber("Max age", { min: 13, max: 80, int: true }),
    avgOrderValue: reqNumber("Average order value", { min: 0.01 }),
    // Entered as a percentage in forms (45 = 45%).
    marginPct: reqNumber("Margin", { min: 0, max: 100 }).transform((v) => v / 100),
    baselineConversionRate: optNumber("Baseline conversion rate", { min: 0.01, max: 100 }).transform((v) => (v === null ? 0.02 : v / 100)),
  })
  .superRefine(ageRangeRefine);
export type BrandInput = z.infer<typeof brandSchema>;

export const campaignSchema = z
  .object({
    brandId: reqNumber("Brand", { min: 1, int: true }),
    name: reqString("Campaign name"),
    budget: reqNumber("Budget", { min: 1 }),
    postsPerInfluencer: reqNumber("Posts per influencer", { min: 1, max: 50, int: true }),
    targetNiche: z.preprocess((v) => (blank(v) ? null : String(v).trim().toLowerCase()), z.string().max(40).nullable()),
    targetCountries: countryList.transform((v) => (v.length ? v : null)),
    targetAgeMin: optNumber("Min age", { min: 13, max: 80, int: true }),
    targetAgeMax: optNumber("Max age", { min: 13, max: 80, int: true }),
  })
  .superRefine(ageRangeRefine);
export type CampaignInput = z.infer<typeof campaignSchema>;

export const resultSchema = z
  .object({
    campaignId: reqNumber("Campaign", { min: 1, int: true }),
    influencerId: reqNumber("Influencer", { min: 1, int: true }),
    actualClicks: reqNumber("Clicks", { min: 0, int: true }),
    actualConversions: reqNumber("Conversions", { min: 0, int: true }),
  })
  .refine((v) => v.actualConversions <= v.actualClicks, { path: ["actualConversions"], message: "Conversions cannot exceed clicks" });

/** Run a schema and flatten issues into { field: message } (first message per field). */
export function validate<S extends z.ZodType>(schema: S, input: unknown): ParseResult<z.output<S>> {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (!k.startsWith("$")) out[k] = typeof v === "string" ? v : null;
  return out;
}
