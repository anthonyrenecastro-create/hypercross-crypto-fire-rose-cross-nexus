export type ChainFamily = "EVM" | "SOLANA";
export type AssetClass = "NATIVE" | "CRYPTOCURRENCY" | "STABLECOIN" | "TOKENIZED_COMMODITY" | "RWA" | "LP_TOKEN";

export interface AssetDefinition {
  assetId: string;
  symbol: string;
  name: string;
  chainFamily: ChainFamily;
  chainId: number | string;
  address: string | null;
  decimals: number;
  assetClass: AssetClass;
  underlying?: string;
  issuer?: string;
  enabled: boolean;
  executionSupport: "SUPPORTED" | "READ_ONLY" | "UNAVAILABLE";
}

const assets: AssetDefinition[] = [
  { assetId: "evm:8453:native:eth", symbol: "ETH", name: "Ether", chainFamily: "EVM", chainId: 8453, address: null, decimals: 18, assetClass: "NATIVE", enabled: true, executionSupport: "SUPPORTED" },
  { assetId: "evm:8453:token:usdc", symbol: "USDC", name: "USD Coin", chainFamily: "EVM", chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, assetClass: "STABLECOIN", enabled: true, executionSupport: "SUPPORTED" },
  { assetId: "evm:8453:token:paxg", symbol: "PAXG", name: "PAX Gold", chainFamily: "EVM", chainId: 8453, address: null, decimals: 18, assetClass: "TOKENIZED_COMMODITY", underlying: "GOLD", enabled: true, executionSupport: "READ_ONLY" },
];

export function getAsset(assetId: string): AssetDefinition | null {
  return assets.find((asset) => asset.assetId === assetId) ?? null;
}

export function listAssets(): AssetDefinition[] {
  return assets.map((asset) => ({ ...asset }));
}

export function isExecutionSupported(assetId: string): boolean {
  return getAsset(assetId)?.executionSupport === "SUPPORTED";
}