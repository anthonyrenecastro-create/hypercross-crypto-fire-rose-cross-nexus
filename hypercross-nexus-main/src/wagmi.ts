import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, polygon, arbitrum, base } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Hyper-Cross Nexus",
  // Set VITE_WC_PROJECT_ID in your environment for full WalletConnect v2 support.
  // Without it, injected wallets (MetaMask, Coinbase Wallet) still work.
  projectId: import.meta.env.VITE_WC_PROJECT_ID ?? "hypercross-nexus-demo",
  chains: [mainnet, polygon, arbitrum, base],
  ssr: false,
});
