import { describe, expect, it } from "vitest";
import { buy, createPortfolio, sell, valuate } from "../src/index";
import type { Portfolio } from "../src/index";

const NOW = new Date("2026-02-01T00:00:00.000Z");

/** 1000 cash -> buy 200@2 (A: 100@2, cash 800) -> buy 300@3 (B: 100@3, cash 500). */
function mixedBook(): Portfolio {
  let p = createPortfolio(1000);
  p = buy(p, { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount: 200, now: NOW }).portfolio;
  p = buy(p, { mint: "B", symbol: "BBB", priceUsd: 3, usdAmount: 300, now: NOW }).portfolio;
  return p;
}

describe("valuate", () => {
  it("computes equity, unrealized, total and pct for a mixed book", () => {
    const v = valuate(mixedBook(), { A: 4, B: 2 }, 1000);
    expect(v.cashUsd).toBe(500);
    expect(v.positionsValueUsd).toBe(600); // 100*4 + 100*2
    expect(v.equityUsd).toBe(1100);
    expect(v.unrealizedPnlUsd).toBe(100); // 100*(4-2) + 100*(2-3)
    expect(v.realizedPnlUsd).toBe(0);
    expect(v.totalPnlUsd).toBe(100);
    expect(v.totalPnlPct).toBeCloseTo(10, 10); // 100 / 1000 * 100
  });

  it("marks a mint with no price at cost basis (0 unrealized for it)", () => {
    const v = valuate(mixedBook(), { A: 4 }, 1000); // B price missing
    expect(v.positionsValueUsd).toBe(700); // 100*4 + 100*3 (B at cost)
    expect(v.unrealizedPnlUsd).toBe(200); // 100*(4-2) + 0
    expect(v.equityUsd).toBe(1200);
  });

  it("includes realized PnL from prior sells in the total", () => {
    let p = mixedBook();
    p = sell(p, { mint: "A", priceUsd: 5, qty: 50, now: NOW }).portfolio; // realize 50*(5-2)=150, cash +250
    const v = valuate(p, { A: 5, B: 3 }, 1000);
    expect(v.realizedPnlUsd).toBe(150);
    expect(v.unrealizedPnlUsd).toBe(150); // A: 50*(5-2)=150 ; B: 100*(3-3)=0
    expect(v.totalPnlUsd).toBe(300);
    expect(v.equityUsd).toBe(1300); // cash 750 + A 250 + B 300
  });

  it("values an empty portfolio as just cash", () => {
    const v = valuate(createPortfolio(1000), {}, 1000);
    expect(v.positionsValueUsd).toBe(0);
    expect(v.equityUsd).toBe(1000);
    expect(v.unrealizedPnlUsd).toBe(0);
    expect(v.totalPnlUsd).toBe(0);
    expect(v.totalPnlPct).toBe(0);
  });

  it("guards pct against a zero / invalid start balance", () => {
    const v = valuate(mixedBook(), { A: 4, B: 2 }, 0);
    expect(v.totalPnlPct).toBe(0);
  });
});
