import { ChainstackProvider } from "./providers/ChainstackProvider";
import { BlockchainConfigurationError } from "./errors";
import type { BlockchainNetworkConfig, BlockchainProvider, ChainstackConfig } from "./types";

const DEFAULT_NETWORKS: BlockchainNetworkConfig[] = [
  { id: "ethereum", name: "Ethereum", chainId: 1, rpcUrl: "https://rpc.ankr.com/eth", nativeCurrency: "ETH" },
  { id: "polygon", name: "Polygon", chainId: 137, rpcUrl: "https://rpc.ankr.com/polygon", nativeCurrency: "POL" },
  { id: "arbitrum", name: "Arbitrum", chainId: 42161, rpcUrl: "https://rpc.ankr.com/arbitrum", nativeCurrency: "ETH" },
  { id: "optimism", name: "Optimism", chainId: 10, rpcUrl: "https://rpc.ankr.com/optimism", nativeCurrency: "ETH" },
  { id: "base", name: "Base", chainId: 8453, rpcUrl: "https://mainnet.base.org", nativeCurrency: "ETH" },
  { id: "bnb", name: "BNB Chain", chainId: 56, rpcUrl: "https://bsc-dataseed.bnbchain.org", nativeCurrency: "BNB" },
  { id: "avalanche", name: "Avalanche", chainId: 43114, rpcUrl: "https://api.avax.network/ext/bc/C/rpc", nativeCurrency: "AVAX" },
];

export class BlockchainProviderFactory {
  static getSupportedNetworks(): BlockchainNetworkConfig[] {
    return DEFAULT_NETWORKS;
  }

  static createFromEnvironment(env: NodeJS.ProcessEnv = process.env): BlockchainProvider {
    const providerName = (env.BLOCKCHAIN_PROVIDER || "chainstack").toLowerCase();

    if (providerName !== "chainstack") {
      throw new BlockchainConfigurationError(`Unsupported BLOCKCHAIN_PROVIDER value: ${providerName}. Only "chainstack" is supported.`);
    }

    const networkName = (env.CHAINSTACK_NETWORK || "ethereum").toLowerCase();
    const configuredNetwork = DEFAULT_NETWORKS.find((network) => network.id === networkName);
    const rpcUrl = env.CHAINSTACK_RPC_URL || configuredNetwork?.rpcUrl;
    const chainId = Number(env.CHAINSTACK_CHAIN_ID || configuredNetwork?.chainId || 1);

    if (!rpcUrl) {
      throw new BlockchainConfigurationError("CHAINSTACK_RPC_URL must be configured for the Chainstack provider.");
    }

    const chainstackConfig: ChainstackConfig = {
      provider: "chainstack",
      id: networkName,
      name: configuredNetwork?.name || networkName,
      chainId,
      rpcUrl,
      websocketUrl: env.CHAINSTACK_WSS_URL,
      explorerUrl: env.CHAINSTACK_EXPLORER_URL,
      nativeCurrency: env.CHAINSTACK_NATIVE_CURRENCY || configuredNetwork?.nativeCurrency || "ETH",
      apiKey: env.CHAINSTACK_API_KEY,
      projectId: env.CHAINSTACK_PROJECT_ID,
      nodeId: env.CHAINSTACK_NODE_ID,
      privateKey: env.CHAINSTACK_PRIVATE_KEY,
      walletAddress: env.CHAINSTACK_WALLET_ADDRESS,
      rpcTimeoutMs: Number(env.CHAINSTACK_RPC_TIMEOUT_MS || 15000),
    };

    return new ChainstackProvider(chainstackConfig);
  }
}
