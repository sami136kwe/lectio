import { expect, test, type Page } from "@playwright/test";

/**
 * Lectio features: tradition switch, search by reference, reading in order,
 * FR/EN without losing the position, daily deck (50 or unlimited, forward and
 * back), learn a verse. Needs `npm run setup` (Bible text, sources, demo cards).
 */
async function signUp(page: Page, label: string, testInfo: { project: { name: string } }) {
  await page.goto("/login?mode=signup");
  await page.getByLabel("Adresse e-mail").fill(`e2e-${label}-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Mot de passe").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("radio", { name: "Français" }).click();
  await page.getByRole("radio", { name: "Les deux" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  for (const theme of [/^Jésus/, /^Prière/, /^Marie/, /^Mystère/, /^Psaumes/]) await page.getByRole("checkbox", { name: theme }).check();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Commencer la lecture" }).click();
  await expect(page).toHaveURL(/\/feed/);
}

test("the reading switch shows Catholic, Orthodox, both or neither", async ({ page }, testInfo) => {
  await signUp(page, "tradition", testInfo);
  await page.goto("/search?q=Luc%201%2C%2026");
  await page.getByTestId("reference-result").getByRole("link", { name: /Luc 1, 26-33/ }).first().click();
  const card = page.locator("article").first();
  await expect(card.locator('[data-tradition="catholic"]')).toBeVisible();
  await expect(card.locator('[data-tradition="orthodox"]')).toBeVisible();
  await expect(card.getByText("Point de divergence.")).toBeVisible();

  await card.getByRole("button", { name: "Orthodoxe", exact: true }).click();
  await expect(card.locator('[data-tradition="catholic"]')).toHaveCount(0);
  await expect(card.locator('[data-tradition="orthodox"]')).toBeVisible();

  await card.getByRole("button", { name: "Neutre", exact: true }).click();
  await expect(card.locator("[data-tradition]")).toHaveCount(0);
  await expect(card.getByText("Ce que dit le texte")).toBeVisible();

  await card.getByRole("button", { name: "Les deux", exact: true }).click();
  await expect(card.locator("[data-tradition]")).toHaveCount(2);
});

test("a reference typed in French, English or Greek numbering opens the right card", async ({ page }, testInfo) => {
  await signUp(page, "search", testInfo);
  await page.goto("/search");
  const box = page.getByRole("searchbox");
  await box.fill("Psaume 21 (LXX)");
  await expect(page.getByTestId("reference-result")).toContainText("Psaume 22 (21 dans la Septante)");
  await box.fill("Jn 3,16");
  await expect(page.getByTestId("reference-result")).toContainText("Jean 3, 16");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/cards\//);
  await expect(page.locator("article h1")).toContainText("Jean 3, 16-17");
  await expect(page.getByText(/Car Dieu a tant aimé le monde/)).toBeVisible();
});

test("reading a book in order resumes where the reader stopped", async ({ page }, testInfo) => {
  await signUp(page, "inorder", testInfo);
  await page.goto("/books/MRK");
  await page.getByTestId("read-in-order").click();
  await expect(page.getByTestId("reading-position")).toHaveText(/^1 \/ \d+$/);
  const first = await page.locator("article h1").textContent();
  await page.getByTestId("reading-next").click();
  await expect(page.getByTestId("reading-position")).toHaveText(/^2 \/ \d+$/);
  await expect(page.locator("article h1")).not.toHaveText(first ?? "");
  await page.goto("/books/MRK/read");
  await expect(page.getByTestId("reading-position")).toHaveText(/^2 \/ \d+$/);
});

test("the daily deck goes forward and back, keeps its position, and switches FR/EN in place", async ({ page }, testInfo) => {
  await signUp(page, "deck", testInfo);
  await page.goto("/deck");
  await expect(page.getByTestId("deck-position")).toHaveText("Carte 1"); // unlimited by default: no total
  await page.getByTestId("deck-next").click();
  await expect(page.getByTestId("deck-position")).toHaveText("Carte 2");
  const heading = page.locator("article h2").first();
  const french = (await heading.textContent()) ?? "";

  // Per-card language button: same card in English, same position.
  await page.getByTestId("flip-language").click();
  await expect(heading).not.toHaveText(french);
  await expect(page.locator("article").first()).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("deck-position")).toHaveText("Carte 2");

  await page.getByTestId("deck-prev").click();
  await expect(page.getByTestId("deck-position")).toHaveText("Carte 1");
  await page.getByTestId("deck-next").click();
  await page.reload();
  await expect(page.getByTestId("deck-position")).toHaveText("Carte 2");

  // 50 cards a day: the total is shown.
  await page.goto("/profile");
  await page.getByTestId("limit-50").click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();
  await page.goto("/deck");
  await expect(page.getByTestId("deck-position")).toHaveText(/^Carte 2 sur \d+$/);

  // Previous days list today's deck.
  await page.goto("/deck/history");
  await expect(page.getByRole("link").filter({ hasText: /carte/ }).first()).toBeVisible();

  // Header button: the whole interface in English.
  await page.getByTestId("language-toggle").click();
  await expect(page.getByRole("heading", { name: "Previous days" })).toBeVisible();
});

test("a verse can be learnt with progressive masking", async ({ page }, testInfo) => {
  await signUp(page, "learn", testInfo);
  await page.goto("/search?q=Ps%2023");
  await page.getByTestId("reference-result").getByRole("link", { name: /Psaume 23/ }).first().click();
  await page.getByTestId("learn-verse").click();
  await expect(page.getByTestId("learn-verse")).toHaveText("Ajouté à vos versets à apprendre");
  await page.goto("/learn");
  const item = page.getByTestId("learn-item");
  await expect(item).toContainText("Niveau 0 / 5");
  await expect(item.getByTestId("masked-word")).toHaveCount(0);
  await item.getByRole("button", { name: "Afficher le texte" }).click();
  await item.getByRole("button", { name: "Bien" }).click();
  await expect(page.getByText("Session terminée")).toBeVisible();
});

test("every chapter of a book can be read, with readings or the Fathers' commentary", async ({ page }) => {
  await page.goto("/books/MAT");
  await expect(page.getByTestId("chapter-28")).toBeVisible();
  await page.getByTestId("chapter-6").click();
  await expect(page).toHaveURL(/\/books\/MAT\/6$/);
  const passages = page.getByTestId("chapter-passage");
  expect(await passages.count()).toBeGreaterThan(4);
  await expect(page.getByText("Notre Père qui es aux cieux", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Lecture catholique").first()).toBeVisible(); // Mt 6:9-13 has a card
  await expect(page.getByTestId("father-extract").first()).toBeVisible();
  await page.getByTestId("chapter-next").first().click();
  await expect(page.getByTestId("chapter-title")).toHaveText("Matthieu 7");
});

test("the about page carries the disclaimer", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByTestId("disclaimer")).toContainText("pas un enseignement officiel d'une Église");
});
