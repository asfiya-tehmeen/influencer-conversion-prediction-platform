"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { InfluencerSummary } from "@/lib/data";
import { pickBestMix, type MixResult } from "@/lib/engine/optimize";
import type { Prediction } from "@/lib/engine/types";
import { fmtCompact, fmtCount, fmtMoney, fmtPct, PLATFORM_LABEL, titleCase } from "@/lib/format";
import { PredictionBreakdown } from "./prediction-breakdown";
import { Badge, buttonCls, EmptyState, inputCls, PlatformBadge } from "./ui";

export interface RankedRow {
  influencer: InfluencerSummary;
  prediction: Prediction;
}

type SortKey = "cpa" | "conversions" | "er" | "authenticity" | "match" | "fee";

const SORTERS: Record<SortKey, (r: RankedRow) => number | null> = {
  cpa: (r) => r.prediction.cpa,
  conversions: (r) => r.prediction.expectedConversions,
  er: (r) => r.prediction.engagementRate,
  authenticity: (r) => r.prediction.authenticity,
  match: (r) => r.prediction.audienceMatch,
  fee: (r) => r.influencer.feePerPost,
};
const ASCENDING: Record<SortKey, boolean> = { cpa: true, fee: true, conversions: false, er: false, authenticity: false, match: false };

function authTone(score: number) {
  return score >= 0.9 ? "green" : score >= 0.7 ? "amber" : "red";
}

