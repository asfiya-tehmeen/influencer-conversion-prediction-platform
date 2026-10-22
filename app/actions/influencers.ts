"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { influencers, type NewInfluencer } from "@/lib/db/schema";
import { parseInfluencerCsv, type CsvRowResult } from "@/lib/csv";
import { formToObject, influencerSchema, validate, type InfluencerInput } from "@/lib/validation";
import type { FormState } from "@/components/form";

function toRow(d: InfluencerInput, source: NewInfluencer["source"]): Omit<NewInfluencer, "id"> {
  const { commentQuality, growthSpike, ...rest } = d;
  return {
    ...rest,
    fakeFollowerSignals: commentQuality === null && !growthSpike ? null : { comment_quality: commentQuality, growth_spike: growthSpike },
    source,
  };
}

export async function saveInfluencer(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formToObject(fd);
  // Unchecked checkboxes are absent from FormData.
  values.growthSpike = fd.get("growthSpike") === "on";
  const r = validate(influencerSchema, values);
  if (!r.ok) return { errors: r.errors, values };

  const db = getDb();
  const id = Number(fd.get("id")) || null;
  const clash = db
    .select({ id: influencers.id })
    .from(influencers)
    .where(and(eq(influencers.platform, r.data.platform), eq(influencers.handle, r.data.handle)))
    .get();
  if (clash && clash.id !== id) {
    return { errors: { handle: `@${r.data.handle} already exists on ${r.data.platform}` }, values };
  }

  let savedId: number;
  if (id) {
    db.update(influencers)
      .set({ ...toRow(r.data, "manual"), updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(influencers.id, id))
      .run();
    savedId = id;
  } else {
    savedId = db.insert(influencers).values(toRow(r.data, "manual")).returning({ id: influencers.id }).get().id;
  }
  revalidatePath("/influencers");
  redirect(`/influencers/${savedId}`);
}

export async function deleteInfluencer(fd: FormData) {
  const id = Number(fd.get("id"));
  if (id) getDb().delete(influencers).where(eq(influencers.id, id)).run();
  revalidatePath("/influencers");
  redirect("/influencers");
}

export interface ImportState {
  rows?: CsvRowResult[];
  fileError?: string;
  /** CSV text kept so "Import" can commit exactly what was previewed. */
  csv?: string;
  imported?: { created: number; updated: number };
}

/** Step 1 validates and previews; step 2 (intent=commit) writes the valid rows. */
export async function importCsv(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const intent = fd.get("intent");
  let csv = typeof fd.get("csv") === "string" ? (fd.get("csv") as string) : "";
  const file = fd.get("file");
  if (intent !== "commit" && file instanceof File && file.size > 0) {
    if (file.size > 2_000_000) return { fileError: "File is larger than 2 MB." };
    csv = await file.text();
  }
  if (!csv.trim()) return { fileError: "Choose a CSV file or paste CSV text first." };

  const db = getDb();
  const existing = new Set(
    db
      .select({ platform: influencers.platform, handle: influencers.handle })
      .from(influencers)
      .all()
      .map((r) => `${r.platform}|${r.handle.toLowerCase()}`),
  );
  const parsed = parseInfluencerCsv(csv, existing);
  if ("fileError" in parsed) return { fileError: parsed.fileError, csv };
  if (intent !== "commit") return { rows: parsed.rows, csv };

  let created = 0;
  let updated = 0;
  db.transaction((tx) => {
    for (const row of parsed.rows) {
      if (!row.ok) continue;
      const data = toRow(row.data, "csv");
      const where = and(eq(influencers.platform, row.data.platform), sql`lower(${influencers.handle}) = ${row.data.handle.toLowerCase()}`);
      if (row.exists) {
        tx.update(influencers)
          .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(where)
          .run();
        updated++;
      } else {
        tx.insert(influencers).values(data).run();
        created++;
      }
    }
  });
  revalidatePath("/influencers");
  return { imported: { created, updated } };
}
