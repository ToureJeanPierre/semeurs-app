import { expect, test } from "@playwright/test";

test("une personne non connectée est envoyée vers la connexion", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByRole("heading", { name: "Les Semeurs de la Parole" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Logo de l'Église/ })).toBeVisible();
});

test("un numéro invalide affiche un message clair", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Numéro de téléphone").fill("09 12 34");
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(/Numéro invalide/)).toBeVisible();
});

test("le manifeste rend l'application installable", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.short_name).toBe("Les Semeurs");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
});

test("les routes protégées refusent l'accès sans connexion", async ({ request }) => {
  const res = await request.post("/api/passkey/register/options");
  expect(res.status()).toBe(401);
});
