/**
 * TransferService
 *
 * Prepares (never signs) native and ERC-20 transfers. The connected wallet signs
 * and broadcasts client-side (via wagmi); this service only validates inputs,
 * estimates gas, enforces the mainnet write interlock, and persists a
 * TransactionService record that is later updated with the real hash/receipt.
 */

import { isAddress, formatUnits } from "ethers";
import { blockchainService } from "../blockchain/BlockchainService";
import { getTokenConfig } from "../blockchain/TokenRegistry";
import { ERC20_ABI } from "../blockchain/ERC20_ABI";
import { encodeErc20Transfer, toBaseUnits } from "../blockchain/TxBuilder";
import { TransactionService } from "../transactions/TransactionService";
import {
  InvalidAddressError,
  InvalidAmountError,
  InsufficientFundsError,
  InsufficientTokenBalanceError,
  TokenNotRegisteredError,
} from "../blockchain/errors";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function assertValidRecipient(to: string): void {
  if (!isAddress(to)) throw new InvalidAddressError(`"${to}" is not a valid address.`);
  if (to.toLowerCase() === ZERO_ADDRESS) throw new InvalidAddressError("Cannot send to the zero address.");
}

function assertPositiveAmount(amount: string): void {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new InvalidAmountError(`Amount must be a positive number. Got: "${amount}".`);
  }
}

export interface PreparedTransfer {
  transactionId: string;
  chainId: number;
  to: string;
  data?: string;
  value: string;
  gasEstimate: string;
  explorerUrlBase: string | null;
}

async function prepareNativeTransfer(
  userId: string | null,
  walletAddress: string,
  to: string,
  amountEth: string
): Promise<PreparedTransfer> {
  blockchainService.assertMainnetWritesAllowed();
  assertValidRecipient(to);
  assertPositiveAmount(amountEth);

  const status = await blockchainService.getStatus();
  if (!status.connected || !status.chainId) {
    throw new Error("Chainstack RPC is not connected.");
  }

  const valueWei = BigInt(Math.round(Number(amountEth) * 1e18)).toString();
  const balanceWei = BigInt(await blockchainService.getBalance(walletAddress));
  if (balanceWei < BigInt(valueWei)) {
    throw new InsufficientFundsError(
      `Balance ${formatUnits(balanceWei, 18)} ETH is insufficient for transfer of ${amountEth} ETH.`
    );
  }

  const gasEstimate = await blockchainService.estimateGas({ from: walletAddress, to, value: valueWei });

  const transactionId = TransactionService.createTransaction({
    userId,
    walletAddress,
    chainId: status.chainId,
    network: status.network,
    operationType: "native_transfer",
    amount: amountEth,
    value: valueWei,
    gasEstimate,
  });

  return {
    transactionId,
    chainId: status.chainId,
    to,
    value: valueWei,
    gasEstimate,
    explorerUrlBase: blockchainService.getNetworkInfo()?.explorerUrl ?? null,
  };
}

async function prepareErc20Transfer(
  userId: string | null,
  walletAddress: string,
  tokenSymbol: string,
  to: string,
  amountHuman: string
): Promise<PreparedTransfer> {
  blockchainService.assertMainnetWritesAllowed();
  assertValidRecipient(to);
  assertPositiveAmount(amountHuman);

  const status = await blockchainService.getStatus();
  if (!status.connected || !status.chainId) {
    throw new Error("Chainstack RPC is not connected.");
  }

  const token = getTokenConfig(tokenSymbol.toUpperCase(), status.chainId);
  if (!token) {
    throw new TokenNotRegisteredError(`Token ${tokenSymbol} is not registered on chain ${status.chainId}.`);
  }

  const amountBaseUnits = toBaseUnits(amountHuman, token.decimals);
  const balance: bigint = await blockchainService.readContract(token.address, ERC20_ABI, "balanceOf", [walletAddress]);
  if (balance < amountBaseUnits) {
    throw new InsufficientTokenBalanceError(
      `${token.symbol} balance ${formatUnits(balance, token.decimals)} is insufficient for transfer of ${amountHuman}.`
    );
  }

  const data = encodeErc20Transfer(to, amountBaseUnits);
  const gasEstimate = await blockchainService.estimateGas({ from: walletAddress, to: token.address, data });

  const transactionId = TransactionService.createTransaction({
    userId,
    walletAddress,
    chainId: status.chainId,
    network: status.network,
    operationType: "erc20_transfer",
    contractAddress: token.address,
    tokenAddress: token.address,
    tokenSymbol: token.symbol,
    amount: amountHuman,
    value: "0",
    gasEstimate,
  });

  return {
    transactionId,
    chainId: status.chainId,
    to: token.address,
    data,
    value: "0",
    gasEstimate,
    explorerUrlBase: blockchainService.getNetworkInfo()?.explorerUrl ?? null,
  };
}

export const TransferService = {
  prepareNativeTransfer,
  prepareErc20Transfer,
};

export default TransferService;
