/**
 * Routes reachable without a wallet session, with the reason.
 * Adding a route here needs review: it must not read or change any user's data by a client-supplied id.
 * `methods` limits the exemption; omit it to exempt every exported method.
 */
export type PublicRoute = { reason: string; methods?: string[] }

export const PUBLIC_ROUTES: Record<string, PublicRoute> = {
  // Sign-in ceremonies: they create the session.
  "/api/auth/login/challenge": { reason: "issues a signed WebAuthn challenge" },
  "/api/auth/login/verify": { reason: "verifies the passkey assertion and issues the session cookie" },
  "/api/auth/register/challenge": { reason: "registration challenge for a new account" },
  "/api/auth/register/verify": { reason: "creates a new account and issues its session cookie" },
  "/api/auth/username/check": { reason: "tag availability check during sign-up" },
  "/api/auth/pin/login": { reason: "backup PIN sign-in (removed under PILOT_MAINNET by szc #36)" },
  "/api/auth/logout": { reason: "clears the caller's own cookie" },
  "/api/auth/cross-device/init": { reason: "starts a QR sign-up; binds the desktop with an httpOnly cookie" },
  "/api/auth/cross-device/status": {
    reason: "returns a session only to the browser holding the binding cookie",
  },
  "/api/auth/passkeys/add/verify": {
    reason: "pairing-code path for a new device; the non-pairing path requires a session",
  },

  // Public data, no user identity.
  "/api/health": { reason: "health check" },
  "/api/fx": { reason: "FX rates" },
  "/api/deposits/fx": { reason: "FX quote for deposits" },
  "/api/faucets": { reason: "public faucet list" },
  "/api/faucets/[slug]/status": { reason: "public faucet status; per-user cooldown only with a session" },
  "/api/smart-accounts/config": { reason: "public contract configuration" },
  "/api/smart-accounts/resolve-key-data": { reason: "on-chain signer lookup by contract id" },
  "/api/smart-accounts/resolve-public-key": {
    reason: "on-chain passkey lookup; the database fallback only reads the session user's rows",
  },
  "/api/wallet/smart-account/diagnose": { reason: "on-chain signer lookup by contract id" },
  "/api/wallet/smart-wallet/status": { reason: "deployment configuration flags" },
  "/api/wallet/stellar/assets": { reason: "on-chain balances for a public key" },
  "/api/wallet/resolve-recipient": { reason: "public $tag directory lookup for payments" },
  "/api/wallet/resolve-address-to-tag": { reason: "public $tag directory lookup for payments" },
  "/api/wallet/sozu-tag": { methods: ["POST"], reason: "first-claim tag registration for offline phones" },
  "/api/organization/treasury-address": { reason: "public org treasury address" },
  "/api/pizza/sku": { reason: "public product catalog" },

  // Pass-through to SozuPay or on-chain artifacts that carry their own authorization.
  "/api/checkout/proxy": { reason: "reads a public SozuPay checkout session" },
  "/api/checkout/complete": { reason: "forwards a tx hash to SozuPay, which verifies it on-chain" },
  "/api/pizza/redeems": { reason: "proxy to SozuPay; redeem is authorized by the signed transaction" },
  "/api/pizza/redeems/[id]": { reason: "proxy to SozuPay; redeem is authorized by the signed transaction" },
  "/api/offline/ledger": { reason: "public offline cheque ledger" },
  "/api/offline/prepare": { reason: "builds an unsigned settle tx from a passkey-signed cheque" },
  "/api/offline/submit": { reason: "submits a passkey-signed cheque" },
  "/api/deposits/sumup/webhook": { reason: "provider webhook" },
  "/api/gmail/callback": { reason: "OAuth callback, bound by the OAuth state parameter" },

  // SDP onboarding: keyed by the HMAC-signed SDP invite cookie, not by wallet identity.
  "/api/sdp/context": { reason: "reads the caller's own signed invite cookie" },
  "/api/sdp/reset-wallet-link": { reason: "clears the caller's own SDP cookies" },
  "/api/sdp/verify-identity": { reason: "validated against the caller's signed invite cookie" },
}
