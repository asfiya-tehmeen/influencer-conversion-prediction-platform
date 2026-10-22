import { DB_PATH, openDb } from "@/lib/db";
import { seed } from "@/lib/db/seed";

const counts = seed(openDb());
console.log(`Seeded ${DB_PATH}:`, counts);
