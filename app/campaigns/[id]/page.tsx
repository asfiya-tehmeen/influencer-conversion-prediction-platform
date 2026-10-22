import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCampaign } from "@/app/actions/brands";
import { RankingTable, type RankedRow } from "@/components/ranking-table";
import { buttonCls, EmptyState, PageHeader, Stat } from "@/components/ui";
import { allInfluencers, getCampaign, loadEngineContext, predictFor, summarize, toBrandTarget } from "@/lib/data";
import { fmtMoney, fmtPct, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const found = getCampaign(Number((await params).id));
  if (!found) notFound();
  const { campaign, brand } = found;
  const target = toBrandTarget(brand, campaign);
  const ctx = loadEngineContext();
  const influencers = allInfluencers();
  const rows: RankedRow[] = influencers.map((i) => ({ influencer: summarize(i), prediction: predictFor(ctx, i, target) }));
  const calibratedGroups = Object.values(ctx.calibration).filter((g) => g.ctrCount > 0).length;

  return (
    <>
      <PageHeader
        back={{ href: `/brands/${brand.id}`, label: brand.name }}
        title={campaign.name}
        subtitle={`${brand.name} · ${titleCase(brand.industry)} · influencers ranked by lowest predicted cost per acquisition.`}
        actions={
          <>
            <Link href={`/results/${campaign.id}`} className={buttonCls("secondary")}>
              Enter results
            </Link>
            <form action={deleteCampaign}>
              <input type="hidden" name="id" value={campaign.id} />
              <input type="hidden" name="brandId" value={brand.id} />
              <button className={buttonCls("danger")}>Delete</button>
            </form>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Budget" value={fmtMoney(campaign.budget)} hint={`${campaign.postsPerInfluencer} post${campaign.postsPerInfluencer === 1 ? "" : "s"} per influencer`} />
        <Stat
          label="Target audience"
          value={target.targetCountries.join(", ") || "Worldwide"}
          hint={`Ages ${target.targetAgeMin}-${target.targetAgeMax}${campaign.targetCountries || campaign.targetAgeMin ? " (campaign override)" : ""}`}
        />
        <Stat label="Profit / conversion" value={fmtMoney(brand.avgOrderValue * brand.marginPct, 2)} hint={`Break-even CPA. CVR ${fmtPct(brand.baselineConversionRate)}`} />
        <Stat label="Calibration" value={`${calibratedGroups} group${calibratedGroups === 1 ? "" : "s"}`} hint="Platform+niche groups adjusted by past results" />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No influencers yet"
          body="Add influencers manually or import a CSV to rank them for this campaign."
          action={
            <Link href="/import" className={buttonCls()}>
              Add influencers
            </Link>
          }
        />
      ) : (
        <RankingTable rows={rows} budget={campaign.budget} posts={campaign.postsPerInfluencer} defaultNiche={campaign.targetNiche} brandId={brand.id} />
      )}
    </>
  );
}
