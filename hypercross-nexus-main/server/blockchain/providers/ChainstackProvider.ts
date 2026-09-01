import { Contract, JsonRpcProvider, Wallet, WebSocketProvider } from "ethers";
import {
  BlockchainConfigurationError,
  BlockchainConnectionError,
  BlockchainRpcError,
  BlockchainSigningError,
  BlockchainTransactionError,
} from "../errors";
import type {
  BlockchainProvider,
  BlockchainQueryRequest,
  BlockchainTransactionRequest,
  ChainstackConfig,
  ProviderConnectionStatus,
} from "../types";

export class ChainstackProvider implements BlockchainProvider {
  private provider: JsonRpcProvider;
  private wallet?: Wallet;
  private status: ProviderConnectionStatus;
  private readonly rpcTimeoutMs: number;
  // Optional subscription transport. HTTPS is always the primary transport;
  // a WSS failure here must never affect HTTPS RPC operations.
  private wsProvider?: WebSocketProvider;
  private wsError: string | null = null;

  constructor(private readonly config: ChainstackConfig) {
    const rpcUrl = config.rpcUrl?.trim();
    if (!rpcUrl) {
      throw new BlockchainConfigurationError("CHAINSTACK_RPC_URL is required.");
    }

    this.rpcTimeoutMs = Number(config.rpcTimeoutMs) > 0 ? Number(config.rpcTimeoutMs) : 15000;
    this.provider = new JsonRpcProvider(rpcUrl, undefined, { staticNetwork: false });

    // Server-side signing is disabled by default even if CHAINSTACK_PRIVATE_KEY is
    // set. Normal user operations (transfers, approvals, swaps) are always signed
    // by the connected wallet client-side; this is only for optional automation.
    const serverSignerEnabled = ["true", "1"].includes((process.env.ENABLE_SERVER_SIGNER || "false").trim().toLowerCase());
    this.wallet = serverSignerEnabled && config.privateKey ? new Wallet(config.privateKey, this.provider) : undefined;
    this.status = {
      provider: "chainstack",
      connected: false,
      network: config.name || config.id || "chainstack",
      chainId: Number(config.chainId) || undefined,
      rpcHealthy: false,
      live: false,
      source: "chainstack",
      error: null,
      lastChecked: null,
    };

    const websocketUrl = config.websocketUrl?.trim();
    if (websocketUrl) {
      try {
        this.wsProvider = new WebSocketProvider(websocketUrl);
      } catch (error) {
        this.wsProvider = undefined;
        this.wsError = error instanceof Error ? error.message : "Unable to initialize Chainstack WebSocket provider.";
      }
    }
  }

  /**
   * Reserved for future subscription/event functionality (e.g. newHeads, pending tx feeds).
   * Not required for initial Chainstack connectivity — HTTPS remains the primary transport.
   */
  getWebSocketStatus(): { configured: boolean; connected: boolean; error: string | null } {
    return {
      configured: Boolean(this.config.websocketUrl?.trim()),
      connected: Boolean(this.wsProvider),
      error: this.wsError,
    };
  }

