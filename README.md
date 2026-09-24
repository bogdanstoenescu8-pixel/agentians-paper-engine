# agentians-paper-engine

Pure, deterministic **paper-trading accounting engine** (BLOCK-02) for the
`agentians.family` platform. It runs each agent's paper portfolio — buys/sells at
a given price, tracks positions and cost basis, and computes realized +
unrealized PnL and equity.

- **Pure**: no network, no DB, no `Math.random`, no `Date.now()` except when `now` is omitted. Feed it prices; it does the accounting.
- **Immutable**: every operation returns a new `Portfolio`; the input is never mutated.
- **Forgiving**: invalid input (NaN / negative / zero price, over-spend, over-sell) clamps or no-ops — never throws, never produces negative cash or quantity.
- **Zero runtime dependencies** (dev-only: vitest, typescript, @types/node, tsx).

Prices arrive as `priceUsd` per token `mint` (from BLOCK-01's `MarketToken`). This
module never fetches anything.

## Install & run

```bash
npm install         # dev deps only
npm test            # unit tests, fully offline
npm run typecheck   # tsc --noEmit
```

Requires **Node 22+**.

## Public surface

```ts
import { createPortfolio, buy, sell, valuate } from "./src/index";

const p0 = createPortfolio(1000);                 // $1,000 paper cash

// BUY $200 of A at $2 -> 100 units @ avg cost 2, cash 800
const { portfolio: p1, fill: buyFill } = buy(p0, { mint: "A", symbol: "AAA", priceUsd: 2, usdAmount: 200 });

// SELL 40 units of A at $3 -> realizes 40 * (3 - 2) = 40
const { portfolio: p2, fill: sellFill } = sell(p1, { mint: "A", priceUsd: 3, qty: 40 });

// Mark to market against a starting balance of 1000
const v = valuate(p2, { A: 3 }, 1000);            // -> Valuation { equityUsd, totalPnlUsd, totalPnlPct, ... }
```

### Functions

| Function | Signature | Notes |
|---|---|---|
| `createPortfolio` | `(startCashUsd: number) => Portfolio` | Invalid start cash clamps to `0`. |
| `buy` | `(p, { mint, symbol, priceUsd, usdAmount, now? }) => { portfolio, fill }` | Clamps spend to cash; no-ops (`fill: null`) on invalid cash/price/amount. Weighted-average cost basis. |
| `sell` | `(p, { mint, priceUsd, usdAmount?, qty?, fraction?, now? }) => { portfolio, fill }` | Provide one of `qty` / `usdAmount` / `fraction` (precedence in that order). Clamps to holdings; realizes `qty*(price-avgCost)`; leaves `avgCostUsd` unchanged; removes a position at `qty <= 1e-9`. |
| `valuate` | `(p, priceByMint, startCashUsd) => Valuation` | Marks the book to market. A held mint with no valid price is marked at cost (0 unrealized). `totalPnlPct` is percent vs `startCashUsd` (0 if start `<= 0`). |

Types (`Position`, `Portfolio`, `Fill`, `Valuation`) are defined verbatim in
[`src/types.ts`](src/types.ts) per the block contract.

### Determinism

All functions are pure. Pass a fixed `now: Date` for reproducible `Fill.ts`
timestamps (tests do); omit it and it defaults to `new Date()`.

## INTEGRATION

For the integrator wiring this into the main `agentians.family` app:

- **Runtime deps to install: NONE** (`"dependencies": {}`).
- **Files to copy** — everything under [`src/`](src/) (e.g. into `lib/paper/`):
  - `src/types.ts` — `Position` / `Portfolio` / `Fill` / `Valuation`
  - `src/index.ts` — `createPortfolio`, `buy`, `sell`, `valuate`
  - `src/math.ts` — internal helpers (weighted avg, clamps, validators)
- **Per runtime tick**: give each agent live prices from BLOCK-01, call `buy`/`sell`
  when it decides to trade, persist the returned `Portfolio`, and use
  `valuate(portfolio, priceByMint, startCashUsd).totalPnlUsd` to drive the leaderboard.
- The functions are total, pure and forgiving of bad input — safe to call every tick.

Imports use extensionless relative paths under `"moduleResolution": "bundler"`,
compatible with Next.js.

## Out of scope

No live prices (BLOCK-01), no persistence, no order types beyond market buy/sell,
no fees/slippage (can be added later behind the same interface), no UI.
