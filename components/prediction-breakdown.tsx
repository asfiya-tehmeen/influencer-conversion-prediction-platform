import type { Platform, Prediction } from "@/lib/engine";
import { fmtCompact, fmtCount, fmtMoney, fmtMult, fmtPct, PLATFORM_LABEL } from "@/lib/format";

/** Plain-language explanation of every factor. Used in the "why" tooltip (compact) and on the detail page. */
export function PredictionBreakdown({ p, platform, feePerPost, compact = false }: { p: Prediction; platform: Platform; feePerPost: number | null; compact?: boolean }) {
  const rows: { label: string; value: string; detail: string; tone?: "warn" }[] = [
    {
      label: "Effective reach",
      value: fmtCompact(p.effectiveReach),
      detail:
        p.reachSource === "views"
          ? "Average views per post."
          : p.reachSource === "followers_estimate"
            ? `No views data: followers × typical ${PLATFORM_LABEL[platform]} reach ratio.`
            : "No views or followers recorded.",
      tone: p.reachSource === "views" ? undefined : "warn",
    },
    {
      label: "Audience match",
      value: fmtPct(p.audienceMatch, 0),
      detail: [
        p.audienceDetail.countryShare !== null ? `${fmtPct(p.audienceDetail.countryShare, 0)} in target countries` : null,
        p.audienceDetail.ageShare !== null ? `${fmtPct(p.audienceDetail.ageShare, 0)} in target ages` : null,
        ...p.audienceDetail.notes,
      ]
        .filter(Boolean)
        .join(" × "),
      tone: p.audienceDetail.notes.length ? "warn" : undefined,
    },
    {
      label: "Authenticity",
      value: p.authenticity.toFixed(2),
      detail: p.authenticityReasons.length
        ? p.authenticityReasons.map((r) => (r.penalty ? `−${r.penalty.toFixed(2)} ${r.label}` : r.label)).join(". ")
        : "No red flags (engagement, growth and comment quality look normal).",
      tone: p.authenticity < 1 ? "warn" : undefined,
    },
    {
      label: "Click-through rate",
      value: fmtPct(p.ctr, 2),
      detail: `${fmtPct(p.baseCtr, 2)} ${p.baseCtrSource === "calibrated" ? "calibrated" : PLATFORM_LABEL[platform]} base × ${fmtMult(p.engagementMultiplier)} engagement (${
        p.engagementRate === null ? "unknown, treated as average" : `${fmtPct(p.engagementRate, 1)} vs ${fmtPct(p.benchmarkEngagementRate, 1)} ${p.followerTier} benchmark`
      }) × ${fmtMult(p.nicheFit)} niche fit${p.nicheFitSource === "matrix" ? "" : " (no matrix value)"}.`,
    },
    {
      label: "Conversion rate",
      value: fmtPct(p.cvr, 2),
      detail:
        p.cvrSource === "calibrated"
          ? "Brand landing-page rate adjusted by past campaign results."
          : p.cvrSource === "brand_baseline"
            ? "Brand landing-page conversion rate."
            : "Default rate (brand has none set).",
    },
  ];

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <dl className={compact ? "space-y-1.5" : "divide-y divide-slate-100"}>
        {rows.map((r) => (
          <div key={r.label} className={compact ? "" : "grid gap-1 py-2.5 sm:grid-cols-[180px_90px_1fr] sm:gap-4"}>
            <dt className={`font-medium text-slate-800 ${compact ? "flex justify-between gap-2" : ""}`}>
              {r.label}
              {compact && <span className="num font-semibold text-slate-900">{r.value}</span>}
            </dt>
            {!compact && <dd className="num font-semibold text-slate-900">{r.value}</dd>}
            <dd className={`${r.tone === "warn" ? "text-amber-700" : "text-slate-500"} ${compact ? "text-[11px] leading-snug" : "text-sm"}`}>{r.detail}</dd>
          </div>
        ))}
      </dl>
      <div className={`rounded-lg bg-slate-50 p-2.5 ${compact ? "text-[11px]" : "text-sm"} text-slate-700`}>
        <div className="num">
          {fmtCompact(p.effectiveReach)} × {fmtPct(p.audienceMatch, 0)} × {p.authenticity.toFixed(2)} × {fmtPct(p.ctr, 2)} × {fmtPct(p.cvr, 2)} ={" "}
          <strong>{fmtCount(p.expectedConversions)} conversions/post</strong>
        </div>
        <div className="mt-1 text-slate-500">
          Range {fmtCount(p.range.low)}–{fmtCount(p.range.high)} (±{fmtPct(p.range.halfWidth, 0)}): {p.range.notes.join("; ")}.
        </div>
        <div className="mt-1 text-slate-500">
          CPA = {fmtMoney(feePerPost)} fee ÷ {fmtCount(p.expectedConversions)} = <strong className="text-slate-700">{fmtMoney(p.cpa, 2)}</strong>
        </div>
      </div>
    </div>
  );
}
