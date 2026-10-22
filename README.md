# Taseer

Taseer connects brands and influencers through a conversion prediction engine. Next.js 15 (App Router), TypeScript, Tailwind v4, SQLite (better-sqlite3 + Drizzle), Vitest.

## Install, seed, run

```bash
npm install
npm run db:seed      # creates data/taseer.db (migrations run automatically) and loads demo data
npm run dev          # http://localhost:3000
npm test             # engine unit tests
npm run typecheck && npm run lint
```

## The formula

```
expected conversions per post = effective_reach × audience_match × authenticity × CTR × CVR
CTR = platform base CTR × clamp(ER / benchmark ER, 0.5, 2.0) × niche_fit
CPA = fee_per_post / expected conversions
fair value per post = expected conversions × (avg_order_value × margin)
```

All constants are in `lib/engine/config.ts`, with a comment on each one. The engine (`lib/engine/`) is pure functions with no DB access.

## Status

| Stage | State |
|---|---|
| Scaffold, schema, migrations, seed (25 influencers, 4 brands, 2 campaigns, 7 results) | ✅ |
| Prediction engine + calibration + optimizer + insights, 55 unit tests | ✅ |
| Brand dashboard (brands, campaigns, ranked table, filters, "why" popover, best mix) | ✅ |
| Influencer CSV parsing/validation (`lib/csv.ts`) + save/import server actions | ✅ code written, UI not yet |
| Influencer list/detail + funnel, "Know your value" page, data entry UI, sample CSV | ⏳ todo |
| Results entry + predicted vs actual, admin (niche-fit matrix, config) | ⏳ todo |

## Decisions

- **Engagement rate is per view** (interactions / effective reach), so the benchmarks are per view too, by platform × follower tier (nano ≤10k, micro ≤100k, mid ≤500k, macro ≤1M, mega).
- **Audience match** = country share × age share. We only have the two separate splits, so the model assumes country and age are independent. Ages are assumed evenly spread inside each bucket, and "55+" counts as 55-64. A missing split is assumed to be 50%, and the "why" view says so.
- **Authenticity** penalties: low ER (<50% of benchmark: −0.15; <25%: −0.30), growth spike (the flag, or 30-day growth >30%: −0.20), comment quality (<0.4: −0.25; <0.6: −0.10). The score has a floor of 0.3, and every penalty applied is returned with its reason.
- **Zero views are treated as missing** and fall back to followers × reach ratio.
- **Calibration** works per platform+niche, weighted n/(n+5):
  - **CTR:** the observed "implied base CTR" (clicks ÷ (qualified reach × engagement multiplier × niche fit)) is blended with the platform benchmark.
  - **CVR:** a multiplier (observed conversions ÷ clicks × brand baseline CVR) is blended with 1.0, so results carry over between brands.
- **Range** half-width = 0.15 + 0.45 × 5/(5 + past results for this influencer). It gets wider when reach is estimated or when audience or engagement data is missing, and is capped at ±90%.
- **Campaigns** can override the brand's target countries and ages.
- **Valuing influencers without a brand:** "Know your value" uses a neutral reference brand from config: AOV $60, 40% margin, 2% CVR, ages 18-44, worldwide.
- **Connector-ready schema:** influencers carry `source`, `external_id` and `last_synced_at`, so API connectors can upsert later.
- **Settings:** the niche-fit matrix and config overrides live in the `settings` table and are deep-merged over the defaults.

## Next steps

- Real API connectors (Instagram Graph, TikTok, YouTube Data) behind a `MetricsConnector` interface.
- ML model trained on campaign outcomes once there are enough results.
- LLM-based comment authenticity analysis to replace the manual `comment_quality` score.
