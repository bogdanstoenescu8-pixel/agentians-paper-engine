import { describe, expect, it } from "vitest";
import { buy, createPortfolio, sell } from "../src/index";
import type { Portfolio } from "../src/index";

const NOW = new Date("2026-02-01T00:00:00.000Z");

/** 1000 cash, then buy 200 @ 2 -> qty 100 @ avg 2, cash 800. */
function seeded(): Portfolio {
  return buy(createPortfolio(1000), { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount: 200, now: NOW }).portfolio;
}

describe("sell", () => {
  it("sells by qty, realizing PnL and crediting cash", () => {
    const { portfolio, fill } = sell(seeded(), { mint: "A", priceUsd: 3, qty: 40, now: NOW });

    expect(fill!.side).toBe("SELL");
    expect(fill!.qty).toBe(40);
    expect(fill!.realizedPnlUsd).toBe(40); // 40 * (3 - 2)
    expect(fill!.usdAmount).toBe(120);
    expect(portfolio.cashUsd).toBe(920); // 800 + 120
    expect(portfolio.realizedPnlUsd).toBe(40);
    expect(portfolio.positions["A"]!.qty).toBe(60);
    expect(portfolio.positions["A"]!.avgCostUsd).toBe(2); // unchanged by a sell
  });

  it("sells by usdAmount", () => {
    const { portfolio, fill } = sell(seeded(), { mint: "A", priceUsd: 3, usdAmount: 60, now: NOW });
    expect(fill!.qty).toBe(20); // 60 / 3
    expect(fill!.realizedPnlUsd).toBe(20);
    expect(portfolio.positions["A"]!.qty).toBe(80);
  });

  it("sells by fraction of the position", () => {
    const { portfolio, fill } = sell(seeded(), { mint: "A", priceUsd: 3, fraction: 0.5, now: NOW });
    expect(fill!.qty).toBe(50);
    expect(portfolio.positions["A"]!.qty).toBe(50);
  });

  it("clamps an over-sell to holdings and removes the emptied position", () => {
    const { portfolio, fill } = sell(seeded(), { mint: "A", priceUsd: 3, qty: 500, now: NOW });
    expect(fill!.qty).toBe(100); // clamped to the held 100
    expect(fill!.realizedPnlUsd).toBe(100);
    expect(portfolio.positions["A"]).toBeUndefined();
    expect(portfolio.cashUsd).toBe(1100); // 800 + 300
  });

  it("fraction = 1 fully closes the position", () => {
    const { portfolio } = sell(seeded(), { mint: "A", priceUsd: 3, fraction: 1, now: NOW });
    expect(portfolio.positions["A"]).toBeUndefined();
  });

  it("realizes a loss when price < avg cost", () => {
    const { portfolio, fill } = sell(seeded(), { mint: "A", priceUsd: 1, qty: 50, now: NOW });
    expect(fill!.realizedPnlUsd).toBe(-50); // 50 * (1 - 2)
    expect(portfolio.realizedPnlUsd).toBe(-50);
  });

  it("no-ops on an invalid price", () => {
    const p = seeded();
    const r = sell(p, { mint: "A", priceUsd: 0, qty: 10, now: NOW });
    expect(r.fill).toBeNull();
    expect(r.portfolio).toBe(p);
  });

  it("no-ops when the position does not exist", () => {
    const p = seeded();
    const r = sell(p, { mint: "ZZZ", priceUsd: 3, qty: 10, now: NOW });
    expect(r.fill).toBeNull();
    expect(r.portfolio).toBe(p);
  });

  it("no-ops when no qty / usdAmount / fraction is provided", () => {
    const p = seeded();
    const r = sell(p, { mint: "A", priceUsd: 3, now: NOW });
    expect(r.fill).toBeNull();
    expect(r.portfolio).toBe(p);
  });
});
