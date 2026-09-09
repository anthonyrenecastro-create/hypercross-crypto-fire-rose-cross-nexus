import crypto from "node:crypto";
import type { ExecutionEligibility, ExecutionProfile, RiskDecision } from "../../packages/shared/types";
import { evaluateExecutionEligibility, type EligibilityInput } from "../trading/ExecutionEligibilityService";

export interface MarketContext {
  symbol: string;
  timestamp: string;
  price: number;
  volume24h: number | null;
  liquidity: number | null;
  volatility24h: number | null;
  portfolioExposureUsd: number;
  dataSources: string[];
  freshnessMs: number;
  quality: "HIGH" | "MEDIUM" | "LOW";
  warnings: string[];
}

export interface MarketAnalysis {
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  momentum: number;
  volatility: number;
  liquidity: number;
  marketRegime: "TRENDING" | "RANGING" | "UNKNOWN";
  observations: string[];
  riskFactors: string[];
  dataConfidence: number;
  action: "BUY" | "SELL" | "NO_ACTION";
}

export interface OpportunityScore {
  opportunityScore: number;
  confidenceScore: number;
  riskScore: number;
  liquidityScore: number;
  executionScore: number;
  signalAgreementScore: number;
  expectedUpsideEstimate: number | null;
  expectedDownsideEstimate: number | null;
  riskRewardEstimate: number | null;
  confidenceBand: "LOW" | "MEDIUM" | "HIGH";
  factors: string[];
}

export interface NexusStrategyProposal {
  strategyProposalId: string;
  asset: string;
  action: "BUY" | "SELL" | "NO_ACTION";
  rationale: string[];
  marketContext: MarketContext;
  analysis: MarketAnalysis;
  scores: OpportunityScore;
  suggestedPositionSize: number;
  maximumPositionSize: number;
  invalidationConditions: string[];
  riskFactors: string[];
  executionConstraints: { profile: ExecutionProfile; expiresAt: string };
  createdAt: string;
  expiresAt: string;
  immutable: true;
}

export interface NexusDecision {
  stages: ["THINK", "ANALYZE", "SCORE", "ROUTE", "PREPARE", "AUTHORIZE", "EXECUTE", "VERIFY"];
  context: MarketContext;
  analysis: MarketAnalysis;
  scores: OpportunityScore;
  proposal: NexusStrategyProposal;
  risk: RiskDecision;
  eligibility: ExecutionEligibility;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
const idFor = (value: string) => crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);

export function think(input: Omit<MarketContext, "quality" | "warnings">): MarketContext {
  const warnings = [
    ...(input.freshnessMs > 5 * 60 * 1000 ? ["Market data is stale."] : []),
    ...(input.dataSources.length === 0 ? ["No market data provenance is available."] : []),
    ...(input.price <= 0 ? ["Price must be greater than zero."] : []),
  ];
  return { ...input, quality: warnings.length === 0 ? "HIGH" : warnings.length === 1 ? "MEDIUM" : "LOW", warnings };
}

export function analyze(context: MarketContext): MarketAnalysis {
  const trend = context.price <= 0 ? "NEUTRAL" : (context.volatility24h ?? 0) > 70 ? "NEUTRAL" : context.volume24h !== null && context.volume24h > 0 ? "BULLISH" : "NEUTRAL";
  const momentum = trend === "BULLISH" ? 65 : 35;
  const volatility = clamp(context.volatility24h ?? 80);
  const liquidity = context.liquidity === null ? 0 : clamp(Math.min(context.liquidity / 1000000, 100));
  const riskFactors = [...context.warnings, ...(volatility >= 70 ? ["Volatility is elevated."] : []), ...(liquidity < 30 ? ["Liquidity is limited."] : [])];
  return {
    trend,
    momentum,
    volatility,
    liquidity,
    marketRegime: trend === "NEUTRAL" ? "UNKNOWN" : "TRENDING",
    observations: [`Trend is ${trend.toLowerCase()}.`, `Data quality is ${context.quality.toLowerCase()}.`],
    riskFactors,
    dataConfidence: clamp(100 - context.warnings.length * 30),
    action: context.warnings.length > 0 || trend === "NEUTRAL" ? "NO_ACTION" : "BUY",
  };
}

