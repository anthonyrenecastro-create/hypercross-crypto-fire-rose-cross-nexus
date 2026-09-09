import type { ExecutionProfile, PreparedTransaction } from "../../packages/shared/types";

export interface ExecutionAdapter {
  readonly profile: ExecutionProfile;
  readonly requiresExternalWallet: boolean;
  readonly available: boolean;
  prepare(transaction: PreparedTransaction): Promise<PreparedTransaction>;
}

/** STANDARD and ADVANCED never receive private keys; the browser wallet signs. */
export const standardWalletExecutionAdapter: ExecutionAdapter = {
  profile: "STANDARD",
  requiresExternalWallet: true,
  available: true,
  async prepare(transaction) { return transaction; },
};

export const advancedWalletExecutionAdapter: ExecutionAdapter = {
  ...standardWalletExecutionAdapter,
  profile: "ADVANCED",
};

/** Xero is intentionally unavailable until an authenticated adapter is connected. */
export const xeroExecutionAdapter: ExecutionAdapter = {
  profile: "XERO",
  requiresExternalWallet: false,
  available: false,
  async prepare() {
    throw new Error("Xero execution adapter is not connected.");
  },
};

export function getExecutionAdapter(profile: ExecutionProfile): ExecutionAdapter {
  if (profile === "ADVANCED") return advancedWalletExecutionAdapter;
  if (profile === "XERO") return xeroExecutionAdapter;
  return standardWalletExecutionAdapter;
}