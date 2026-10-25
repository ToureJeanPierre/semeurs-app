import { describe, expect, it } from "vitest";
import {
  AUTH_EMAIL_DOMAIN,
  authEmailToPhone,
  formatPhone,
  parseIvorianPhone,
  phoneToAuthEmail,
} from "@/lib/phone";

describe("parseIvorianPhone", () => {
  it.each([
    ["0708310433", "0708310433"],
    ["07 08 31 04 33", "0708310433"],
    ["+225 07 08 31 04 33", "0708310433"],
    ["002250506325243", "0506325243"],
    ["07-78-01-66-95", "0778016695"],
    ["2722000000", "2722000000"],
  ])("accepte %s", (input, national) => {
    expect(parseIvorianPhone(input)?.national).toBe(national);
  });

  it.each(["", "070831043", "07083104331", "0908310433", "abc", "+33612345678"])(
    "refuse %s",
    (input) => {
      expect(parseIvorianPhone(input)).toBeNull();
    },
  );

  it("donne le format international", () => {
    expect(parseIvorianPhone("0708310433")?.e164).toBe("+2250708310433");
  });
});

describe("adresse technique du compte", () => {
  it("fait l'aller-retour numéro ↔ adresse", () => {
    const phone = parseIvorianPhone("07 08 31 04 33")!;
    const email = phoneToAuthEmail(phone);
    expect(email).toBe(`2250708310433@${AUTH_EMAIL_DOMAIN}`);
    expect(authEmailToPhone(email)).toEqual(phone);
  });

  it("ignore une adresse d'un autre domaine", () => {
    expect(authEmailToPhone("2250708310433@gmail.com")).toBeNull();
    expect(authEmailToPhone(undefined)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groupe les chiffres par deux", () => {
    expect(formatPhone(parseIvorianPhone("0708310433")!)).toBe("07 08 31 04 33");
  });
});
