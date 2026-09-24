export interface Position {
  mint: string;
  symbol: string;
  qty: number;            // token units held (>= 0)
  avgCostUsd: number;     // average cost basis per unit
}

export interface Portfolio {
  cashUsd: number;        // uninvested paper cash
  realizedPnlUsd: number; // cumulative realized PnL
  positions: Record<string, Position>; // keyed by mint
}

export interface Fill {
  mint: string;
  symbol: string;
  side: "BUY" | "SELL";
  usdAmount: number;      // notional filled
  priceUsd: number;
  qty: number;            // units bought/sold
  realizedPnlUsd: number; // 0 for BUY; realized portion for SELL
  ts: string;             // ISO
}

export interface Valuation {
  cashUsd: number;
  positionsValueUsd: number;
  equityUsd: number;          // cash + positions value
  unrealizedPnlUsd: number;
  realizedPnlUsd: number;
  totalPnlUsd: number;        // realized + unrealized
  totalPnlPct: number;        // vs a provided starting balance
}
