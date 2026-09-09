import type { ExecutionEligibility, ExecutionProfile } from "../../packages/shared/types";
import { evaluateRisk, type RiskInput } from "./RiskEngine";

export interface EligibilityInput extends Omit<RiskInput, "profile"> {
  xeroConnected?: boolean;
  xeroAcknowledged?: boolean;
}

export function evaluateExecutionEligibility(input: EligibilityInput): ExecutionEligibility {
  const decisions = (['STANDARD', 'ADVANCED', 'XERO'] as ExecutionProfile[]).map((profile) => ({
    profile,
    decision: evaluateRisk({ ...input, profile }),
  }));
  const standard = decisions.find((item) => item.profile === "STANDARD")!;
  const advanced = decisions.find((item) => item.profile === "ADVANCED")!;
  const xero = decisions.find((item) => item.profile === "XERO")!;
  const reasons = decisions.flatMap(({ profile, decision }) => decision.allowed ? [`${profile} policy allows review.`] : decision.blockers.map((reason) => `${profile}: ${reason}`));
  const blockingConditions = [
    ...new Set(decisions.flatMap(({ decision }) => decision.blockers)),
    ...(!input.xeroConnected ? ["Xero is not connected."] : []),
    ...(!input.xeroAcknowledged ? ["Xero risk acknowledgement is required."] : []),
  ];

  return {
    standardEligible: standard.decision.allowed,
    advancedEligible: advanced.decision.allowed,
    xeroEligible: xero.decision.allowed && Boolean(input.xeroConnected && input.xeroAcknowledged),
    reasons,
    blockingConditions,
  };
}