import { expect, test } from "@playwright/test";

/**
 * Read-aloud: playback starts quickly, the card's segments follow one another
 * without gaps (the next one is fetched while the current one plays) and the
 * sentence being read is highlighted.
 *
 * Uses a fake local voice server (tests/e2e/fake-tts.mjs) with a 1.2 s synthesis
 * delay. The app server must run with KOKORO_URL=http://127.0.0.1:8799 (the
 * Playwright config does this when it starts the server itself); otherwise the
 * test is skipped.
 */
test("a card is read without long waits or gaps, with the sentence highlighted", async ({ page }, testInfo) => {
  const caps = await page.request.get("/api/tts").then((r) => r.json()).catch(() => ({ kokoro: false }));
  test.skip(!caps.kokoro, "app server not started with KOKORO_URL=http://127.0.0.1:8799");

  // Record every audio file played, with timestamps.
  await page.addInitScript(() => {
    const log: { event: string; t: number }[] = [];
    (window as unknown as { __audio: typeof log }).__audio = log;
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (this.src.startsWith("blob:")) {
        log.push({ event: "play", t: performance.now() });
        this.addEventListener("ended", () => log.push({ event: "ended", t: performance.now() }), { once: true });
      }
      return original.call(this);
    };
  });

  await page.goto("/login?mode=signup");
  await page.getByLabel("Adresse e-mail").fill(`e2e-audio-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Mot de passe").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("checkbox", { name: /^Jésus/ }).check();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Commencer la lecture" }).click();
  await expect(page.locator("article h2").first()).toBeVisible();

  // The fast local voice is offered and chosen by default.
  await expect(page.getByLabel("Voix").locator("option").first()).toContainText("local");

  const clickedAt = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Écouter" }).click();

  // Playback starts shortly after the first segment is synthesized (1.2 s) — not after the whole card.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __audio: unknown[] }).__audio.length), { timeout: 6000 }).toBeGreaterThan(0);
  const log = () => page.evaluate(() => (window as unknown as { __audio: { event: string; t: number }[] }).__audio);
  const first = (await log()).find((e) => e.event === "play")!;
  expect(first.t - clickedAt).toBeLessThan(3500);

  // While reading, different sentences get highlighted.
  const highlighted = new Set<string>();
  const stopButton = page.getByRole("button", { name: "Arrêter la lecture" });
  for (let i = 0; i < 400 && (await stopButton.isVisible()); i++) {
    const text = await page.locator(".rounded.bg-accent-soft").first().textContent({ timeout: 500 }).catch(() => null);
    if (text) highlighted.add(text.trim());
    await page.waitForTimeout(100);
  }
  expect(highlighted.size).toBeGreaterThanOrEqual(3);

  // Back to idle at the end, after several segments, with short gaps between them.
  await expect(page.getByRole("button", { name: "Écouter" })).toBeVisible();
  const events = await log();
  const plays = events.filter((e) => e.event === "play");
  expect(plays.length).toBeGreaterThanOrEqual(2);
  // The segment after k starts right when k ends. (The log order of "ended" and the next "play" is
  // not reliable: the player moves on inside the same event, so compare timestamps, not positions.)
  const ends = events.filter((e) => e.event === "ended");
  expect(ends.length).toBe(plays.length);
  for (let i = 1; i < plays.length; i++) {
    expect(plays[i]!.t - ends[i - 1]!.t).toBeLessThan(800); // the next segment was already fetched
  }
});
