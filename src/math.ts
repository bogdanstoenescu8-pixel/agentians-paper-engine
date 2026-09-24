/**
 * Internal math helpers for the paper-trading engine.
 *
 * Everything here is pure and defensive: no globals, no randomness, no mutation.
 */

/** Positions whose quantity falls to this or below are treated as fully closed. */
export const DUST = 1e-9;

export function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** A usable market price: finite and strictly positive. */
export function isValidPrice(p: unknown): p is number {
  return isFiniteNumber(p) && p > 0;
}

/** A usable notional / quantity: finite and strictly positive. */
export function isPositiveAmount(n: unknown): n is number {
  return isFiniteNumber(n) && n > 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Weighted-average cost basis after adding `addQty` units bought at `addCost`
 * to an existing holding of `existingQty` units at `existingCost`.
 */
export function weightedAvgCost(
  existingQty: number,
  existingCost: number,
  addQty: number,
  addCost: number,
): number {
  const totalQty = existingQty + addQty;
  if (totalQty <= 0) return 0;
  return (existingQty * existingCost + addQty * addCost) / totalQty;
}
