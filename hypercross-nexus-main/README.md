<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ce80706b-e3ae-4bf1-996c-4e34e1909b6e

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env` and set your Chainstack RPC values.
3. Configure the provider in `.env`:
   - `BLOCKCHAIN_PROVIDER=chainstack`
   - `CHAINSTACK_NETWORK=ethereum`
   - `CHAINSTACK_RPC_URL=https://<your-chainstack-rpc-endpoint>`
   - `CHAINSTACK_CHAIN_ID=1`
   - `CHAINSTACK_API_KEY=<optional>`
   - `CHAINSTACK_PRIVATE_KEY=<optional-for-signed-transactions>`
4. Start the app:
   `npm run dev`

The server exposes `/api/blockchain/status` for the app shell. If the Chainstack RPC is not configured, the app gracefully falls back to demo data while still keeping the Chainstack provider path available for future live deployment.
