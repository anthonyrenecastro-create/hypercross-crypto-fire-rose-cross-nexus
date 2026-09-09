# Nexus Decision Pipeline

Hypercross Nexus owns the decision lifecycle:

```text
THINK -> ANALYZE -> SCORE -> ROUTE -> PREPARE -> AUTHORIZE -> EXECUTE -> VERIFY
```

The pipeline produces reviewable typed context, analysis, scores, a strategy proposal, risk decisions, and execution eligibility. It does not submit a transaction or hold a wallet private key.

## Execution Profiles

- `STANDARD` is the default. It uses a connected external wallet, conservative limits, fresh quotes, and explicit user approval.
- `ADVANCED` uses the same external-wallet authorization boundary with broader configured limits.
- `XERO` is optional. It requires a connected Xero adapter and explicit risk acknowledgement. Eligibility does not mean execution.

The standard path is independent of Xero. Swap preparation remains handled by `SwapService`; transaction submission and verification remain handled by `TransactionService` and `TransactionIntegrity`. The decision pipeline is intentionally upstream of those services.

## API

Authenticated users with the `advanced_strategies` entitlement can call:

```text
POST /api/intelligence/pipeline/decide
GET  /api/intelligence/execution-profiles
```

`POST /pipeline/decide` returns `eligibility.standardEligible`, `advancedEligible`, and `xeroEligible`. A rejected Standard decision should be shown to the user and cannot be silently routed to Xero. Xero eligibility requires both `xeroConnected` and `xeroAcknowledged`.

## Safety

Quotes remain time-bound and must be refreshed after expiry. Approval and execution are separate operations. The connected wallet signs the final transaction, and on-chain verification remains authoritative. Xero has a different risk envelope, not an exemption from risk controls.