export function RankingTable({ rows, budget, posts, defaultNiche, brandId }: { rows: RankedRow[]; budget: number; posts: number; defaultNiche: string | null; brandId: number }) {
  const [platform, setPlatform] = useState("");
  const [niche, setNiche] = useState(defaultNiche ?? "");
  const [country, setCountry] = useState("");
  const [maxFee, setMaxFee] = useState("");
  const [sort, setSort] = useState<SortKey>("cpa");
  const [mix, setMix] = useState<MixResult<number> | null>(null);

  const niches = useMemo(() => [...new Set(rows.map((r) => r.influencer.niche))].sort(), [rows]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.influencer.country).filter((c): c is string => !!c))].sort(), [rows]);

  const filtered = useMemo(() => {
    const fee = maxFee.trim() === "" ? null : Number(maxFee);
    const list = rows.filter(
      (r) =>
        (!platform || r.influencer.platform === platform) &&
        (!niche || r.influencer.niche === niche) &&
        (!country || r.influencer.country === country) &&
        (fee === null || !Number.isFinite(fee) || (r.influencer.feePerPost !== null && r.influencer.feePerPost <= fee)),
    );
    const get = SORTERS[sort];
    const asc = ASCENDING[sort];
    // Missing values always sort last.
    return list.sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return asc ? va - vb : vb - va;
    });
  }, [rows, platform, niche, country, maxFee, sort]);

  const selected = new Set(mix?.selected ?? []);
  const runMix = () =>
    setMix(
      pickBestMix(
        filtered.map((r) => ({ id: r.influencer.id, feePerPost: r.influencer.feePerPost, conversionsPerPost: r.prediction.expectedConversions })),
        budget,
        posts,
      ),
    );
  const mixRange = mix
    ? filtered
        .filter((r) => selected.has(r.influencer.id))
        .reduce((acc, r) => ({ low: acc.low + r.prediction.range.low * posts, high: acc.high + r.prediction.range.high * posts }), { low: 0, high: 0 })
    : null;

  const resetFilters = () => {
    setPlatform("");
    setNiche("");
    setCountry("");
    setMaxFee("");
    setMix(null);
  };

  const Th = ({ k, children, className = "" }: { k?: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500 ${className}`}>
      {k ? (
        <button type="button" onClick={() => setSort(k)} className={`inline-flex items-center gap-1 uppercase hover:text-slate-900 ${sort === k ? "text-indigo-700" : ""}`}>
          {children}
          {sort === k && <span aria-hidden>{ASCENDING[k] ? "↑" : "↓"}</span>}
        </button>
      ) : (
        children
      )}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <FilterSelect label="Platform" value={platform} onChange={setPlatform} options={Object.entries(PLATFORM_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
        <FilterSelect label="Niche" value={niche} onChange={setNiche} options={niches.map((n) => ({ value: n, label: titleCase(n) }))} />
        <FilterSelect label="Country" value={country} onChange={setCountry} options={countries.map((c) => ({ value: c, label: c }))} />
        <label className="text-xs font-medium text-slate-600">
          Max fee / post
          <input type="number" min={0} value={maxFee} onChange={(e) => setMaxFee(e.target.value)} placeholder="Any" className={`${inputCls} mt-1 w-28`} />
        </label>
        <button type="button" onClick={resetFilters} className={buttonCls("ghost", "sm")}>
          Reset
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">
            {filtered.length} of {rows.length} influencers
          </span>
          <button type="button" onClick={runMix} className={buttonCls("primary")} disabled={filtered.length === 0}>
            Pick best mix for {fmtMoney(budget)}
          </button>
        </div>
      </div>

      {mix && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-medium text-indigo-900">
                Best mix: {mix.selected.length} influencer{mix.selected.length === 1 ? "" : "s"}, {fmtCount(mix.totalConversions)} predicted conversions
                {mixRange && (
                  <span className="font-normal text-indigo-700">
                    {" "}
                    (range {fmtCount(mixRange.low)}–{fmtCount(mixRange.high)})
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-indigo-800">
                Spend {fmtMoney(mix.totalCost)} of {fmtMoney(budget)} ({fmtMoney(mix.remainingBudget)} left) · blended CPA{" "}
                <strong>{fmtMoney(mix.totalConversions > 0 ? mix.totalCost / mix.totalConversions : null, 2)}</strong> · {posts} post{posts === 1 ? "" : "s"} each
              </p>
              <p className="mt-1 text-xs text-indigo-700/80">
                Method: sort the filtered influencers by predicted conversions per dollar and add each one whose fee × posts still fits the remaining budget. Influencers without a fee are skipped.
              </p>
            </div>
            <button type="button" onClick={() => setMix(null)} className={buttonCls("secondary", "sm")}>
              Clear
            </button>
          </div>
          {mix.selected.length === 0 && <p className="mt-2 text-sm text-amber-800">No influencer fits this budget with the current filters.</p>}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="No influencers match these filters"
          body="Try widening the filters, or add influencers in Data entry."
          action={
            <button type="button" onClick={resetFilters} className={buttonCls("secondary")}>
              Reset filters
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>#</Th>
                <Th>Influencer</Th>
                <Th k="conversions" className="text-right">
                  Conv. / post
                </Th>
                <Th k="cpa">CPA</Th>
                <Th k="fee">Fee</Th>
                <Th k="er">Eng. rate</Th>
                <Th k="authenticity">Authenticity</Th>
                <Th k="match">Aud. match</Th>
                <Th>Why</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r, idx) => {
                const p = r.prediction;
                const inMix = selected.has(r.influencer.id);
                return (
                  <tr key={r.influencer.id} className={inMix ? "bg-indigo-50/70" : "hover:bg-slate-50"}>
                    <td className="num px-3 py-2.5 text-slate-400">
                      {inMix ? (
                        <span title="In best mix" className="text-indigo-600">
                          ✓
                        </span>
                      ) : (
                        idx + 1
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/influencers/${r.influencer.id}?brand=${brandId}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                        {r.influencer.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <PlatformBadge platform={r.influencer.platform} />
                        <span>@{r.influencer.handle}</span>
                        <span>· {titleCase(r.influencer.niche)}</span>
                        {r.influencer.country && <span>· {r.influencer.country}</span>}
                        <span>· {fmtCompact(r.influencer.followers)}</span>
                      </div>
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-right">
                      <div className="font-semibold text-slate-900">{fmtCount(p.expectedConversions)}</div>
                      <div className="text-xs text-slate-500">
                        {fmtCount(p.range.low)}–{fmtCount(p.range.high)}
                      </div>
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5 font-semibold text-slate-900">{fmtMoney(p.cpa, 2)}</td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-slate-700">{fmtMoney(r.influencer.feePerPost)}</td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      <div className="text-slate-800">{fmtPct(p.engagementRate, 1)}</div>
                      <div className="text-xs text-slate-500">bench {fmtPct(p.benchmarkEngagementRate, 1)}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={authTone(p.authenticity)}>{p.authenticity.toFixed(2)}</Badge>
                    </td>
                    <td className="num px-3 py-2.5 text-slate-800">{fmtPct(p.audienceMatch, 0)}</td>
                    <td className="px-3 py-2.5">
                      <WhyPopover row={r} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Conversions and CPA are per post. Ranges widen for influencers with no past results or missing data. Hover or tap <em>Why</em> for the full calculation.
      </p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} mt-1 w-36`}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Tooltip rendered in a portal with fixed positioning so the table's horizontal scroll doesn't clip it. */
function WhyPopover({ row }: { row: RankedRow }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [pinned, setPinned] = useState(false);
  const open = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const width = Math.min(384, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const below = rect.bottom + 8;
    // Flip above when there's not enough room below.
    const top = below + 420 > window.innerHeight && rect.top > 440 ? rect.top - 8 - 420 : below;
    setPos({ top: Math.max(8, top), left });
  };
  const close = () => {
    if (!pinned) setPos(null);
  };
  return (
    <>
      <button
        type="button"
        className={buttonCls("secondary", "sm")}
        onMouseEnter={(e) => open(e.currentTarget)}
        onMouseLeave={close}
        onFocus={(e) => open(e.currentTarget)}
        onBlur={() => {
          setPinned(false);
          setPos(null);
        }}
        onClick={(e) => {
          setPinned((v) => !v);
          open(e.currentTarget);
        }}
        aria-expanded={!!pos}
      >
        Why?
      </button>
      {pos &&
        createPortal(
          <div role="tooltip" style={{ top: pos.top, left: pos.left }} className="fixed z-50 w-96 max-w-[calc(100vw-16px)] rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
            <div className="mb-2 font-medium text-slate-900">
              {row.influencer.name} · why {fmtCount(row.prediction.expectedConversions)} conversions
            </div>
            <PredictionBreakdown p={row.prediction} platform={row.influencer.platform} feePerPost={row.influencer.feePerPost} compact />
          </div>,
          document.body,
        )}
    </>
  );
}
