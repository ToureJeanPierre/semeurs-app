import { describe, expect, it } from "vitest";
import { importContact } from "@/lib/contact-import";

describe("importContact", () => {
  it("prend le premier mot comme nom et le reste comme prénoms", () => {
    expect(importContact(["KOUASSI Jean Marc"], ["+225 07 08 31 04 33"])).toEqual({
      lastName: "KOUASSI",
      firstName: "Jean Marc",
      phone: "07 08 31 04 33",
      phoneRejected: false,
    });
  });

  it("choisit le premier numéro ivoirien valide", () => {
    expect(importContact(["Awa"], ["+33 6 12 34 56 78", "0505060708"]).phone).toBe("05 05 06 07 08");
  });

  it("signale un contact sans numéro ivoirien", () => {
    expect(importContact(["Paul Aka"], ["+33 6 12 34 56 78"])).toMatchObject({ phone: null, phoneRejected: true });
  });

  it("supporte un contact sans nom ni numéro", () => {
    expect(importContact()).toEqual({ lastName: "", firstName: "", phone: null, phoneRejected: false });
  });
});
