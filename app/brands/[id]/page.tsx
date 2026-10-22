import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBrand } from "@/app/actions/brands";
import { CampaignForm } from "@/components/brand-forms";
import { Badge, buttonCls, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { allCampaigns, getBrand, knownNiches } from "@/lib/data";
import { fmtMoney, fmtPct, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const brand = getBrand(Number((await params).id));
  if (!brand) notFound();
  const campaigns = allCampaigns().filter((c) => c.brand.id === brand.id);
  return (
    <>
      <PageHeader
        back={{ href: "/brands", label: "Brands" }}
        title={brand.name}
        subtitle={<Badge tone="indigo">{titleCase(brand.industry)}</Badge>}
        actions={
          <>
            <Link href={`/brands/${brand.id}/edit`} className={buttonCls("secondary")}>
              Edit brand
            </Link>
            <form action={deleteBrand}>
              <input type="hidden" name="id" value={brand.id} />
              <button className={buttonCls("danger")}>Delete</button>
            </form>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Target audience" value={brand.targetCountries.join(", ") || "Worldwide"} hint={`Ages ${brand.targetAgeMin}-${brand.targetAgeMax}`} />
        <Stat label="Avg order value" value={fmtMoney(brand.avgOrderValue)} />
        <Stat label="Profit / conversion" value={fmtMoney(brand.avgOrderValue * brand.marginPct, 2)} hint={`${fmtMoney(brand.avgOrderValue)} × ${fmtPct(brand.marginPct, 0)} margin`} />
        <Stat label="Landing page CVR" value={fmtPct(brand.baselineConversionRate)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card title="Campaigns">
          {campaigns.length === 0 ? (
            <EmptyState title="No campaigns yet" body="Create a campaign to see influencers ranked by predicted CPA." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {campaigns.map(({ campaign: c, results }) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/campaigns/${c.id}`} className="font-medium text-indigo-700 hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-sm text-slate-500">
                      {fmtMoney(c.budget)} budget · {c.postsPerInfluencer} post{c.postsPerInfluencer === 1 ? "" : "s"} each · {c.targetNiche ? titleCase(c.targetNiche) : "Any niche"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {results > 0 && <Badge tone="green">{results} results</Badge>}
                    <Link href={`/campaigns/${c.id}`} className={buttonCls("secondary", "sm")}>
                      Rank influencers
                    </Link>
                    <Link href={`/results/${c.id}`} className={buttonCls("ghost", "sm")}>
                      Results
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="New campaign">
          <CampaignForm brand={brand} niches={knownNiches()} />
        </Card>
      </div>
    </>
  );
}
