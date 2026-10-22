import Link from "next/link";
import { buttonCls, Card, Stat } from "@/components/ui";
import { allBrands, allCampaigns, allInfluencers, loadResults } from "@/lib/data";

export const dynamic = "force-dynamic";

const STEPS = [
  { href: "/brands", title: "Brands: find the best CPA", body: "Create a campaign and see every influencer ranked by predicted conversions and cost per acquisition, with the full reasoning." },
  { href: "/value", title: "Influencers: know your value", body: "See your estimated value per post, how you rank in your niche, and which metric is holding you back." },
  { href: "/import", title: "Data entry", body: "Add influencers by hand or import a CSV. API connectors for Instagram, TikTok and YouTube can plug in later." },
  { href: "/results", title: "Results and calibration", body: "Log actual clicks and conversions after a campaign. Predictions for that platform and niche improve automatically." },
];

export default function Home() {
  const influencers = allInfluencers().length;
  const brands = allBrands().length;
  const campaigns = allCampaigns().length;
  const results = loadResults().length;
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 px-6 py-10 text-white shadow-sm sm:px-10">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Pay for conversions, not follower counts.</h1>
        <p className="mt-3 max-w-2xl text-indigo-100">
          Taseer predicts how many sales an influencer post will drive for your brand and what each one will cost, from metrics you can see and check.
        </p>
        <div className="mt-6 rounded-lg bg-white/10 px-4 py-3 font-mono text-sm text-indigo-50">
          conversions = reach × audience match × authenticity × CTR × CVR
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/brands" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50">
            I&apos;m a brand
          </Link>
          <Link href="/value" className="rounded-lg border border-white/40 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            I&apos;m an influencer
          </Link>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Influencers" value={influencers} />
        <Stat label="Brands" value={brands} />
        <Stat label="Campaigns" value={campaigns} />
        <Stat label="Campaign results" value={results} hint="Used for calibration" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {STEPS.map((s) => (
          <Card key={s.href} title={s.title}>
            <p className="text-sm text-slate-600">{s.body}</p>
            <Link href={s.href} className={`${buttonCls("secondary", "sm")} mt-4`}>
              Open
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
