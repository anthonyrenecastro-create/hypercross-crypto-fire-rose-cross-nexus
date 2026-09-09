import type { ExecutionProfile, RiskDecision } from "../../packages/shared/types";

export interface RiskInput {
  profile: ExecutionProfile;
  riskScore: number;
  notionalUsd: number;
  dailyExposureUsd: number;
  maxTradeUsd?: number;
  maxDailyExposureUsd?: number;
  maxRiskScore?: number;
  quoteFresh: boolean;
  networkHealthy: boolean;
  emergencyStop?: boolean;
}

const limits: Record<ExecutionProfile, { maxRiskScore: number; maxTradeUsd: number; maxDailyExposureUsd: number }> = {
  STANDARD: { maxRiskScore: 45, maxTradeUsd: 10000, maxDailyExposureUsd: 25000 },
  ADVANCED: { maxRiskScore: 70, maxTradeUsd: 50000, maxDailyExposureUsd: 100000 },
  XERO: { maxRiskScore: 85, maxTradeUsd: 25000, maxDailyExposureUsd: 75000 },
};

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 100));

export function evaluateRisk(input: RiskInput): RiskDecision {
  const defaults = limits[input.profile];
  const maxRiskScore = input.maxRiskScore ?? defaults.maxRiskScore;
  const maxTradeUsd = input.maxTradeUsd ?? defaults.maxTradeUsd;
  const maxDailyExposureUsd = input.maxDailyExposureUsd ?? defaults.maxDailyExposureUsd;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.emergencyStop) blockers.push("Emergency stop is active.");
  if (!input.networkHealthy) blockers.push("Network health is not sufficient for execution.");
  if (!input.quoteFresh) blockers.push("Quote is expired or unavailable.");
  if (input.riskScore > maxRiskScore) blockers.push(`Risk score exceeds the ${input.profile} ceiling.`);
  if (input.notionalUsd > maxTradeUsd) blockers.push("Trade notional exceeds the configured trade limit.");
  if (input.dailyExposureUsd + input.notionalUsd > maxDailyExposureUsd) blockers.push("Daily exposure limit would be exceeded.");
  if (input.profile === "XERO") warnings.push("XERO uses a higher-risk, higher-variance execution profile and remains opt-in.");
  if (input.riskScore >= maxRiskScore * 0.8) warnings.push("Risk is near the selected profile ceiling.");

  return {
    allowed: blockers.length === 0,
    riskScore: clamp(input.riskScore),
    warnings,
    blockers,
    positionLimitUsd: maxTradeUsd,
    dailyLimitUsd: maxDailyExposureUsd,
    requiredApproval: input.profile === "XERO" ? "XERO" : "USER",
  };
}

export { limits as executionProfileLimits };