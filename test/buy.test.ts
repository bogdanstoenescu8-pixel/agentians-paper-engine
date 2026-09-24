import { describe, expect, it } from "vitest";
import { buy, createPortfolio } from "../src/index";

const NOW = new Date("2026-02-01T00:00:00.000Z");

describe("buy", () => {
  it("opens a new position and debits cash", () => {
    const p0 = createPortfolio(1000);
    const { portfolio, fill } = buy(p0, { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount: 200, now: NOW });

    expect(portfolio.cashUsd).toBe(800);
    const pos = portfolio.positions["A"]!;
    expect(pos.qty).toBe(100);
    expect(pos.avgCostUsd).toBe(2);
    expect(pos.symbol).toBe("AAA");

    expect(fill).not.toBeNull();
    expect(fill!.side).toBe("BUY");
    expect(fill!.usdAmount).toBe(200);
    expect(fill!.qty).toBe(100);
    expect(fill!.realizedPnlUsd).toBe(0);
    expect(fill!.ts).toBe("2026-02-01T00:00:00.000Z");
  });

  it("computes a weighted-average cost basis across buys", () => {
    let p = createPortfolio(1000);
    p = buy(p, { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount: 100, now: NOW }).portfolio; // 50 @ 2
    p = buy(p, { mint: "A", symbol: "AAA", priceUsd: 4, usdAmount: 100, now: NOW }).portfolio; // 25 @ 4

    const pos = p.positions["A"]!;
    expect(pos.qty).toBe(75);
    expect(pos.avgCostUsd).toBeCloseTo(200 / 75, 10); // (50*2 + 25*4) / 75
    expect(p.cashUsd).toBe(800);
  });

  it("clamps an over-spend to available cash", () => {
    const p0 = createPortfolio(50);
    const { portfolio, fill } = buy(p0, { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount: 100, now: NOW });

    expect(portfolio.cashUsd).toBe(0);
    expect(portfolio.positions["A"]!.qty).toBe(25); // 50 / 2
    expect(fill!.usdAmount).toBe(50);
    expect(fill!.qty).toBe(25);
  });

  it("no-ops on an invalid price", () => {
    const p0 = createPortfolio(1000);
    for (const priceUsd of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = buy(p0, { mint: "A", symbol: "AAA", priceUsd, usdAmount: 100, now: NOW });
      expect(r.fill).toBeNull();
      expect(r.portfolio).toBe(p0);
    }
  });

  it("no-ops on an invalid amount", () => {
    const p0 = createPortfolio(1000);
    for (const usdAmount of [0, -5, Number.NaN]) {
      const r = buy(p0, { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount, now: NOW });
      expect(r.fill).toBeNull();
      expect(r.portfolio).toBe(p0);
    }
  });

  it("no-ops when there is no cash", () => {
    const p0 = createPortfolio(0);
    const r = buy(p0, { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount: 100, now: NOW });
    expect(r.fill).toBeNull();
    expect(r.portfolio).toBe(p0);
  });
});
