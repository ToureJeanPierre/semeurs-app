import { describe, expect, it } from "vitest";
import { fillTemplate, smsHref, telHref, whatsappHref } from "@/lib/contact-links";

describe("liens de contact", () => {
  it("met le prénom dans le message, avec ou sans accent", () => {
    expect(fillTemplate("Bonjour {prénom}, à {prenom} !", "Awa")).toBe("Bonjour Awa, à Awa !");
  });

  it("ouvre l'appel, les SMS et WhatsApp avec le message déjà écrit", () => {
    const text = "Bonjour Awa, tout va bien ?";
    expect(telHref("+2250102030405")).toBe("tel:+2250102030405");
    expect(smsHref("+2250102030405", text)).toBe(`sms:+2250102030405?body=${encodeURIComponent(text)}`);
    expect(whatsappHref("+2250102030405", text)).toBe(`https://wa.me/2250102030405?text=${encodeURIComponent(text)}`);
  });

  it("sans message, ouvre seulement la conversation", () => {
    expect(smsHref("+2250102030405")).toBe("sms:+2250102030405");
    expect(whatsappHref("+2250102030405")).toBe("https://wa.me/2250102030405");
  });
});
