import test from "node:test";
import assert from "node:assert/strict";
import { decide, think } from "../server/intelligence/NexusDecisionPipeline";
import { evaluateExecutionEligibility } from "../server/trading/ExecutionEligibilityService";
import { getExecutionAdapter } from "../server/trading/ExecutionAdapters";
import { getAsset, isExecutionSupported } from "../server/blockchain/AssetRegistry";

const baseInput = {
  symbol: "ETH",
  timestamp: "2026-09-05T00:00:00.000Z",
  price: 2500,
  volume24h: 100000000,
  liquidity: 50000000,
  volatility24h: 20,
  portfolioExposureUsd: 0,
  dataSources: ["test-provider"],
  freshnessMs: 1000,
  notionalUsd: 250,
  dailyExposureUsd: 0,
  quoteFresh: true,
  networkHealthy: true,
  xeroConnected: false,
  xeroAcknowledged: false,
};

test("standard Nexus decision pipeline does not require Xero", () => {
  const result = decide(baseInput);
  assert.deepEqual(result.stages, ["THINK", "ANALYZE", "SCORE", "ROUTE", "PREPARE", "AUTHORIZE", "EXECUTE", "VERIFY"]);
  assert.equal(result.eligibility.standardEligible, true);
  assert.equal(result.eligibility.xeroEligible, false);
  assert.equal(result.risk.requiredApproval, "USER");
});

test("stale market context is marked low quality and cannot be standard eligible", () => {
  const context = think({ ...baseInput, freshnessMs: 10 * 60 * 1000 });
  assert.equal(context.quality, "MEDIUM");
  assert.ok(context.warnings.some((warning) => /stale/i.test(warning)));
  const result = decide({ ...baseInput, freshnessMs: 10 * 60 * 1000 });
  assert.equal(result.eligibility.standardEligible, false);
});

test("Xero eligibility requires connection and explicit acknowledgement", () => {
  const input = { ...baseInput, riskScore: 60 };
  assert.equal(evaluateExecutionEligibility(input).xeroEligible, false);
  assert.equal(evaluateExecutionEligibility({ ...input, xeroConnected: true, xeroAcknowledged: true }).xeroEligible, true);
});

test("standard execution uses an external wallet and Xero is optional", () => {
  assert.equal(getExecutionAdapter("STANDARD").requiresExternalWallet, true);
  assert.equal(getExecutionAdapter("STANDARD").available, true);
  assert.equal(getExecutionAdapter("XERO").available, false);
});

test("asset registry keeps tokenized gold distinct from executable assets", () => {
  assert.equal(getAsset("evm:8453:token:paxg")?.assetClass, "TOKENIZED_COMMODITY");
  assert.equal(isExecutionSupported("evm:8453:token:paxg"), false);
});