import type { WalletLanguage } from "@/lib/wallet-texts"

/** Copy for the withdraw-all flow. Kept separate from wallet-texts.ts; error copy is keyed by server `code`. */

export const WITHDRAW_GUIDE_PATH = "/ayuda/retirar"

const es = {
  entry: "Retirar todo",
  title: "Retirar todo tu saldo",
  intro: "Enviá todo tu USDC a otra billetera o a un exchange. Así sacás tu dinero de Sozu cuando quieras.",
  addressLabel: "Dirección de destino",
  addressPlaceholder: "Pegá la dirección (empieza con G, M o C)",
  memoLabel: "Memo (solo si tu exchange lo pide)",
  memoPlaceholder: "Ej: 123456789",
  memoHint: "Si retirás a un exchange, copiá también el memo que te da. Solo se pueden usar memos de números.",
  guideLink: "¿Cómo retirar? Guía paso a paso",
  review: "Revisar",
  reviewing: "Revisando…",
  confirmTitle: "Revisá antes de confirmar",
  youSend: "Vas a enviar",
  allBalance: "Todo tu saldo",
  toAddress: "A esta dirección",
  compareHint: "Compará la dirección completa, grupo por grupo, con la de tu exchange o billetera.",
  memoRow: "Memo",
  destinationOk: "Verificamos que la cuenta existe y acepta USDC.",
  exchangeWarning:
    "Este envío sale de una billetera inteligente (contrato). Algunos exchanges no lo acreditan automáticamente. Si es la primera vez con este exchange, consultá con su soporte antes de enviar todo.",
  contractNote: "Es una billetera inteligente (C…). Asegurate de que sea tuya o de alguien de confianza.",
  confirm: "Confirmar con passkey",
  back: "Volver",
  close: "Cerrar",
  signing: "Confirmá con tu passkey…",
  submitting: "Enviando…",
  preparing: "Preparando…",
  retry: "Volver a intentar",
  errors: {
    empty: "Pegá una dirección.",
    invalid_address: "Esa dirección no es válida. Copiala de nuevo, completa.",
    memo_not_numeric:
      "Ese memo tiene letras o empieza con 0. Sozu solo puede enviar memos de números. Pedile a tu exchange un memo numérico o usá otra billetera.",
    memo_too_large: "El memo es demasiado largo. Revisalo.",
    memo_with_muxed: "Esta dirección (empieza con M) ya incluye el memo. Borrá el memo.",
    memo_on_contract: "Las direcciones que empiezan con C no usan memo. Borrá el memo.",
    self_destination: "Esa es tu propia billetera de Sozu. Poné otra dirección.",
    destination_not_found:
      "Esa cuenta todavía no existe en Stellar. Tiene que estar activada (con XLM) antes de recibir USDC.",
    destination_no_trustline:
      "Esa cuenta todavía no acepta USDC. Tiene que agregar USDC antes de recibir. Si es un exchange, revisá que sea la dirección de USDC en la red Stellar.",
    destination_trustline_unauthorized: "Esa cuenta no está autorizada para recibir USDC.",
    destination_trustline_full: "Esa cuenta no puede recibir este monto (llegó a su límite de USDC).",
    contract_not_found: "No encontramos esa billetera (C…) en Stellar. Revisá la dirección.",
    destination_check_failed: "No pudimos verificar la dirección ahora. Probá de nuevo en un minuto.",
    no_balance: "No tenés USDC para retirar.",
    balance_changed: "Tu saldo cambió. Revisá el nuevo monto y confirmá otra vez.",
    wallet: "No pudimos cargar tu billetera. Cerrá sesión, volvé a entrar y probá de nuevo.",
    sign_failed: "No se pudo confirmar con la passkey. No se envió nada. Probá de nuevo.",
    submit_pending: "El envío puede seguir en camino. No lo repitas: revisá tu saldo en un minuto.",
    submit_auth_rejected:
      "Tu passkey no fue aceptada. No se envió nada. Cerrá sesión, volvé a entrar y probá de nuevo.",
    submit_failed: "El envío falló y no se movió tu dinero. Probá de nuevo.",
    unknown: "Algo salió mal. Revisá tu saldo antes de intentar de nuevo.",
  },
}

