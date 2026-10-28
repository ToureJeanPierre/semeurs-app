import { describe, expect, it } from "vitest";
import { byMethod, collected, parseAmount, progress, recentPeriods, remaining, reversedIds, summarize } from "@/lib/contributions";

describe("cotisations", () => {
  const payments = [
    { id: "1", amount: 5000, status: "validated" as const, method: "cash", reverses_id: null },
    { id: "2", amount: 2000, status: "declared" as const, method: "wave", reverses_id: null },
    { id: "3", amount: 3000, status: "validated" as const, method: "orange_money", reverses_id: null },
    { id: "4", amount: -3000, status: "validated" as const, method: "orange_money", reverses_id: "3" },
    { id: "5", amount: 1000, status: "rejected" as const, method: "cash", reverses_id: null },
  ];

  it("ne compte que les versements validés, annulations déduites", () => {
    expect(collected(payments)).toBe(5000);
    expect(byMethod(payments)).toEqual({ cash: 5000, orange_money: 0 });
    expect([...reversedIds(payments)]).toEqual(["3"]);
  });

  it("calcule l'avancement et le reste dû", () => {
    expect(progress(7500, 10000)).toBe(75);
    expect(progress(15000, 10000)).toBe(100);
    expect(progress(5000, null)).toBeNull();
    expect(remaining(5000, 2000)).toBe(3000);
    expect(remaining(5000, 6000)).toBe(0);
    expect(remaining(null, 0)).toBe(0);
  });

  it("résume qui a payé", () => {
    expect(summarize([{ state: "paid" }, { state: "unpaid" }, { state: "partial" }, { state: "unpaid" }])).toEqual({ paid: 1, partial: 1, unpaid: 2 });
  });

  it("lit les montants saisis à l'ivoirienne", () => {
    expect(parseAmount("25 000")).toBe(25000);
    expect(parseAmount("25.000 F")).toBe(25000);
    expect(parseAmount("5000fcfa")).toBe(5000);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-500")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("liste les derniers mois", () => {
    expect(recentPeriods("2026-01-15", 3)).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
});

describe("montant en lettres", () => {
  it("écrit les montants courants", async () => {
    const { amountInWords } = await import("@/lib/contributions");
    expect(amountInWords(25000)).toBe("vingt-cinq mille");
    expect(amountInWords(1000)).toBe("mille");
    expect(amountInWords(71)).toBe("soixante et onze");
    expect(amountInWords(80)).toBe("quatre-vingts");
    expect(amountInWords(91)).toBe("quatre-vingt-onze");
    expect(amountInWords(200)).toBe("deux cents");
    expect(amountInWords(250)).toBe("deux cent cinquante");
    expect(amountInWords(200000)).toBe("deux cent mille");
    expect(amountInWords(80000)).toBe("quatre-vingt mille");
    expect(amountInWords(1500000)).toBe("un million cinq cent mille");
    expect(amountInWords(21)).toBe("vingt et un");
  });
});
