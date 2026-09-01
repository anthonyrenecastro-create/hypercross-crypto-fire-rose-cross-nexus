import { Contract, JsonRpcProvider, Wallet } from "ethers";
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

  constructor(private readonly config: ChainstackConfig) {
    const rpcUrl = config.rpcUrl?.trim();
    if (!rpcUrl) {
      throw new BlockchainConfigurationError("CHAINSTACK_RPC_URL is required.");
    }

    this.provider = new JsonRpcProvider(rpcUrl, undefined, { staticNetwork: false });
    this.wallet = config.privateKey ? new Wallet(config.privateKey, this.provider) : undefined;
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
  }

  async connect(): Promise<ProviderConnectionStatus> {
    try {
      const network = await this.provider.getNetwork();
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
      const network = await this.provider.getNetwork();
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

  async healthCheck(): Promise<boolean> {
    try {
      await this.provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  async getBlockNumber(): Promise<number> {
    try {
      return Number(await this.provider.getBlockNumber());
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
