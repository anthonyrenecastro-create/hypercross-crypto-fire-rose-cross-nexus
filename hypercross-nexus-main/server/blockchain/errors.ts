export class BlockchainConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockchainConnectionError";
  }
}

export class BlockchainConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockchainConfigurationError";
  }
}

export class BlockchainRpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockchainRpcError";
  }
}

export class BlockchainSigningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockchainSigningError";
  }
}

export class BlockchainTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockchainTransactionError";
  }
}
