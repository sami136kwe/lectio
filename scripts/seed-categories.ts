import { createServiceClient, seedCategories } from "./lib";

async function main() {
  const db = createServiceClient();
  const result = await seedCategories(db);
  console.log(`Categories: ${result.categories}, traditions: ${result.traditions}, liturgical seasons: ${result.seasons}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
