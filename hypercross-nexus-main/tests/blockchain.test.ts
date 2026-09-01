import test from "node:test";
import assert from "node:assert/strict";
import { isAddress } from "ethers";
import { validateTokenRegistry, getTokenConfig, getAllTokens } from "../server/blockchain/TokenRegistry";
import { BlockchainProviderFactory } from "../server/blockchain/BlockchainProviderFactory";
import { BlockchainConfigurationError } from "../server/blockchain/errors";

// ── Structural tests (no network required) ──────────────────────────────────

test("token registry: every configured token address is valid", () => {
  assert.doesNotThrow(() => validateTokenRegistry(isAddress));
});

test("token registry: at least one token is registered per supported testnet chain", () => {
  assert.ok(getTokenConfig("USDC", 11155111), "Ethereum Sepolia USDC missing");
  assert.ok(getTokenConfig("USDC", 84532), "Base Sepolia USDC missing");
  assert.ok(getAllTokens().length > 0);
});

test("BlockchainProviderFactory: throws CHAINSTACK_CONFIGURATION_ERROR when CHAINSTACK_RPC_URL is missing", () => {
  assert.throws(
    () => BlockchainProviderFactory.createFromEnvironment({ BLOCKCHAIN_PROVIDER: "chainstack" } as any),
    BlockchainConfigurationError
  );
});

test("BlockchainProviderFactory: never falls back to a public RPC when CHAINSTACK_RPC_URL is absent", () => {
  // Even with a recognized network name configured, no rpcUrl should be synthesized.
  try {
    BlockchainProviderFactory.createFromEnvironment({
      BLOCKCHAIN_PROVIDER: "chainstack",
      CHAINSTACK_NETWORK: "base",
      CHAINSTACK_CHAIN_ID: "8453",
    } as any);
    assert.fail("Expected CHAINSTACK_CONFIGURATION_ERROR");
  } catch (error: any) {
    assert.equal(error.code, "CHAINSTACK_CONFIGURATION_ERROR");
    assert.doesNotMatch(error.message, /mainnet\.base\.org|ankr|infura|alchemy/i);
  }
});

// ── Real integration tests ───────────────────────────────────────────────────
// Only run when integration-test environment variables are present. No private
// credentials are hardcoded — set these in your own environment to exercise them.
const hasIntegrationEnv = Boolean(process.env.CHAINSTACK_RPC_URL && process.env.CHAINSTACK_CHAIN_ID);

test(
  "Chainstack integration: eth_chainId and eth_blockNumber succeed against the configured RPC",
  { skip: !hasIntegrationEnv && "Set CHAINSTACK_RPC_URL and CHAINSTACK_CHAIN_ID to run this test" },
  async () => {
    const { blockchainService } = await import("../server/blockchain/BlockchainService");
    await blockchainService.initialize();
    const healthy = await blockchainService.healthCheck();
    assert.equal(healthy, true, "Chainstack RPC must respond to both eth_chainId and eth_blockNumber");
    const blockNumber = await blockchainService.getBlockNumber();
    assert.ok(blockNumber > 0);
  }
);

test(
  "Chainstack integration: ERC-20 symbol()/decimals() resolve for a registered token",
  { skip: !hasIntegrationEnv && "Set CHAINSTACK_RPC_URL and CHAINSTACK_CHAIN_ID to run this test" },
  async () => {
    const { blockchainService } = await import("../server/blockchain/BlockchainService");
    const { ERC20_ABI } = await import("../server/blockchain/ERC20_ABI");
    await blockchainService.initialize();
    const status = await blockchainService.getStatus();
    const token = getTokenConfig("USDC", status.chainId ?? 0);
    if (!token) return; // No USDC registered for this chain — nothing to verify.
    const symbol = await blockchainService.readContract(token.address, ERC20_ABI, "symbol", []);
    const decimals = await blockchainService.readContract(token.address, ERC20_ABI, "decimals", []);
    assert.equal(symbol, token.symbol);
    assert.equal(Number(decimals), token.decimals);
  }
);
