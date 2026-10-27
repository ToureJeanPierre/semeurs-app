/**
 * Nombre de jours avant le prochain anniversaire (0 = aujourd'hui).
 * Dates « AAAA-MM-JJ » ; les personnes nées un 29 février le fêtent le 28 les années non bissextiles.
 */
export function daysUntilBirthday(birthDate: string, today: string): number {
  const [, m, d] = birthDate.split("-").map(Number);
  const [y, tm, td] = today.split("-").map(Number);
  const start = Date.UTC(y, tm - 1, td);
  const on = (year: number) => {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return Date.UTC(year, m - 1, m === 2 && d === 29 && !leap ? 28 : d);
  };
  const next = on(y) >= start ? on(y) : on(y + 1);
  return Math.round((next - start) / 86_400_000);
}
