import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { open, seal } from "@/lib/care-crypto";

describe("notes de cure d'âme chiffrées", () => {
  const key = randomBytes(32);

  it("chiffre puis déchiffre à l'identique, sans jamais stocker le texte en clair", () => {
    const sealed = seal("Prier pour la réconciliation du couple.", key);
    expect(sealed.ciphertext).not.toContain("Prier");
    expect(open(sealed, key)).toBe("Prier pour la réconciliation du couple.");
  });

  it("refuse une note altérée ou une mauvaise clé", () => {
    const sealed = seal("Confidentiel", key);
    expect(open({ ...sealed, ciphertext: Buffer.from("autre chose").toString("base64") }, key)).toBeNull();
    expect(open(sealed, randomBytes(32))).toBeNull();
  });
});