  /**
   * Races a Chainstack RPC call against a timeout. Never exposes the endpoint URL.
   */
  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new BlockchainRpcError("Chainstack RPC timed out"));
      }, this.rpcTimeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  async connect(): Promise<ProviderConnectionStatus> {
    try {
      const network = await this.withTimeout(this.provider.getNetwork());
      const chainId = Number(network.chainId);
      const configuredChainId = Number(this.config.chainId || chainId);

      if (configuredChainId && chainId !== configuredChainId) {
        throw new BlockchainConfigurationError(
          `Configured chain ID ${configuredChainId} does not match Chainstack RPC endpoint chain ID ${chainId}.`
        );
      }

      const blockNumber = await this.getBlockNumber();
      const nextStatus: ProviderConnectionStatus = {
        provider: "chainstack",
        connected: true,
        network: this.config.name || network.name || "chainstack",
        chainId,
        blockNumber,
        rpcHealthy: true,
        live: true,
        source: "chainstack",
        error: null,
        lastChecked: new Date().toISOString(),
      };
      this.status = nextStatus;
      return nextStatus;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : "Unable to connect to Chainstack RPC.";
      const nextStatus: ProviderConnectionStatus = {
        provider: "chainstack",
        connected: false,
        network: this.config.name || this.config.id || "chainstack",
        chainId: Number(this.config.chainId) || undefined,
        rpcHealthy: false,
        live: false,
        source: "chainstack",
        error: message,
        lastChecked: new Date().toISOString(),
      };
      this.status = nextStatus;
      throw new BlockchainConnectionError(message);
    }
  }

  async disconnect(): Promise<void> {
    if (this.wsProvider) {
      try {
        await this.wsProvider.destroy();
      } catch {
        // Non-fatal: WSS is not the primary transport.
      }
      this.wsProvider = undefined;
    }
    this.status = {
      ...this.status,
      connected: false,
      rpcHealthy: false,
      live: false,
      lastChecked: new Date().toISOString(),
      error: "Disconnected from Chainstack.",
    };
  }

  async getStatus(): Promise<ProviderConnectionStatus> {
    try {
      const network = await this.withTimeout(this.provider.getNetwork());
      const blockNumber = await this.getBlockNumber();
      const nextStatus: ProviderConnectionStatus = {
        provider: "chainstack",
        connected: true,
        network: this.config.name || network.name || "chainstack",
        chainId: Number(network.chainId),
        blockNumber,
        rpcHealthy: true,
        live: true,
        source: "chainstack",
        error: null,
        lastChecked: new Date().toISOString(),
      };
      this.status = nextStatus;
      return nextStatus;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : "Chainstack RPC unavailable.";
      const fallback: ProviderConnectionStatus = {
        ...this.status,
        connected: false,
        rpcHealthy: false,
        live: false,
        error: message,
        lastChecked: new Date().toISOString(),
      };
      this.status = fallback;
      return fallback;
    }
  }

  /**
   * Health requires BOTH eth_chainId (via getNetwork) and eth_blockNumber to succeed.
   * A provider that responds to only one of these is not considered healthy.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await Promise.all([
        this.withTimeout(this.provider.getNetwork()),
        this.withTimeout(this.provider.getBlockNumber()),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async getBlockNumber(): Promise<number> {
    try {
      return Number(await this.withTimeout(this.provider.getBlockNumber()));
    } catch (error) {
      throw new BlockchainRpcError(error instanceof Error ? error.message : "Unable to read block number.");
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      const value = await this.provider.getBalance(address);
      return value.toString();
    } catch (error) {
      throw new BlockchainRpcError(error instanceof Error ? error.message : `Unable to fetch balance for ${address}.`);
    }
  }

  async getTransaction(txHash: string): Promise<any> {
    try {
      return await this.provider.getTransaction(txHash);
    } catch (error) {
      throw new BlockchainRpcError(error instanceof Error ? error.message : `Unable to fetch transaction ${txHash}.`);
    }
  }

  async estimateGas(request: { from?: string; to: string; data?: string; value?: string }): Promise<string> {
    try {
      const gas = await this.withTimeout(
        this.provider.estimateGas({
          from: request.from,
          to: request.to,
          data: request.data,
          value: request.value ? BigInt(request.value) : undefined,
        })
      );
      return gas.toString();
    } catch (error) {
      throw new BlockchainRpcError(error instanceof Error ? error.message : "Unable to estimate gas.");
    }
  }

  async getFeeData(): Promise<{ gasPrice: string | null; maxFeePerGas: string | null; maxPriorityFeePerGas: string | null }> {
    try {
      const fee = await this.withTimeout(this.provider.getFeeData());
      return {
        gasPrice: fee.gasPrice != null ? fee.gasPrice.toString() : null,
        maxFeePerGas: fee.maxFeePerGas != null ? fee.maxFeePerGas.toString() : null,
        maxPriorityFeePerGas: fee.maxPriorityFeePerGas != null ? fee.maxPriorityFeePerGas.toString() : null,
      };
    } catch (error) {
      throw new BlockchainRpcError(error instanceof Error ? error.message : "Unable to fetch fee data.");
    }
  }

  async query(request: BlockchainQueryRequest): Promise<any> {
    if (request.rawRpcMethod) {
      return this.provider.send(request.rawRpcMethod, request.rawRpcParams ?? []);
    }

    if (request.contractAddress && request.abi && request.method) {
      const contract = new Contract(request.contractAddress, request.abi, this.provider);
      const fn = contract[request.method as keyof typeof contract] as (...args: any[]) => Promise<any>;
      if (typeof fn !== "function") {
        throw new BlockchainRpcError(`Contract method ${request.method} is not available.`);
      }
      return fn(...(request.args ?? []));
    }

    throw new BlockchainConfigurationError("Either rawRpcMethod or contractAddress + method + abi are required.");
  }

  async submitTransaction(request: BlockchainTransactionRequest): Promise<any> {
    if (!this.wallet) {
      throw new BlockchainSigningError("No private key configured for server-side signing. Use a user wallet for transaction signing.");
    }

    if (request.data) {
      const tx = {
        to: request.contractAddress,
        data: request.data,
        value: request.value ? BigInt(request.value) : undefined,
        gasLimit: request.gasLimit ? BigInt(request.gasLimit) : undefined,
      };
      return this.wallet.sendTransaction(tx);
    }

    if (request.contractAddress && request.abi && request.method) {
      const contract = new Contract(request.contractAddress, request.abi, this.wallet);
      const fn = contract[request.method as keyof typeof contract] as (...args: any[]) => Promise<any>;
      if (typeof fn !== "function") {
        throw new BlockchainTransactionError(`Contract method ${request.method} is not available for execution.`);
      }
      return fn(...(request.args ?? []), {
        value: request.value ? BigInt(request.value) : undefined,
        gasLimit: request.gasLimit ? BigInt(request.gasLimit) : undefined,
      });
    }

    throw new BlockchainTransactionError("Contract address + method or transaction data is required for submission.");
  }
}
