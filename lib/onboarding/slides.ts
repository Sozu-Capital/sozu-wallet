import type { WalletLanguage } from "@/lib/wallet-texts"

export const WALLET_ACTIVATION_SLIDE_COUNT = 4

export type ActivationSlide = {
  step: string
  title: string
  body: string
  note: string
}

const SLIDES: Record<WalletLanguage, readonly ActivationSlide[]> = {
  es: [
    {
      step: "Paso 1 de 4",
      title: "Una cuenta en Stellar",
      body: "Tu llave de acceso crea una cuenta inteligente. Esa cuenta guarda USDC. Sozu no guarda una contraseña.",
      note: "La llave queda en este dispositivo.",
    },
    {
      step: "Paso 2 de 4",
      title: "Firmás cada envío",
      body: "Cada envío se firma con la llave de este dispositivo: rostro, huella o PIN, según el teléfono.",
      note: "Esta llave firma los envíos desde este teléfono.",
    },
    {
      step: "Paso 3 de 4",
      title: "USDC para pagar y recibir",
      body: "El saldo es USDC en Stellar. Podés pagar otra cuenta Sozu y recibir USDC.",
      note: "Esta billetera no ofrece rendimiento ni préstamos.",
    },
    {
      step: "Paso 4 de 4",
      title: "Saldo, Pagar y Depositar",
      body: "En inicio vas a ver el saldo en USDC, Pagar y Depositar. El monto en pesos es una cotización de referencia, no un rendimiento.",
      note: "",
    },
  ],
  en: [
    {
      step: "Step 1 of 4",
      title: "An account on Stellar",
      body: "Your passkey creates a smart account. That account holds USDC. Sozu does not store a password.",
      note: "The passkey stays on this device.",
    },
    {
      step: "Step 2 of 4",
      title: "You sign each send",
      body: "Each send is signed with this device's passkey: face, fingerprint, or PIN, depending on the phone.",
      note: "This passkey signs sends from this phone.",
    },
    {
      step: "Step 3 of 4",
      title: "USDC to pay and receive",
      body: "The balance is USDC on Stellar. You can pay another Sozu account and receive USDC.",
      note: "This wallet does not offer yield or loans.",
    },
    {
      step: "Step 4 of 4",
      title: "Balance, Pay, and Deposit",
      body: "Home shows your USDC balance, Pay, and Deposit. A peso amount is a reference rate, not a return.",
      note: "",
    },
  ],
}

const CTA = {
  es: { next: "Continuar", open: "Abrir billetera", label: "Bienvenida" },
  en: { next: "Continue", open: "Open wallet", label: "Welcome" },
} as const

export function activationSlides(language: WalletLanguage): readonly ActivationSlide[] {
  return SLIDES[language] ?? SLIDES.es
}

export function activationCta(language: WalletLanguage, isLast: boolean): string {
  const copy = CTA[language] ?? CTA.es
  return isLast ? copy.open : copy.next
}

export function activationDialogLabel(language: WalletLanguage): string {
  return (CTA[language] ?? CTA.es).label
}
