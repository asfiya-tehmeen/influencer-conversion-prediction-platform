"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { brands, campaigns } from "@/lib/db/schema";
import { brandSchema, campaignSchema, formToObject, validate } from "@/lib/validation";
import type { FormState } from "@/components/form";

export async function saveBrand(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formToObject(fd);
  const r = validate(brandSchema, values);
  if (!r.ok) return { errors: r.errors, values };
  const db = getDb();
  const id = Number(fd.get("id"));
  let brandId: number;
  if (id) {
    db.update(brands).set(r.data).where(eq(brands.id, id)).run();
    brandId = id;
  } else {
    brandId = db.insert(brands).values(r.data).returning({ id: brands.id }).get().id;
  }
  revalidatePath("/brands");
  redirect(`/brands/${brandId}`);
}

export async function deleteBrand(fd: FormData) {
  const id = Number(fd.get("id"));
  if (id) getDb().delete(brands).where(eq(brands.id, id)).run();
  revalidatePath("/brands");
  redirect("/brands");
}

export async function createCampaign(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formToObject(fd);
  const r = validate(campaignSchema, values);
  if (!r.ok) return { errors: r.errors, values };
  const db = getDb();
  if (!db.select({ id: brands.id }).from(brands).where(eq(brands.id, r.data.brandId)).get()) {
    return { errors: { _form: "Brand not found" }, values };
  }
  const { id } = db.insert(campaigns).values(r.data).returning({ id: campaigns.id }).get();
  revalidatePath(`/brands/${r.data.brandId}`);
  redirect(`/campaigns/${id}`);
}

export async function deleteCampaign(fd: FormData) {
  const id = Number(fd.get("id"));
  const brandId = Number(fd.get("brandId"));
  if (id) getDb().delete(campaigns).where(eq(campaigns.id, id)).run();
  revalidatePath(`/brands/${brandId}`);
  redirect(brandId ? `/brands/${brandId}` : "/brands");
}
