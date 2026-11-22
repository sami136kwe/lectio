/**
 * Re-import of a reviewed CSV (exported from the admin page or with
 * `npm run export:cards -- --review`):
 *   npm run review:import -- path/to/logion-review.csv
 */
import { readFileSync } from "node:fs";
import { applyReviewUpdates } from "@/lib/admin/apply";
import { createServiceClient } from "./lib";

async function main() {
  const path = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!path) throw new Error("usage: npm run review:import -- file.csv");
  const result = await applyReviewUpdates(createServiceClient(), readFileSync(path, "utf8"));
  console.log(`${result.updated} readings updated`);
  for (const e of result.errors) console.log(`  ✖ ${e}`);
  if (result.errors.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