export function score(context: MarketContext, analysis: MarketAnalysis): OpportunityScore {
  const riskScore = clamp((analysis.volatility + (100 - analysis.liquidity) + (100 - analysis.dataConfidence)) / 3);
  const opportunityScore = clamp((analysis.momentum + analysis.liquidity + analysis.dataConfidence) / 3);
  const confidenceScore = clamp(analysis.dataConfidence * 0.7 + analysis.liquidity * 0.3);
  const executionScore = clamp(analysis.liquidity - riskScore * 0.25);
  return {
    opportunityScore,
    confidenceScore,
    riskScore,
    liquidityScore: analysis.liquidity,
    executionScore,
    signalAgreementScore: analysis.action === "NO_ACTION" ? 0 : 75,
    expectedUpsideEstimate: analysis.action === "NO_ACTION" ? null : Math.max(0, context.volatility24h ?? 0),
    expectedDownsideEstimate: analysis.action === "NO_ACTION" ? null : riskScore,
    riskRewardEstimate: analysis.action === "NO_ACTION" || riskScore === 0 ? null : opportunityScore / riskScore,
    confidenceBand: confidenceScore >= 75 ? "HIGH" : confidenceScore >= 50 ? "MEDIUM" : "LOW",
    factors: ["data confidence", "liquidity", "volatility", "execution quality"],
  };
}

export function propose(context: MarketContext, analysis: MarketAnalysis, scores: OpportunityScore, profile: ExecutionProfile = "STANDARD"): NexusStrategyProposal {
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  return {
    strategyProposalId: idFor(`${context.symbol}:${context.timestamp}:${profile}`),
    asset: context.symbol,
    action: analysis.action,
    rationale: analysis.observations,
    marketContext: context,
    analysis,
    scores,
    suggestedPositionSize: 0,
    maximumPositionSize: 0,
    invalidationConditions: ["Quote expires.", "Risk policy changes.", "Market data becomes stale."],
    riskFactors: analysis.riskFactors,
    executionConstraints: { profile, expiresAt },
    createdAt,
    expiresAt,
    immutable: true,
  };
}

export function decide(input: Omit<MarketContext, "quality" | "warnings"> & Omit<EligibilityInput, "riskScore">): NexusDecision {
  const context = think(input);
  const analysis = analyze(context);
  const scores = score(context, analysis);
  const eligibility = evaluateExecutionEligibility({ ...input, riskScore: scores.riskScore, quoteFresh: input.quoteFresh && context.warnings.length === 0 });
  const risk = eligibility.standardEligible ? evaluateExecutionEligibility({ ...input, riskScore: scores.riskScore }).standardEligible
    ? { allowed: true, riskScore: scores.riskScore, warnings: [], blockers: [], positionLimitUsd: 10000, dailyLimitUsd: 25000, requiredApproval: "USER" as const }
    : { allowed: false, riskScore: scores.riskScore, warnings: [], blockers: ["Standard policy rejected the opportunity."], positionLimitUsd: 10000, dailyLimitUsd: 25000, requiredApproval: "USER" as const }
    : { allowed: false, riskScore: scores.riskScore, warnings: [], blockers: ["Standard policy rejected the opportunity."], positionLimitUsd: 10000, dailyLimitUsd: 25000, requiredApproval: "USER" as const };
  return { stages: ["THINK", "ANALYZE", "SCORE", "ROUTE", "PREPARE", "AUTHORIZE", "EXECUTE", "VERIFY"], context, analysis, scores, proposal: propose(context, analysis, scores), risk, eligibility };
}