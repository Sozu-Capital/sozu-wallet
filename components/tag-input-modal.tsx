"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Fingerprint, Hash, Loader2 } from "lucide-react"
import { useWalletLanguage } from "@/lib/wallet-language"
import { isPilotMainnet } from "@/lib/pilot/pilot-mainnet"
import { normalizeRecoveryEmail } from "@/lib/auth/recovery-email"

export interface TagInputModalProps {
  isOpen: boolean
  onClose: () => void
  /** Reserved name plus the recovery email → create account. */
  onRegister: (tag: string, recoveryEmail: string) => void
  /** Taken name → passkey authentication. */
  onLoginPasskey: (tag: string) => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>
  /** Taken name + PIN when user has set a backup PIN. */
  onLoginPin: (tag: string, pin: string) => Promise<{ ok: boolean; error?: string }>
  /** After passkey cancel: reopen on sign-in step with this tag. */
  resumeWithTag?: string | null
  /** After register cancel: reopen name step with this tag. */
  prefillTag?: string | null
}

type AvailabilityStatus = "idle" | "checking" | "available" | "taken" | "error"

type Step = "tag" | "email" | "signin"

const EMAIL_COPY = {
  es: {
    title: "Tu correo.",
    subtitle: "Este correo se usa para recuperar tu cuenta si perdés el dispositivo.",
    placeholder: "Correo",
    button: "Crear cuenta",
    invalid: "Escribí un correo válido.",
    back: "Volver",
  },
  en: {
    title: "Your email.",
    subtitle: "This email is used to recover your account if you lose this device.",
    placeholder: "Email",
    button: "Create account",
    invalid: "Enter a valid email.",
    back: "Back",
  },
} as const

const fieldClass =
  "h-11 rounded-none border-0 border-b border-b-white/15 bg-transparent px-0 text-center text-lg font-light tracking-[0.15em] text-white placeholder:text-white/25 focus-visible:border-b-white/40 focus-visible:ring-0"

