import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, polygon, arbitrum, base } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Hyper-Cross Nexus",
  // Set VITE_WC_PROJECT_ID in your environment for full WalletConnect v2 support.
  // Without it, injected wallets (MetaMask, Coinbase Wallet) still work.
  // Must be a valid 32-character hex UUID to prevent initial startup crash in RainbowKit/Wagmi.
  projectId: import.meta.env.VITE_WC_PROJECT_ID ?? "3fcc6b16d1b67f50df40a113b183713a",
  chains: [mainnet, polygon, arbitrum, base],
  ssr: false,
});
