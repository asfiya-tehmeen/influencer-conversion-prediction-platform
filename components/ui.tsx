import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ title, description, actions, children, className = "" }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            {title && <h2 className="font-medium text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

const TONES = {
  slate: "bg-slate-100 text-slate-700",
  indigo: "bg-indigo-50 text-indigo-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-rose-50 text-rose-700",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="num mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, name, error, hint, children, className = "" }: { label: string; name: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50";

export function buttonCls(variant: "primary" | "secondary" | "ghost" | "danger" = "primary", size: "sm" | "md" = "md") {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm" };
  const variants = {
    primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700",
    secondary: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  };
  return `${base} ${sizes[size]} ${variants[variant]}`;
}

/** Hover/focus tooltip. Content is rendered in the DOM so it is accessible and printable. */
export function InfoTip({ label, children, align = "left" }: { label: ReactNode; children: ReactNode; align?: "left" | "right" }) {
  return (
    <span className="group relative inline-flex">
      <button type="button" className="rounded text-left underline decoration-slate-300 decoration-dotted underline-offset-4 hover:decoration-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        {label}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute top-full z-40 mt-2 w-80 max-w-[80vw] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-700 opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${align === "right" ? "right-0" : "left-0"}`}
      >
        {children}
      </span>
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function PlatformBadge({ platform }: { platform: string }) {
  const tone: Record<string, string> = {
    instagram: "bg-pink-50 text-pink-700",
    tiktok: "bg-slate-900 text-white",
    youtube: "bg-red-50 text-red-700",
  };
  const label: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone[platform] ?? TONES.slate}`}>{label[platform] ?? platform}</span>;
}
