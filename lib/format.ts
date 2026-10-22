const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("en-US");
}

export function fmtCompact(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return compact.format(v);
}

/** Small counts (conversions) keep one decimal so 0.4 doesn't show as 0. */
export function fmtCount(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 100) return fmtInt(v);
  if (Math.abs(v) >= 10) return v.toFixed(1).replace(/\.0$/, "");
  return v.toFixed(1);
}

export function fmtMoney(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtMult(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `×${v.toFixed(2)}`;
}

export const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };

export const titleCase = (s: string) => s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
