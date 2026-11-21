import { expect, test } from "@playwright/test";

/**
 * Main user journey: sign up, onboarding, feed, save a card, find it in the
 * stash, review it with spaced repetition, complete the daily challenge.
 * Needs the demo content (`npm run seed:demo`) and e-mail confirmation off
 * (the default for `supabase start`).
 */
test("new user can sign up, browse the feed, save and review a card", async ({ page }, testInfo) => {
  const email = `e2e-${testInfo.project.name}-${Date.now()}@example.com`;

  // Sign up
  await page.goto("/login?mode=signup");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  // Onboarding: language, interests, daily goal
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("radio", { name: "Français" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("checkbox", { name: /^Jésus/ }).check();
  await page.getByRole("checkbox", { name: /^Prière/ }).check();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("radio", { name: /3 passages/ }).click();
  await page.getByRole("button", { name: "Commencer la lecture" }).click();

  // Feed
  await expect(page).toHaveURL(/\/feed/);
  const firstTitle = page.locator("article h2").first();
  await expect(firstTitle).toBeVisible();
  const savedTitle = (await firstTitle.textContent())?.trim() ?? "";
  expect(savedTitle.length).toBeGreaterThan(2);
  await expect(page.getByText("1 / 3 aujourd'hui")).toBeVisible();

  // Save the card
  await page.getByRole("button", { name: /^★?\s*Garder$/ }).click();
  await expect(page.getByRole("button", { name: /Gardé$/ })).toBeVisible();

  // Next card via the button
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.locator("article h2").first()).not.toHaveText(savedTitle);

  // Stash page shows the saved card; add a note
  await page.goto("/stash");
  await expect(page.getByRole("heading", { name: savedTitle })).toBeVisible();
  await page.getByLabel("Ma note").fill("À tester lundi en réunion");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();

  // Review session: reveal then rate
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: savedTitle })).toBeVisible();
  await page.getByRole("button", { name: "Voir le passage" }).click();
  await expect(page.getByText("À vivre ou à méditer")).toBeVisible();
  await page.getByRole("button", { name: "Bien" }).click();
  await expect(page.getByText("Session terminée")).toBeVisible();

  // Daily challenge
  await page.goto("/challenge");
  await page.getByRole("checkbox", { name: "C'est fait" }).check();
  await expect(page.getByText("Défi du jour accompli.")).toBeVisible();
  await expect(page.getByText(/Série : 1 jour/)).toBeVisible();

  // Progress
  await page.goto("/progress");
  await expect(page.getByText("Série actuelle")).toBeVisible();
});

test("anonymous visitors are sent to the login page", async ({ page }) => {
  await page.goto("/stash");
  await expect(page).toHaveURL(/\/login\?next=%2Fstash/);
});
