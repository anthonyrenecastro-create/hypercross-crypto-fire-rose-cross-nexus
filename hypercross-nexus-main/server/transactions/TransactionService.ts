/**
 * TransactionService
 *
 * Tracks the full lifecycle of real on-chain transactions (transfers, approvals, swaps).
 * A transaction may only become CONFIRMED after a real transaction receipt with a
 * successful status is observed via Chainstack — never from local state alone.
 */

import crypto from "crypto";
import { queries } from "../../src/db";
import { blockchainService } from "../blockchain/BlockchainService";

export type TransactionStatus =
  | "CREATED"
  | "AWAITING_SIGNATURE"
  | "SIGNED"
  | "SUBMITTED"
  | "PENDING"
  | "CONFIRMED"
  | "FAILED"
  | "REPLACED"
  | "CANCELLED";

export interface CreateTransactionInput {
  userId?: string | null;
  walletAddress: string;
  chainId: number;
  network: string;
  operationType: "native_transfer" | "erc20_transfer" | "approval" | "swap";
  contractAddress?: string | null;
  tokenAddress?: string | null;
  tokenSymbol?: string | null;
  amount?: string | null;
  value?: string | null;
  gasEstimate?: string | null;
}

function createTransaction(input: CreateTransactionInput): string {
  const id = crypto.randomUUID();
  queries.transactions.create.run(
    id,
    input.userId ?? null,
    input.walletAddress.toLowerCase(),
    input.chainId,
    input.network,
    input.operationType,
    input.contractAddress ?? null,
    input.tokenAddress ?? null,
    input.tokenSymbol ?? null,
    input.amount ?? null,
    input.value ?? null,
    input.gasEstimate ?? null
  );
  return id;
}

function markAwaitingSignature(id: string): void {
  queries.transactions.setStatus.run("AWAITING_SIGNATURE", id);
}

function markCancelled(id: string): void {
  queries.transactions.setStatus.run("CANCELLED", id);
}

function markWalletRejected(id: string): void {
  // Wallet rejection is a user decision, not a backend failure — CANCELLED, not FAILED.
  queries.transactions.setStatus.run("CANCELLED", id);
}

/**
 * Records the real transaction hash returned by the user's wallet after broadcast.
 * This is the ONLY way a transaction acquires a hash — never fabricated server-side.
 */
function recordSubmitted(id: string, transactionHash: string): void {
  const explorerUrl = blockchainService.getExplorerUrl(transactionHash);
  queries.transactions.setSubmitted.run(transactionHash, explorerUrl, id);
}

/**
 * Polls Chainstack for a receipt and updates status accordingly.
 * - No receipt yet -> PENDING
 * - Receipt with status !== 1 -> FAILED (reverted), never CONFIRMED
 * - Receipt with status === 1 -> CONFIRMED
 */
async function pollReceipt(id: string): Promise<TransactionStatus> {
  const record = queries.transactions.getById.get(id) as any;
  if (!record?.transactionHash) return (record?.status as TransactionStatus) ?? "CREATED";
  if (record.status === "CONFIRMED" || record.status === "FAILED") {
    return record.status as TransactionStatus;
  }

  try {
    const receipt = await blockchainService.getTransactionReceipt(record.transactionHash);
    if (!receipt) {
      if (record.status !== "PENDING") queries.transactions.setStatus.run("PENDING", id);
      return "PENDING";
    }

    const blockNumber = receipt.blockNumber != null ? Number(receipt.blockNumber) : null;
    const success = receipt.status === "0x1" || receipt.status === 1 || receipt.status === true;

    if (success) {
      queries.transactions.setConfirmed.run(blockNumber, id);
      return "CONFIRMED";
    }

    queries.transactions.setFailed.run(blockNumber, "Transaction reverted on-chain.", id);
    return "FAILED";
  } catch (error: any) {
    // RPC timeout/unavailable — leave as PENDING, do not fabricate a result.
    if (record.status !== "PENDING") queries.transactions.setStatus.run("PENDING", id);
    return "PENDING";
  }
}

/** Polls every SUBMITTED/PENDING transaction with a hash. Intended for a periodic background job. */
async function pollAllPending(): Promise<{ checked: number; confirmed: number; failed: number }> {
  const pending = queries.transactions.getPending.all() as any[];
  let confirmed = 0;
  let failed = 0;
  for (const tx of pending) {
    const status = await pollReceipt(tx.id);
    if (status === "CONFIRMED") confirmed++;
    if (status === "FAILED") failed++;
  }
  return { checked: pending.length, confirmed, failed };
}

function getById(id: string): any {
  return queries.transactions.getById.get(id);
}

function getByHash(transactionHash: string, chainId: number): any {
  return queries.transactions.getByHash.get(transactionHash, chainId);
}

function listByWallet(walletAddress: string, limit = 50): any[] {
  return queries.transactions.getByWallet.all(walletAddress.toLowerCase(), limit);
}

export const TransactionService = {
  createTransaction,
  markAwaitingSignature,
  markCancelled,
  markWalletRejected,
  recordSubmitted,
  pollReceipt,
  pollAllPending,
  getById,
  getByHash,
  listByWallet,
};

export default TransactionService;
