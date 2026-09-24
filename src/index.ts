import {
  DUST,
  clamp,
  isFiniteNumber,
  isPositiveAmount,
  isValidPrice,
  weightedAvgCost,
} from "./math";
import type { Fill, Portfolio, Valuation } from "./types";

export type { Position, Portfolio, Fill, Valuation } from "./types";

/** Create an empty paper portfolio. Invalid start cash is clamped to 0. */
export function createPortfolio(startCashUsd: number): Portfolio {
  const cashUsd = isFiniteNumber(startCashUsd) && startCashUsd >= 0 ? startCashUsd : 0;
  return { cashUsd, realizedPnlUsd: 0, positions: {} };
}

/** Shallow-structural copy — new portfolio + new positions map (values are replaced, never mutated). */
function clonePortfolio(p: Portfolio): Portfolio {
  return { cashUsd: p.cashUsd, realizedPnlUsd: p.realizedPnlUsd, positions: { ...p.positions } };
}

function isoOf(now: Date | undefined): string {
  const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return d.toISOString();
}

/**
 * Buy `usdAmount` of a token at `priceUsd`.
 * Clamps the spend to available cash; no-ops (returns the portfolio unchanged
 * and `fill: null`) when cash, price or amount are invalid.
 */
export function buy(
  p: Portfolio,
  args: { mint: string; symbol: string; priceUsd: number; usdAmount: number; now?: Date },
): { portfolio: Portfolio; fill: Fill | null } {
  const { mint, symbol, priceUsd, usdAmount, now } = args;
  if (!mint || !isValidPrice(priceUsd) || !isPositiveAmount(usdAmount)) {
    return { portfolio: p, fill: null };
  }

  const spend = Math.min(usdAmount, p.cashUsd);
  if (!isPositiveAmount(spend)) {
    return { portfolio: p, fill: null };
  }
  const qty = spend / priceUsd;
  if (!isPositiveAmount(qty)) {
    return { portfolio: p, fill: null };
  }

  const existing = p.positions[mint];
  const finalSymbol = existing?.symbol || symbol;

  const next = clonePortfolio(p);
  next.positions[mint] = existing
    ? {
        mint,
        symbol: finalSymbol,
        qty: existing.qty + qty,
        avgCostUsd: weightedAvgCost(existing.qty, existing.avgCostUsd, qty, priceUsd),
      }
    : { mint, symbol: finalSymbol, qty, avgCostUsd: priceUsd };
  next.cashUsd = p.cashUsd - spend;

  const fill: Fill = {
    mint,
    symbol: finalSymbol,
    side: "BUY",
    usdAmount: spend,
    priceUsd,
    qty,
    realizedPnlUsd: 0,
    ts: isoOf(now),
  };
  return { portfolio: next, fill };
}

/**
 * Sell part or all of a holding. Provide exactly one of `qty`, `usdAmount`, or
 * `fraction` (0..1 of the position); precedence if several are passed is
 * qty > usdAmount > fraction. Clamps to current holdings; no-ops on invalid input.
 * Realizes `qty * (priceUsd - avgCostUsd)`; `avgCostUsd` is left unchanged.
 */
export function sell(
  p: Portfolio,
  args: { mint: string; priceUsd: number; usdAmount?: number; qty?: number; fraction?: number; now?: Date },
): { portfolio: Portfolio; fill: Fill | null } {
  const { mint, priceUsd, usdAmount, qty, fraction, now } = args;
  if (!mint || !isValidPrice(priceUsd)) {
    return { portfolio: p, fill: null };
  }

  const position = p.positions[mint];
  if (!position || !isPositiveAmount(position.qty)) {
    return { portfolio: p, fill: null };
  }

  let requestedQty: number;
  if (qty !== undefined) {
    if (!isPositiveAmount(qty)) return { portfolio: p, fill: null };
    requestedQty = qty;
  } else if (usdAmount !== undefined) {
    if (!isPositiveAmount(usdAmount)) return { portfolio: p, fill: null };
    requestedQty = usdAmount / priceUsd;
  } else if (fraction !== undefined) {
    if (!isFiniteNumber(fraction) || fraction <= 0) return { portfolio: p, fill: null };
    requestedQty = position.qty * clamp(fraction, 0, 1);
  } else {
    return { portfolio: p, fill: null };
  }

  const sellQty = Math.min(requestedQty, position.qty);
  if (!isPositiveAmount(sellQty)) {
    return { portfolio: p, fill: null };
  }

  const proceeds = sellQty * priceUsd;
  const realized = sellQty * (priceUsd - position.avgCostUsd);
  const remainingQty = position.qty - sellQty;

  const next = clonePortfolio(p);
  if (remainingQty <= DUST) {
    delete next.positions[mint];
  } else {
    next.positions[mint] = {
      mint: position.mint,
      symbol: position.symbol,
      qty: remainingQty,
      avgCostUsd: position.avgCostUsd,
    };
  }
  next.cashUsd = p.cashUsd + proceeds;
  next.realizedPnlUsd = p.realizedPnlUsd + realized;

  const fill: Fill = {
    mint,
    symbol: position.symbol,
    side: "SELL",
    usdAmount: proceeds,
    priceUsd,
    qty: sellQty,
    realizedPnlUsd: realized,
    ts: isoOf(now),
  };
  return { portfolio: next, fill };
}

/**
 * Mark the whole book to market. When a held mint has no valid price in
 * `priceByMint`, that position is marked at its cost basis (0 unrealized) rather
 * than fabricating a gain/loss. `totalPnlPct` is measured against `startCashUsd`.
 */
export function valuate(
  p: Portfolio,
  priceByMint: Record<string, number>,
  startCashUsd: number,
): Valuation {
  let positionsValueUsd = 0;
  let unrealizedPnlUsd = 0;

  for (const pos of Object.values(p.positions)) {
    const raw = priceByMint ? priceByMint[pos.mint] : undefined;
    const mark = isValidPrice(raw) ? raw : pos.avgCostUsd;
    positionsValueUsd += pos.qty * mark;
    unrealizedPnlUsd += pos.qty * (mark - pos.avgCostUsd);
  }

  const cashUsd = p.cashUsd;
  const equityUsd = cashUsd + positionsValueUsd;
  const realizedPnlUsd = p.realizedPnlUsd;
  const totalPnlUsd = realizedPnlUsd + unrealizedPnlUsd;
  const start = isFiniteNumber(startCashUsd) && startCashUsd > 0 ? startCashUsd : 0;
  const totalPnlPct = start > 0 ? (totalPnlUsd / start) * 100 : 0;

  return {
    cashUsd,
    positionsValueUsd,
    equityUsd,
    unrealizedPnlUsd,
    realizedPnlUsd,
    totalPnlUsd,
    totalPnlPct,
  };
}
