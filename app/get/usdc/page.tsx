import type { Metadata } from "next"
import { NfcUsdcDrop } from "@/components/faucet/nfc-usdc-drop"

export const metadata: Metadata = {
  title: "Get 100 testnet USDC",
  description: "Tap to create a Sozu Wallet and claim 100 testnet USDC from Sozu Faucet.",
}

/** NFC tag URL on staging: https://dev.sozu.capital/get/usdc */
export default function GetUsdcPage() {
  return <NfcUsdcDrop />
}
