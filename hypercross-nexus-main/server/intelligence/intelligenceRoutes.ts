import { Router } from "express";
import { requireEntitlement, requireProductionAuth, type ProductionAuthedRequest } from "../auth/productionMiddleware";
import { getDb } from "../db/postgres";
import { intelligenceSnapshots } from "../../database/schema";
import { analyzeMarket, proposeStrategy, toExecutionIntent, type MarketSnapshot } from "./IntelligenceEngine";
import { decide, type MarketContext } from "./NexusDecisionPipeline";
import { listAssets } from "../blockchain/AssetRegistry";

export const intelligenceRouter = Router();
const protectIntelligence = [requireProductionAuth, requireEntitlement("advanced_strategies")];

function snapshotFromRequest(req: ProductionAuthedRequest): MarketSnapshot {
  const input = req.body ?? {};
  return {
    symbol: String(input.symbol ?? req.params.symbol ?? "").toUpperCase(),
    timestamp: String(input.timestamp ?? new Date().toISOString()),
    price: Number(input.price ?? 0),
    change24h: Number(input.change24h ?? 0),
    volume24h: input.volume24h === undefined ? undefined : Number(input.volume24h),
    liquidity: input.liquidity === undefined ? undefined : Number(input.liquidity),
    volatility24h: input.volatility24h === undefined ? undefined : Number(input.volatility24h),
    dataSources: Array.isArray(input.dataSources) ? input.dataSources.map(String) : [],
    freshnessMs: Number(input.freshnessMs ?? Number.POSITIVE_INFINITY),
  };
}

intelligenceRouter.post("/analyze", ...protectIntelligence, async (req: ProductionAuthedRequest, res) => {
  const snapshot = snapshotFromRequest(req);
  if (!snapshot.symbol) return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "symbol is required." } });
  const analysis = analyzeMarket(snapshot);
  const proposal = proposeStrategy(analysis.opportunity);
  await getDb().insert(intelligenceSnapshots).values({ userId: req.authUser!.id, symbol: snapshot.symbol, snapshot, signals: analysis.signals, opportunity: analysis.opportunity, proposal });
  return res.json({ ok: true, snapshot, ...analysis, proposal });
});

intelligenceRouter.get("/market/:symbol", ...protectIntelligence, (req: ProductionAuthedRequest, res) => {
  return res.status(501).json({ error: { code: "MARKET_DATA_NOT_CONFIGURED", message: "No live market provider is configured." }, symbol: req.params.symbol.toUpperCase() });
});

intelligenceRouter.get("/signals/:symbol", ...protectIntelligence, (_req, res) => res.status(501).json({ error: { code: "MARKET_DATA_NOT_CONFIGURED", message: "No live market provider is configured." } }));
intelligenceRouter.get("/opportunities", ...protectIntelligence, (_req, res) => res.json({ ok: true, opportunities: [] }));
intelligenceRouter.get("/risk/:symbol", ...protectIntelligence, (_req, res) => res.status(501).json({ error: { code: "MARKET_DATA_NOT_CONFIGURED", message: "No live market provider is configured." } }));

// The decision pipeline is deliberately separate from transaction submission.
// It produces a reviewable proposal and eligibility result; the connected wallet
// remains the authorization boundary for STANDARD and ADVANCED execution.
intelligenceRouter.post("/pipeline/decide", ...protectIntelligence, (req: ProductionAuthedRequest, res) => {
  const input = req.body ?? {};
  const context: Omit<MarketContext, "quality" | "warnings"> = {
    symbol: String(input.symbol ?? "").toUpperCase(),
    timestamp: String(input.timestamp ?? new Date().toISOString()),
    price: Number(input.price ?? 0),
    volume24h: input.volume24h === undefined ? null : Number(input.volume24h),
    liquidity: input.liquidity === undefined ? null : Number(input.liquidity),
    volatility24h: input.volatility24h === undefined ? null : Number(input.volatility24h),
    portfolioExposureUsd: Number(input.portfolioExposureUsd ?? 0),
    dataSources: Array.isArray(input.dataSources) ? input.dataSources.map(String) : [],
    freshnessMs: Number(input.freshnessMs ?? Number.POSITIVE_INFINITY),
  };
  if (!context.symbol) return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "symbol is required." } });
  return res.json({ ok: true, ...decide({
    ...context,
    notionalUsd: Number(input.notionalUsd ?? 0),
    dailyExposureUsd: Number(input.dailyExposureUsd ?? 0),
    quoteFresh: input.quoteFresh !== false,
    networkHealthy: input.networkHealthy !== false,
    emergencyStop: input.emergencyStop === true,
    xeroConnected: input.xeroConnected === true,
    xeroAcknowledged: input.xeroAcknowledged === true,
  }) });
});

intelligenceRouter.get("/execution-profiles", ...protectIntelligence, (_req, res) => res.json({
  ok: true,
  profiles: {
    STANDARD: { execution: "connected-wallet", manualApproval: true, xeroRequired: false },
    ADVANCED: { execution: "connected-wallet", manualApproval: true, xeroRequired: false },
    XERO: { execution: "optional-xero-adapter", manualApproval: true, xeroRequired: true, optInRequired: true },
  },
}));

intelligenceRouter.get("/assets", ...protectIntelligence, (_req, res) => res.json({ ok: true, assets: listAssets() }));

intelligenceRouter.post("/proposals", ...protectIntelligence, async (req: ProductionAuthedRequest, res) => {
  const analysis = analyzeMarket(snapshotFromRequest(req));
  const proposal = proposeStrategy(analysis.opportunity);
  await getDb().insert(intelligenceSnapshots).values({ userId: req.authUser!.id, symbol: analysis.opportunity.asset, snapshot: snapshotFromRequest(req), signals: analysis.signals, opportunity: analysis.opportunity, proposal });
  return res.json({ ok: true, proposal, executionIntent: toExecutionIntent(proposal, String(req.body?.network ?? "unknown")) });
});