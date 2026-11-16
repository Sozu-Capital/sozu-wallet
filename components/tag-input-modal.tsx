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
import { AnimatePresence, motion } from "framer-motion"
import { OnboardingForm } from "@/components/ui/onboarding-form"
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

  const handleTagValue = (value: string) => {
    const next = value.replace(/[^a-zA-Z0-9_]/g, "")
    setTag(next)
    if (error && next.trim().length >= 3) setError("")
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

  const canProceedTag =
    isTagValid && (availabilityStatus === "available" || availabilityStatus === "taken")

  const submitEmail = () => {
    const normalized = normalizeRecoveryEmail(email)
    if (!normalized) {
      setEmailError(emailCopy.invalid)
      return
    }
    onRegister(trimmed, normalized)
  }

  const backClass = "w-full text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"

  const availabilityHint = (
    <div className="flex min-h-5 items-center justify-center gap-2">
      {trimmed.length >= 3 && isTagValid && availabilityStatus === "checking" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : null}
      {trimmed.length >= 3 && isTagValid && availabilityStatus === "available" ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
      ) : null}
      {availabilityMessage ? (
        <p
          className={`text-[11px] font-light ${
            availabilityStatus === "available"
              ? "text-emerald-400"
              : availabilityStatus === "error"
                ? "text-amber-400"
                : "text-muted-foreground"
          }`}
        >
          {availabilityMessage}
        </p>
      ) : null}
      {error ? <p className="text-[11px] text-amber-400">{error}</p> : null}
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md border-0 bg-transparent p-0 shadow-none sm:max-w-md"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">
          {step === "tag" ? t.authChooseName : step === "email" ? emailCopy.title : t.authSignIn}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {step === "email" ? emailCopy.subtitle : step === "tag" ? t.authRegisterOnInternet : trimmed}
        </DialogDescription>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
          {step === "tag" ? (
            <OnboardingForm
              imageSrc="/onboarding/slide1.webp"
              title={t.authChooseName}
              description={t.authRegisterOnInternet}
              inputPlaceholder={t.authTagPlaceholder}
              buttonText={availabilityStatus === "taken" ? t.authSignIn : t.authRegister}
              value={tag}
              onValueChange={handleTagValue}
              autoCapitalize="none"
              autoComplete="username"
              onSubmit={() => handlePrimaryTagStep()}
              submitDisabled={!canProceedTag}
              hint={availabilityHint}
              note={
                <>
                  <button
                    type="button"
                    onClick={() => setLearnOpen((open) => !open)}
                    className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                  >
                    {t.authLearnMore}
                  </button>
                  {learnOpen ? (
                    <p className="mt-3 border-t border-border pt-3 text-left text-[11px] leading-relaxed text-muted-foreground">
                      {t.authLearnMoreBody}
                    </p>
                  ) : null}
                </>
              }
            />
          ) : step === "email" ? (
            <OnboardingForm
              key="email"
              imageSrc="/onboarding/slide4.webp"
              title={emailCopy.title}
              description={emailCopy.subtitle}
              inputPlaceholder={emailCopy.placeholder}
              inputType="email"
              inputMode="email"
              autoComplete="email"
              buttonText={emailCopy.button}
              value={email}
              onValueChange={(next) => {
                setEmail(next)
                setEmailError("")
              }}
              onSubmit={() => submitEmail()}
              hint={emailError ? <p className="text-[11px] text-amber-400">{emailError}</p> : null}
              footer={
                <button type="button" onClick={() => { setStep("tag"); setEmailError("") }} className={backClass}>
                  {emailCopy.back}
                </button>
              }
            />
          ) : (
            <OnboardingForm
              key="signin"
              imageSrc="/onboarding/slide2.webp"
              title={t.authSignIn}
              description={trimmed}
              buttonText={t.authPasskey}
              buttonIcon={<Fingerprint className="mr-2 h-4 w-4" />}
              hideInput
              onSubmit={() => void handlePasskey()}
              isSubmitting={passkeyBusy}
              hint={error ? <p className="text-[11px] text-amber-400">{error}</p> : null}
              footer={
                <div className="space-y-4">
                  {pinEnabled ? (
                    <div className="space-y-3 border-t border-border pt-4">
                      <Label className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        {t.authBackupPin}
                      </Label>
                      <Input
                        type="password"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={pin}
                        onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 12))}
                        placeholder={t.authPinPlaceholder}
                        className="text-center tracking-widest"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void handlePinSubmit()}
                        disabled={pinBusy || pin.length < 6}
                        className="w-full"
                      >
                        {pinBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t.authContinueWithPin}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[10px] leading-relaxed text-muted-foreground">{t.authNoBackupPin}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setStep("tag")
                      setPin("")
                      setError("")
                    }}
                    className={backClass}
                  >
                    {t.authBack}
                  </button>
                </div>
              }
            />
          )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
