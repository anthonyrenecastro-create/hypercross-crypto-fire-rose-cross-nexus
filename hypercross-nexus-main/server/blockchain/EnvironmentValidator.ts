/**
 * EnvironmentValidator
 *
 * Validates blockchain environment configuration on startup.
 * Fails fast with clear error messages if required configuration is missing.
 */

export interface EnvironmentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class EnvironmentValidator {
  static validate(env: NodeJS.ProcessEnv = process.env): EnvironmentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ─── REQUIRED: Provider Selection ───────────────────────────────────────
    const provider = (env.BLOCKCHAIN_PROVIDER || "chainstack").toLowerCase();
    if (provider !== "chainstack") {
      errors.push(
        `BLOCKCHAIN_PROVIDER must be "chainstack". Got: "${provider}"`
      );
    }

    // ─── REQUIRED: Chainstack RPC Configuration ─────────────────────────────
    const rpcUrl = env.CHAINSTACK_RPC_URL?.trim();
    if (!rpcUrl) {
      errors.push(
        `CHAINSTACK_RPC_URL is required when BLOCKCHAIN_PROVIDER=chainstack. ` +
        `Set this to your Chainstack RPC endpoint (e.g., https://...chainstack.com/...)`
      );
    }

    const chainIdStr = env.CHAINSTACK_CHAIN_ID?.trim();
    if (!chainIdStr) {
      errors.push(
        `CHAINSTACK_CHAIN_ID is required. Specify the target network ID (e.g., 1 for Ethereum, 11155111 for Sepolia)`
      );
    } else if (!/^\d+$/.test(chainIdStr)) {
      errors.push(`CHAINSTACK_CHAIN_ID must be a numeric chain ID. Got: "${chainIdStr}"`);
    }

    const network = env.CHAINSTACK_NETWORK?.trim();
    if (!network) {
      warnings.push(`CHAINSTACK_NETWORK not specified. Defaulting to "ethereum".`);
    }

    // ─── OPTIONAL: Server-Side Signer (Should Be Disabled for MVP) ──────────
    if (env.CHAINSTACK_PRIVATE_KEY?.trim()) {
      warnings.push(
        `CHAINSTACK_PRIVATE_KEY is set. For MVP, user wallet signing is recommended. ` +
        `Server-side signing should only be used for automation, not normal transactions.`
      );
    }

    // ─── OPTIONAL: Mode Selection ────────────────────────────────────────────
    const appMode = env.APP_DATA_MODE?.trim();
    if (appMode && !["live", "demo", "test"].includes(appMode)) {
      warnings.push(
        `APP_DATA_MODE value "${appMode}" is not recognized. Use: live, demo, or test.`
      );
    }

    const liveStrict = env.LIVE_FEED_STRICT?.trim();
    if (liveStrict && !["true", "false", "1", "0"].includes(liveStrict.toLowerCase())) {
      warnings.push(
        `LIVE_FEED_STRICT value "${liveStrict}" is not recognized. Use: true, false, 1, or 0.`
      );
    }

    // ─── Compile Result ────────────────────────────────────────────────────
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static throwIfInvalid(env: NodeJS.ProcessEnv = process.env): void {
    const result = this.validate(env);
    if (!result.valid) {
      const errorMessage =
        `Environment validation failed:\n\n` +
        result.errors.map((e) => `  • ${e}`).join("\n") +
        `\n\n` +
        `See .env.example for configuration template.`;
      throw new Error(errorMessage);
    }
    if (result.warnings.length > 0) {
      console.warn(
        `Environment warnings:\n` +
        result.warnings.map((w) => `  ⚠ ${w}`).join("\n")
      );
    }
  }

  /**
   * Extracts only the hostname from a URL for safe logging.
   * Chainstack endpoints may embed access tokens/credentials in the path or query string,
   * so the full URL must never be logged — only the hostname (or "configured"/"not set").
   */
  private static safeHost(url: string | undefined): string {
    if (!url?.trim()) return "not set";
    try {
      return new URL(url).hostname || "configured";
    } catch {
      return "configured";
    }
  }

  static logStartupInfo(env: NodeJS.ProcessEnv = process.env): void {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`  BLOCKCHAIN CONFIGURATION`);
    console.log(`${"─".repeat(70)}`);
    console.log(`  Provider: ${env.BLOCKCHAIN_PROVIDER || "chainstack"}`);
    console.log(`  Network: ${env.CHAINSTACK_NETWORK || "ethereum"}`);
    console.log(`  Chain ID: ${env.CHAINSTACK_CHAIN_ID || "1"}`);
    console.log(`  RPC URL: ${env.CHAINSTACK_RPC_URL ? `configured (${this.safeHost(env.CHAINSTACK_RPC_URL)})` : "not set"}`);
    console.log(`  WSS URL: ${env.CHAINSTACK_WSS_URL ? `configured (${this.safeHost(env.CHAINSTACK_WSS_URL)})` : "not set"}`);
    const appMode = env.APP_DATA_MODE || "demo";
    console.log(`  Data Mode: ${appMode}`);
    const strict = env.LIVE_FEED_STRICT === "true" || env.LIVE_FEED_STRICT === "1";
    console.log(`  Strict Mode: ${strict ? "ENABLED (no fallback to demo)" : "disabled (fallback to demo)"}`);
    console.log(`${"─".repeat(70)}\n`);
  }
}
