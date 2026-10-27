import { describe, expect, it } from "vitest";
import { generateStarterPassword } from "@/lib/password";

describe("generateStarterPassword", () => {
  it("produit un mot de passe lisible : trois syllabes, un tiret, quatre chiffres", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateStarterPassword()).toMatch(/^([bcdfghjkmnprstvz][aeiu]){3}-[2-9]\d{3}$/);
    }
  });

  it("ne produit pas deux fois le même mot de passe d'affilée", () => {
    const seen = new Set(Array.from({ length: 200 }, generateStarterPassword));
    expect(seen.size).toBeGreaterThan(190);
  });
});
