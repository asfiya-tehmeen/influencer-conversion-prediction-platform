"use client";

import { useActionState } from "react";
import { createCampaign, saveBrand } from "@/app/actions/brands";
import type { Brand } from "@/lib/db/schema";
import { titleCase } from "@/lib/format";
import { FormError, Input, Select, SubmitButton, type FormState } from "./form";

export function BrandForm({ brand, industries }: { brand?: Brand; industries: string[] }) {
  const [state, action] = useActionState(saveBrand, {} as FormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      {brand && <input type="hidden" name="id" value={brand.id} />}
      <FormError state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input state={state} name="name" label="Brand name" defaultValue={brand?.name} placeholder="PeakFuel Nutrition" />
        <Input
          state={state}
          name="industry"
          label="Industry"
          defaultValue={brand?.industry}
          list="industry-options"
          placeholder="supplements"
          hint="Drives the niche-fit multiplier. Pick one from the matrix or type a new one."
        />
        <datalist id="industry-options">
          {industries.map((i) => (
            <option key={i} value={i}>
              {titleCase(i)}
            </option>
          ))}
        </datalist>
        <Input
          state={state}
          name="targetCountries"
          label="Target countries"
          defaultValue={brand?.targetCountries.join(", ")}
          placeholder="AE, SA, KW"
          hint="2-letter codes, comma separated. Leave empty for worldwide."
        />
        <div className="grid grid-cols-2 gap-3">
          <Input state={state} name="targetAgeMin" label="Min age" type="number" defaultValue={brand?.targetAgeMin ?? 18} />
          <Input state={state} name="targetAgeMax" label="Max age" type="number" defaultValue={brand?.targetAgeMax ?? 44} />
        </div>
        <Input state={state} name="avgOrderValue" label="Average order value (USD)" type="number" step="0.01" defaultValue={brand?.avgOrderValue} placeholder="55" />
        <Input
          state={state}
          name="marginPct"
          label="Margin %"
          type="number"
          step="0.1"
          defaultValue={brand ? +(brand.marginPct * 100).toFixed(2) : undefined}
          placeholder="45"
          hint="Profit per conversion = order value × margin."
        />
        <Input
          state={state}
          name="baselineConversionRate"
          label="Landing page conversion rate %"
          type="number"
          step="0.1"
          defaultValue={brand ? +(brand.baselineConversionRate * 100).toFixed(2) : 2}
          hint="Share of clicks that buy. Defaults to 2% if left empty."
        />
      </div>
      <SubmitButton>{brand ? "Save brand" : "Create brand"}</SubmitButton>
    </form>
  );
}

export function CampaignForm({ brand, niches }: { brand: Brand; niches: string[] }) {
  const [state, action] = useActionState(createCampaign, {} as FormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="brandId" value={brand.id} />
      <FormError state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input state={state} name="name" label="Campaign name" placeholder="Summer launch" className="sm:col-span-2" />
        <Input state={state} name="budget" label="Budget (USD)" type="number" step="1" placeholder="10000" />
        <Input state={state} name="postsPerInfluencer" label="Posts per influencer" type="number" defaultValue={1} min={1} />
        <Select
          state={state}
          name="targetNiche"
          label="Target niche"
          options={[{ value: "", label: "Any niche" }, ...niches.map((n) => ({ value: n, label: titleCase(n) }))]}
        />
        <Input
          state={state}
          name="targetCountries"
          label="Target countries"
          placeholder={brand.targetCountries.join(", ") || "Worldwide"}
          hint="Leave empty to use the brand's targets."
        />
        <Input state={state} name="targetAgeMin" label="Min age" type="number" placeholder={String(brand.targetAgeMin)} hint="Empty = brand default" />
        <Input state={state} name="targetAgeMax" label="Max age" type="number" placeholder={String(brand.targetAgeMax)} hint="Empty = brand default" />
      </div>
      <SubmitButton pendingText="Creating…">Create campaign and rank influencers</SubmitButton>
    </form>
  );
}
