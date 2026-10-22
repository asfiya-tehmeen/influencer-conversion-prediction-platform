import Link from "next/link";
import { BrandForm } from "@/components/brand-forms";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { allBrands, allCampaigns, knownIndustries } from "@/lib/data";
import { fmtMoney, fmtPct, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function BrandsPage() {
  const brands = allBrands();
  const campaigns = allCampaigns();
  return (
    <>
      <PageHeader title="Brands" subtitle="Pick a brand to create a campaign and rank influencers by predicted cost per acquisition." />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-3">
          {brands.length === 0 && <EmptyState title="No brands yet" body="Create your first brand profile with the form." />}
          {brands.map((b) => {
            const bc = campaigns.filter((c) => c.brand.id === b.id);
            return (
              <Link key={b.id} href={`/brands/${b.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-900">{b.name}</div>
                  <Badge tone="indigo">{titleCase(b.industry)}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                  <span>Targets: {b.targetCountries.join(", ") || "Worldwide"}, {b.targetAgeMin}-{b.targetAgeMax}</span>
                  <span>AOV {fmtMoney(b.avgOrderValue)} · margin {fmtPct(b.marginPct, 0)}</span>
                  <span>CVR {fmtPct(b.baselineConversionRate)}</span>
                  <span>{bc.length} campaign{bc.length === 1 ? "" : "s"}</span>
                </div>
              </Link>
            );
          })}
        </div>
        <Card title="New brand" description="Who you sell to and what a sale is worth.">
          <BrandForm industries={knownIndustries()} />
        </Card>
      </div>
    </>
  );
}
