import { describe, expect, it } from "vitest";
import { inviteMessage, nextServicePhrase } from "@/lib/outreach";
import type { ServiceType } from "@/lib/services";

const sunday: ServiceType = { id: "1", name: "Culte d'actions de grâces", short_name: null, weekday: 0, start_time: "09:00:00", end_time: "12:00:00", place: null };
const friday: ServiceType = { id: "2", name: "Moment de prières", short_name: null, weekday: 5, start_time: "18:00:00", end_time: "20:00:00", place: null };

describe("invitation au culte", () => {
  it("annonce le prochain culte (samedi → dimanche)", () => {
    const r = nextServicePhrase([sunday, friday], new Date("2026-10-31T10:00:00Z"));
    expect(r?.phrase).toBe("au culte d'actions de grâces de ce dimanche 1 novembre à 9 h");
  });

  it("remplace le prénom et le culte", () => {
    expect(inviteMessage("Bonjour {prénom}, venez {culte}.", "Awa", "au culte de dimanche")).toBe("Bonjour Awa, venez au culte de dimanche.");
  });

  it("sans culte paramétré, rien à annoncer", () => {
    expect(nextServicePhrase([], new Date())).toBeNull();
  });
});
