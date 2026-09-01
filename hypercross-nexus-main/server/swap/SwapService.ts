/**
 * SwapService
 *
 * Coordinates real swap quotes/approvals through a single SwapProvider (0x).
 * Enforces slippage bounds, quote expiration, and the mainnet write interlock.
 * Never executes a swap automatically after an approval — the caller must
 * explicitly request the swap transaction build as a separate step.
 */

import { isAddress } from "ethers";
import { blockchainService } from "../blockchain/BlockchainService";
import { ZeroExSwapProvider } from "./ZeroExSwapProvider";
import { TransactionService } from "../transactions/TransactionService";
import { QuoteExpiredError, InvalidAmountError, InvalidAddressError } from "../blockchain/errors";
import type { SwapQuote } from "./SwapProvider";

const MIN_SLIPPAGE_BPS = 1; // 0.01%
const MAX_SLIPPAGE_BPS = 2000; // 20% — anything above this is rejected outright
const HIGH_SLIPPAGE_WARNING_BPS = 300; // 3% — flagged as a warning to the caller

const activeQuotes = new Map<string, SwapQuote>();

function assertSlippageBounds(slippageBps: number): void {
  if (!Number.isFinite(slippageBps) || slippageBps < MIN_SLIPPAGE_BPS || slippageBps > MAX_SLIPPAGE_BPS) {
    throw new InvalidAmountError(
      `Slippage must be between ${MIN_SLIPPAGE_BPS / 100}% and ${MAX_SLIPPAGE_BPS / 100}%.`
    );
  }
}

async function requestQuote(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  takerAddress: string;
  slippageBps: number;
}): Promise<SwapQuote & { slippageWarning: boolean }> {
  if (!isAddress(params.takerAddress)) throw new InvalidAddressError("Invalid taker address.");
  assertSlippageBounds(params.slippageBps);

  const status = await blockchainService.getStatus();
  if (!status.connected || !status.chainId) {
    throw new Error("Chainstack RPC is not connected.");
  }

  const quote = await ZeroExSwapProvider.getQuote({
    chainId: status.chainId,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    takerAddress: params.takerAddress,
    slippageBps: params.slippageBps,
  });

  const quoteId = `${params.takerAddress}:${params.tokenIn}:${params.tokenOut}`.toLowerCase();
  activeQuotes.set(quoteId, quote);

  return { ...quote, slippageWarning: params.slippageBps >= HIGH_SLIPPAGE_WARNING_BPS };
}

function getActiveQuote(takerAddress: string, tokenIn: string, tokenOut: string): SwapQuote | null {
  const quoteId = `${takerAddress}:${tokenIn}:${tokenOut}`.toLowerCase();
  const quote = activeQuotes.get(quoteId);
  if (!quote) return null;
  if (new Date(quote.quoteExpiresAt).getTime() < Date.now()) {
    activeQuotes.delete(quoteId);
    return null;
  }
  return quote;
}

async function checkAllowance(tokenAddress: string, owner: string, spender: string) {
  return ZeroExSwapProvider.getAllowance({
    chainId: (await blockchainService.getStatus()).chainId ?? 0,
    tokenAddress,
    owner,
    spender,
  });
}

async function prepareApproval(userId: string | null, walletAddress: string, tokenAddress: string, spender: string) {
  blockchainService.assertMainnetWritesAllowed();
  const status = await blockchainService.getStatus();
  const tx = await ZeroExSwapProvider.buildApprovalTransaction({
    chainId: status.chainId ?? 0,
    tokenAddress,
    owner: walletAddress,
    spender,
  });

  const transactionId = TransactionService.createTransaction({
    userId,
    walletAddress,
    chainId: status.chainId ?? 0,
    network: status.network,
    operationType: "approval",
    contractAddress: tokenAddress,
    tokenAddress,
    gasEstimate: tx.gasEstimate,
  });

  return { transactionId, ...tx };
}

/**
 * Builds the real swap transaction from a previously-fetched, still-valid quote.
 * Throws QUOTE_EXPIRED if the quote is stale — never executes a stale route.
 */
async function prepareSwap(userId: string | null, walletAddress: string, tokenIn: string, tokenOut: string) {
  blockchainService.assertMainnetWritesAllowed();
  const quote = getActiveQuote(walletAddress, tokenIn, tokenOut);
  if (!quote) {
    throw new QuoteExpiredError();
  }

  const status = await blockchainService.getStatus();
  const transactionId = TransactionService.createTransaction({
    userId,
    walletAddress,
    chainId: status.chainId ?? 0,
    network: status.network,
    operationType: "swap",
    contractAddress: quote.to,
    amount: quote.amountIn,
    value: quote.value,
    gasEstimate: quote.estimatedGas,
  });

  return {
    transactionId,
    to: quote.to,
    data: quote.data,
    value: quote.value,
    gasEstimate: quote.estimatedGas,
  };
}

export const SwapService = {
  requestQuote,
  getActiveQuote,
  checkAllowance,
  prepareApproval,
  prepareSwap,
};

export default SwapService;
