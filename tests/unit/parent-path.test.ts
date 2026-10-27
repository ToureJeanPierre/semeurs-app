import { describe, expect, it } from "vitest";
import { parentPath } from "@/lib/parent-path";

describe("parentPath", () => {
  it("remonte d'un niveau logique", () => {
    expect(parentPath("/fideles/7c1e2f00-0000-4000-8000-000000000001")).toBe("/fideles");
    expect(parentPath("/fideles/nouveau")).toBe("/fideles");
    expect(parentPath("/administration/groupes/abc")).toBe("/administration/groupes");
    expect(parentPath("/administration/groupes")).toBe("/administration");
  });

  it("ramène à l'accueil depuis un écran de premier niveau", () => {
    expect(parentPath("/fideles")).toBe("/");
    expect(parentPath("/profil")).toBe("/");
    expect(parentPath("/famille")).toBe("/");
    expect(parentPath("/m/prayer")).toBe("/");
  });
});
