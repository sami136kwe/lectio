import { expect, test } from "@playwright/test";

/**
 * Re-reading: history, "review later", the re-read mode, and the rule that
 * re-reads never count towards the daily goal or the streak.
 */
test("a user can browse their history and re-read without affecting the goal or the streak", async ({ page }, testInfo) => {
  await page.goto("/login?mode=signup");
  await page.getByLabel("Adresse e-mail").fill(`e2e-reread-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Mot de passe").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("checkbox", { name: /^Jésus/ }).check();
  await page.getByRole("checkbox", { name: /^Prière/ }).check();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("radio", { name: /10 passages/ }).click();
  await page.getByRole("button", { name: "Commencer la lecture" }).click();

  // Read three new cards.
  await expect(page).toHaveURL(/\/feed/);
  await expect(page.getByText("1 / 10 aujourd'hui")).toBeVisible();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByText("3 / 10 aujourd'hui")).toBeVisible();

  // History lists them; search and counters work.
  await page.goto("/history");
  await expect(page.getByText("3 passages lus")).toBeVisible();
  await expect(page.getByText(/Lu 1 fois/).first()).toBeVisible();
  await page.getByRole("button", { name: "Revoir plus tard" }).first().click();
  await expect(page.getByText("Dans votre file de révision")).toBeVisible();
  await page.getByLabel("Rechercher dans mon historique").fill("zzzzzznotaword");
  await expect(page.getByText(/Aucun passage lu ne correspond/)).toBeVisible();
  await page.getByRole("button", { name: "Réinitialiser les filtres" }).click();
  await expect(page.getByText("3 passages lus")).toBeVisible();

  // The card put back in the queue is due for spaced repetition.
  await page.goto("/review");
  await expect(page.getByRole("button", { name: "Voir le passage" })).toBeVisible();

  // Re-read mode: two cards re-read, with their read count.
  await page.goto("/reread");
  await page.getByRole("radio", { name: "Les plus anciens d'abord" }).check();
  await page.getByRole("button", { name: "Commencer" }).click();
  await expect(page.getByText("1 relu dans cette session")).toBeVisible();
  await expect(page.getByText(/Lu \d+ fois|Lu 1 fois/).first()).toBeVisible();
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByText("2 relus dans cette session")).toBeVisible();

  // Back in the feed: re-reads did not add to the goal (3 new + the card shown now = 4),
  // and they show separately as a bonus.
  await page.goto("/feed");
  await expect(page.getByText("4 / 10 aujourd'hui")).toBeVisible();
  await expect(page.getByText("+2 relus aujourd'hui (sans effet sur la série)")).toBeVisible();

  // Same for the streak: one day of activity, no more.
  await page.goto("/progress");
  await expect(page.getByText("1 jour").first()).toBeVisible();
  await expect(page.getByText("Série actuelle")).toBeVisible();
});

test("turning on 'include cards already read' mixes re-reads into the feed", async ({ page }, testInfo) => {
  await page.goto("/login?mode=signup");
  await page.getByLabel("Adresse e-mail").fill(`e2e-mix-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Mot de passe").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("checkbox", { name: /^Jésus/ }).check();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Commencer la lecture" }).click();
  await expect(page).toHaveURL(/\/feed/);

  // Read a few cards so there is something to re-read.
  for (let i = 0; i < 3; i++) {
    await expect(page.locator("article h2").first()).toBeVisible();
    await page.getByRole("button", { name: "Suivant" }).click();
  }

  const toggle = page.getByRole("checkbox", { name: "Inclure des passages déjà lus" });
  await expect(toggle).not.toBeChecked(); // new cards only by default
  await toggle.check();
  await expect(page.getByLabel("Mélange")).toBeVisible();
  await expect(page.getByRole("option", { name: "80 % nouveaux, 20 % relus" })).toBeAttached();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Inclure des passages déjà lus" })).toBeChecked(); // saved on the profile
});

test("when no new card is left, the feed switches to re-reading with a clear message", async ({ page }, testInfo) => {
  await page.goto("/login?mode=signup");
  await page.getByLabel("Adresse e-mail").fill(`e2e-fallback-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Mot de passe").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  // The theme with the fewest cards: the other themes grow as content is written.
  await page.getByRole("checkbox", { name: /^Psaumes/ }).check();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Commencer la lecture" }).click();
  await expect(page).toHaveURL(/\/feed/);

  // Read every card (the feed also mixes in discovery cards from other themes) until nothing is left.
  test.setTimeout(240_000);
  const allSeen = page.getByText("Vous avez tout lu pour l'instant");
  const next = page.getByRole("button", { name: "Suivant" });
  for (let i = 0; i < 1000 && !(await allSeen.isVisible()); i++) {
    if (await next.isEnabled()) await next.click();
    await page.waitForTimeout(30);
  }
  await expect(allSeen).toBeVisible();

  // The next time the feed opens there is no new card: it turns into a re-read session, with a message.
  await page.reload();
  await expect(page.getByText("Vous avez lu tous les nouveaux passages de vos thèmes")).toBeVisible();
  await expect(page.getByText(/Lu \d+ fois|Lu 1 fois/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Revoir plus tard" })).toBeVisible();
  // Re-reads still don't count towards the goal.
  await expect(page.getByText("12 / 5 aujourd'hui")).toHaveCount(0);
});
