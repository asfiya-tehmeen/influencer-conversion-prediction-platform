import { notFound } from "next/navigation";
import { BrandForm } from "@/components/brand-forms";
import { Card, PageHeader } from "@/components/ui";
import { getBrand, knownIndustries } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const brand = getBrand(Number((await params).id));
  if (!brand) notFound();
  return (
    <>
      <PageHeader back={{ href: `/brands/${brand.id}`, label: brand.name }} title="Edit brand" />
      <Card className="max-w-3xl">
        <BrandForm brand={brand} industries={knownIndustries()} />
      </Card>
    </>
  );
}