export function TagInputModal({
  isOpen,
  onClose,
  onRegister,
  onLoginPasskey,
  onLoginPin,
  resumeWithTag,
  prefillTag,
}: TagInputModalProps) {
  const { t, language } = useWalletLanguage()
  const emailCopy = EMAIL_COPY[language] ?? EMAIL_COPY.es
  const [step, setStep] = useState<Step>("tag")
  const [tag, setTag] = useState("")
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [learnOpen, setLearnOpen] = useState(false)
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>("idle")
  const [availabilityMessage, setAvailabilityMessage] = useState("")
  const [pinEnabled, setPinEnabled] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [pinBusy, setPinBusy] = useState(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const validateTag = (value: string): boolean => {
    if (value.length < 3 || value.length > 30) {
      setError(t.authTagLengthError)
      setAvailabilityStatus("idle")
      return false
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setError(t.authTagCharsError)
      setAvailabilityStatus("idle")
      return false
    }
    setError("")
    return true
  }

  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
      setPinEnabled(false)
      return
    }

    setAvailabilityStatus("checking")
    setAvailabilityMessage("")

    try {
      const response = await fetch("/api/auth/username/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, lang: language }),
      })
      const data = await response.json()

      if (data.available) {
        setAvailabilityStatus("available")
        setAvailabilityMessage(typeof data.message === "string" ? data.message : t.authUsernameFree)
        setPinEnabled(false)
      } else {
        setAvailabilityStatus("taken")
        setAvailabilityMessage(typeof data.message === "string" ? data.message : "")
        setPinEnabled(!isPilotMainnet() && Boolean(data.pinEnabled))
      }
    } catch {
      setAvailabilityStatus("error")
      setAvailabilityMessage(t.authCouldNotCheck)
      setPinEnabled(false)
    }
  }, [language, t.authCouldNotCheck, t.authUsernameFree])

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    const trimmedTag = tag.trim()
    if (!trimmedTag) {
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
      setPinEnabled(false)
      return
    }

    const isValidFormat =
      trimmedTag.length >= 3 && trimmedTag.length <= 30 && /^[a-zA-Z0-9_]+$/.test(trimmedTag)

    if (!isValidFormat) {
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
      setPinEnabled(false)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      void checkUsernameAvailability(trimmedTag)
    }, 400)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [tag, checkUsernameAvailability])

  useEffect(() => {
    if (!isOpen) {
      setTag("")
      setEmail("")
      setEmailError("")
      setPin("")
      setError("")
      setLearnOpen(false)
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
      setPinEnabled(false)
      setStep("tag")
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      return
    }
    if (resumeWithTag) {
      const resumeTag = resumeWithTag.replace(/^\$/, "").trim()
      setTag(resumeTag)
      setStep("signin")
      setPin("")
      setError("")
      void checkUsernameAvailability(resumeTag)
    } else if (prefillTag) {
      const prefill = prefillTag.replace(/^\$/, "").trim()
      setTag(prefill)
      setStep("tag")
      setPin("")
      setError("")
      void checkUsernameAvailability(prefill)
    }
  }, [isOpen, resumeWithTag, prefillTag, checkUsernameAvailability])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, "")
    setTag(value)
    if (error && value.trim().length >= 3) setError("")
  }

  const trimmed = tag.trim()
  const isTagValid =
    trimmed.length >= 3 && trimmed.length <= 30 && /^[a-zA-Z0-9_]+$/.test(trimmed) && !error

  const handlePrimaryTagStep = () => {
    if (!validateTag(trimmed)) return
    if (availabilityStatus === "available") {
      setEmailError("")
      setStep("email")
      return
    }
    if (availabilityStatus === "taken") {
      setStep("signin")
      setPin("")
      setError("")
    }
  }

  const handlePasskey = async () => {
    if (!validateTag(trimmed)) return
    setPasskeyBusy(true)
    setError("")
    try {
      const result = await onLoginPasskey(trimmed)
      if (!result.ok) {
        if (result.cancelled) {
          setError("")
          setStep("signin")
        } else {
          setError(result.error || t.authCouldNotSignIn)
        }
      }
    } finally {
      setPasskeyBusy(false)
    }
  }

  const handlePinSubmit = async () => {
    if (!validateTag(trimmed)) return
    if (!/^\d{6,12}$/.test(pin)) {
      setError(t.authPinLengthError)
      return
    }
    setPinBusy(true)
    setError("")
    try {
      const result = await onLoginPin(trimmed, pin)
      if (!result.ok) {
        setError(result.error || t.authCouldNotSignIn)
      }
    } finally {
      setPinBusy(false)
    }
  }

  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handlePrimaryTagStep()
    }
  }

  const submitEmail = () => {
    const normalized = normalizeRecoveryEmail(email)
    if (!normalized) {
      setEmailError(emailCopy.invalid)
      return
    }
    onRegister(trimmed, normalized)
  }

  const canProceedTag =
    isTagValid && (availabilityStatus === "available" || availabilityStatus === "taken")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-sm border-white/10 bg-black/95 text-white shadow-none"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">
          {step === "tag" ? t.authChooseName : step === "email" ? emailCopy.title : t.authSignIn}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {step === "email" ? emailCopy.subtitle : step === "tag" ? t.authRegisterOnInternet : trimmed}
        </DialogDescription>
        {step === "tag" ? (
          <div className="space-y-8 pt-1 pb-2">
            <div className="space-y-1 text-center">
              <p className="text-[15px] font-light tracking-wide text-white/90">{t.authChooseName}</p>
              <p className="text-[13px] font-extralight tracking-wide text-white/55">{t.authRegisterOnInternet}</p>
              <button
                type="button"
                onClick={() => setLearnOpen((v) => !v)}
                className="mt-2 text-[10px] tracking-[0.2em] uppercase text-white/35 hover:text-white/50 transition-colors"
              >
                {t.authLearnMore}
              </button>
              {learnOpen ? (
                <p className="mt-3 border-t border-white/5 px-1 pt-2 text-left text-[11px] leading-relaxed text-white/45">
                  {t.authLearnMoreBody}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <Input
                type="text"
                value={tag}
                onChange={handleChange}
                onKeyDown={handleKeyDownTag}
                placeholder={t.authTagPlaceholder}
                className={`${fieldClass} ${
                  availabilityStatus === "available"
                    ? "border-b-emerald-500/40"
                    : availabilityStatus === "taken"
                      ? "border-b-white/25"
                      : "border-b-white/15"
                }`}
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
              />
              <div className="flex min-h-[1.25rem] items-center justify-center gap-2">
                {trimmed.length >= 3 && isTagValid && availabilityStatus === "checking" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />
                ) : null}
                {trimmed.length >= 3 && isTagValid && availabilityStatus === "available" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600/80" aria-hidden />
                ) : null}
                {availabilityMessage ? (
                  <p
                    className={`text-[11px] font-light ${
                      availabilityStatus === "available"
                        ? "text-emerald-600/70"
                        : availabilityStatus === "taken"
                          ? "text-white/40"
                          : availabilityStatus === "error"
                            ? "text-amber-500/80"
                            : "text-white/30"
                    }`}
                  >
                    {availabilityMessage}
                  </p>
                ) : null}
              </div>
              {error ? <p className="text-center text-[11px] text-amber-500/90">{error}</p> : null}
            </div>

            <Button
              type="button"
              onClick={handlePrimaryTagStep}
              disabled={!canProceedTag}
              className="h-11 w-full rounded-full bg-white/95 text-sm font-normal tracking-widest text-black hover:bg-white disabled:opacity-30"
            >
              {availabilityStatus === "taken" ? t.authSignIn : t.authRegister}
            </Button>
          </div>
        ) : step === "email" ? (
          <div className="space-y-8 pt-1 pb-2">
            <div className="space-y-1 text-center">
              <p className="text-[15px] font-light tracking-wide text-white/90">{emailCopy.title}</p>
              <p className="text-[13px] font-extralight tracking-wide text-white/55">{emailCopy.subtitle}</p>
            </div>

            <div className="space-y-3">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setEmailError("")
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    submitEmail()
                  }
                }}
                placeholder={emailCopy.placeholder}
                className={fieldClass}
                autoFocus
              />
              {emailError ? <p className="text-center text-[11px] text-amber-500/90">{emailError}</p> : null}
            </div>

            <Button
              type="button"
              onClick={submitEmail}
              className="h-11 w-full rounded-full bg-white/95 text-sm font-normal tracking-widest text-black hover:bg-white"
            >
              {emailCopy.button}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep("tag")
                setEmailError("")
              }}
              className="w-full text-[10px] tracking-[0.2em] uppercase text-white/30 hover:text-white/45"
            >
              {emailCopy.back}
            </button>
          </div>
        ) : (
          <div className="space-y-6 pt-1 pb-2">
            <div className="space-y-1 text-center">
              <p className="text-[11px] tracking-[0.25em] uppercase text-white/35">{t.authSignIn}</p>
              <p className="text-base font-light tracking-wide text-white/90">{trimmed}</p>
            </div>

            {error ? <p className="text-center text-[11px] text-amber-500/90">{error}</p> : null}

            <Button
              type="button"
              onClick={() => void handlePasskey()}
              disabled={passkeyBusy}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/95 text-sm font-normal tracking-widest text-black hover:bg-white disabled:opacity-40"
            >
              {passkeyBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Fingerprint className="h-4 w-4 opacity-70" />
                  {t.authPasskey}
                </>
              )}
            </Button>

            {pinEnabled ? (
              <div className="space-y-3 border-t border-white/10 pt-2">
                <Label className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase text-white/30">
                  <Hash className="h-3 w-3" />
                  {t.authBackupPin}
                </Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder={t.authPinPlaceholder}
                  className="h-10 border-white/10 bg-white/5 text-center text-sm tracking-widest"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void handlePinSubmit()}
                  disabled={pinBusy || pin.length < 6}
                  className="w-full text-xs text-white/60 hover:bg-white/5 hover:text-white"
                >
                  {pinBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t.authContinueWithPin}
                </Button>
              </div>
            ) : (
              <p className="text-center text-[10px] leading-relaxed text-white/30">{t.authNoBackupPin}</p>
            )}

            <button
              type="button"
              onClick={() => {
                setStep("tag")
                setPin("")
                setError("")
              }}
              className="w-full pt-2 text-[10px] tracking-[0.2em] uppercase text-white/30 hover:text-white/45"
            >
              {t.authBack}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
