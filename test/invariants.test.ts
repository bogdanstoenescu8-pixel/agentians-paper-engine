import { describe, expect, it } from "vitest";
import { buy, createPortfolio, sell } from "../src/index";

const NOW = new Date("2026-02-01T00:00:00.000Z");

describe("invariants", () => {
  it("buy does not mutate the input portfolio", () => {
    const p0 = createPortfolio(1000);
    const snapshot = JSON.stringify(p0);

    const { portfolio: p1 } = buy(p0, { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount: 200, now: NOW });

    expect(JSON.stringify(p0)).toBe(snapshot); // input untouched
    expect(p1).not.toBe(p0);
    expect(p1.positions).not.toBe(p0.positions);
  });

  it("sell does not mutate the input portfolio or its position objects", () => {
    const p1 = buy(createPortfolio(1000), { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount: 200, now: NOW }).portfolio;
    const snapshot = JSON.stringify(p1);

    const { portfolio: p2 } = sell(p1, { mint: "A", priceUsd: 3, qty: 40, now: NOW });

    expect(JSON.stringify(p1)).toBe(snapshot);
    expect(p2.positions["A"]).not.toBe(p1.positions["A"]);
    expect(p1.positions["A"]!.qty).toBe(100); // original still full
  });

  it("never produces negative cash (over-spend clamps to 0)", () => {
    const p = buy(createPortfolio(50), { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount: 999, now: NOW }).portfolio;
    expect(p.cashUsd).toBe(0);
    expect(p.cashUsd).toBeGreaterThanOrEqual(0);
  });

  it("never produces negative qty (over-sell clamps to holdings)", () => {
    let p = buy(createPortfolio(1000), { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount: 200, now: NOW }).portfolio;
    p = sell(p, { mint: "A", priceUsd: 3, qty: 1e9, now: NOW }).portfolio;
    expect(p.positions["A"]).toBeUndefined(); // fully closed, never negative
  });

  it("invalid ops return the same reference and a null fill", () => {
    const p0 = createPortfolio(1000);

    const b = buy(p0, { mint: "A", symbol: "AAA", priceUsd: -1, usdAmount: 100, now: NOW });
    expect(b.portfolio).toBe(p0);
    expect(b.fill).toBeNull();

    const s = sell(p0, { mint: "A", priceUsd: 3, qty: 10, now: NOW }); // no such position
    expect(s.portfolio).toBe(p0);
    expect(s.fill).toBeNull();
  });
});
