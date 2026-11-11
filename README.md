# ROCK STAR IMPORTATION — Ghana online shop

This is a deployable Node.js starter for a real store, with:
- Customer product catalogue, cart and delivery form
- Ghana cedi pricing
- Product upload/admin page at `/admin.html`
- Paystack hosted checkout initialization and server-side payment verification
- Order reference and basic tracking lookup
- Product images uploaded by the store owner

## Important: real payments are not active until configured
You must have a verified Paystack merchant account and configure the secret/public keys in the hosting provider's environment variables. Start with Paystack test keys and test the complete checkout before using live keys. Never put the secret key in browser code or share it with customers.

## Run locally
1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env` and fill in the values.
3. Install dependencies: `npm install`
4. Start: `npm start`
5. Open `http://localhost:3000`
6. Admin page: `http://localhost:3000/admin.html`

Set `SITE_URL` to the public HTTPS website address after deployment. Set a strong `ADMIN_PASSWORD`. Configure `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` as server environment variables, not in public files.

## Deploy
Deploy this Node.js app to a host that supports persistent storage and Node applications. The `data/` and `public/uploads/` directories must persist between restarts/deploys. A static-only host/drop is not sufficient for this app. Add the environment variables above in the host dashboard, then deploy. Use HTTPS.

## Current limitations / production checklist
- This starter stores orders and products in local JSON files. For a high-traffic production store, migrate to a managed database and persistent object storage.
- Tracking lookup is based on order reference plus phone. The current admin page uploads products but does not yet provide a secure order-management screen to enter tracking numbers; that needs to be added before the AI tracking assistant is connected.
- Product request form is a front-end placeholder and needs a saved request inbox.
- Add Paystack webhook signature validation, rate limiting, admin login sessions, backups, privacy policy, terms, refund policy and delivery/returns information before launch.
- Confirm current Paystack country, channel and settlement eligibility for your Ghana merchant account directly with Paystack. This code uses Paystack hosted checkout and GHS transaction initialization; available payment methods depend on your merchant account.
- Do not promise a fixed delivery date until shipping and supplier arrangements are confirmed.