export type WithdrawTexts = typeof es

const en: WithdrawTexts = {
  entry: "Withdraw all",
  title: "Withdraw your whole balance",
  intro: "Send all your USDC to another wallet or an exchange. This is how you take your money out of Sozu.",
  addressLabel: "Destination address",
  addressPlaceholder: "Paste the address (starts with G, M or C)",
  memoLabel: "Memo (only if your exchange asks for one)",
  memoPlaceholder: "e.g. 123456789",
  memoHint: "Withdrawing to an exchange? Copy the memo it gives you too. Only numeric memos are supported.",
  guideLink: "How to withdraw — step by step",
  review: "Review",
  reviewing: "Checking…",
  confirmTitle: "Check before you confirm",
  youSend: "You are sending",
  allBalance: "Your whole balance",
  toAddress: "To this address",
  compareHint: "Compare the full address, group by group, with your exchange or wallet.",
  memoRow: "Memo",
  destinationOk: "We checked the account exists and accepts USDC.",
  exchangeWarning:
    "This transfer comes from a smart wallet (contract). Some exchanges don't credit it automatically. If this is your first time with this exchange, ask their support before sending everything.",
  contractNote: "This is a smart wallet (C…). Make sure it is yours or someone you trust.",
  confirm: "Confirm with passkey",
  back: "Back",
  close: "Close",
  signing: "Confirm with your passkey…",
  submitting: "Sending…",
  preparing: "Preparing…",
  retry: "Try again",
  errors: {
    empty: "Paste an address.",
    invalid_address: "That address is not valid. Copy it again, in full.",
    memo_not_numeric:
      "That memo has letters or starts with 0. Sozu can only send numeric memos. Ask your exchange for a numeric memo or use another wallet.",
    memo_too_large: "The memo is too long. Check it.",
    memo_with_muxed: "This address (starts with M) already includes the memo. Clear the memo.",
    memo_on_contract: "Addresses starting with C don't use a memo. Clear the memo.",
    self_destination: "That is your own Sozu wallet. Enter another address.",
    destination_not_found: "That account doesn't exist on Stellar yet. It must be activated (with XLM) before it can receive USDC.",
    destination_no_trustline:
      "That account doesn't accept USDC yet. It must add USDC first. If it's an exchange, check it's the USDC address on the Stellar network.",
    destination_trustline_unauthorized: "That account is not authorized to receive USDC.",
    destination_trustline_full: "That account can't receive this amount (USDC limit reached).",
    contract_not_found: "We couldn't find that wallet (C…) on Stellar. Check the address.",
    destination_check_failed: "We couldn't check the address right now. Try again in a minute.",
    no_balance: "You have no USDC to withdraw.",
    balance_changed: "Your balance changed. Check the new amount and confirm again.",
    wallet: "We couldn't load your wallet. Sign out, sign in again and retry.",
    sign_failed: "Passkey confirmation failed. Nothing was sent. Try again.",
    submit_pending: "The transfer may still be on its way. Don't repeat it: check your balance in a minute.",
    submit_auth_rejected: "Your passkey was not accepted. Nothing was sent. Sign out, sign in again and retry.",
    submit_failed: "The transfer failed and your money did not move. Try again.",
    unknown: "Something went wrong. Check your balance before trying again.",
  },
}

export function getWithdrawTexts(language: WalletLanguage): WithdrawTexts {
  return language === "en" ? en : es
}

const WALLET_CODES = new Set([
  "wallet_not_found",
  "wallet_must_be_smart_account",
  "network_mismatch",
  "smart_signer_required",
])

export function withdrawErrorText(code: string | null, t: WithdrawTexts): string | null {
  if (!code) return null
  if (WALLET_CODES.has(code)) return t.errors.wallet
  return (t.errors as Record<string, string>)[code] ?? t.errors.unknown
}
