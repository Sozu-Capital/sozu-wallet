"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { SozuTagScreen } from "@/components/onboarding/sozu-tag-screen"
import { ProgressPills } from "@/components/onboarding/progress-pills"
import { DeviceKeyIcon, SlideIcons, sentenceLines } from "@/components/onboarding/slide-art"
import { SozuButton } from "@/components/ui/sozu-button"
import {
  WALLET_ACTIVATION_SLIDE_COUNT,
  activationCta,
  activationDialogLabel,
  activationSlides,
  type ActivationSlide,
} from "@/lib/onboarding/slides"
import { normalizeRecoveryEmail } from "@/lib/auth/recovery-email"
import { useWalletLanguage } from "@/lib/wallet-language"

const BLACK_FADE_MS = 650
const WALLET_REVEAL_MS = 750

type Phase = "tag" | "slides" | "black" | "done"

type WalletActivationOnboardingProps = {
  open: boolean
  activationSettled: boolean
  onExitComplete: () => void
  /** Welcome is the home recap. Signup starts with the tag and ends with the recovery email. */
  intent?: "welcome" | "signup"
  initialTag?: string
  onCreateAccount?: (tag: string, email: string) => void
  onSignIn?: (tag: string) => void
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function SlideCopy({
  slide,
  index,
  recovery,
}: {
  slide: ActivationSlide
  index: number
  recovery?: {
    hint: string
    placeholder: string
    value: string
    error?: string
    onChange: (value: string) => void
  }
}) {
  const lines = sentenceLines(slide.body)

  return (
    <div className="relative flex min-h-full w-full shrink-0 flex-col items-center justify-center overflow-hidden px-3 py-8 text-center">
      <div className="relative z-10 flex w-full flex-col items-center">
        <SlideIcons index={index} />
        <h1
          className="sozu-serif w-full max-w-[366px] space-y-1 text-[18px] font-normal leading-6 tracking-[-0.02em] text-[var(--sozu-text-primary)]"
          style={{ textShadow: "0 1px 16px rgba(19, 18, 16, 0.92)" }}
        >
          <span className="sr-only">{slide.title}. </span>
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        {slide.note ? (
          <p className="mt-14 flex max-w-[300px] items-center justify-center gap-2.5 text-[15px] leading-5 text-[var(--sozu-text-secondary)]">
            {index === 0 ? <DeviceKeyIcon /> : null}
            <span>{slide.note}</span>
          </p>
        ) : null}
        {recovery ? (
          <div className="mt-8 w-full max-w-[342px]">
            <p className="text-pretty text-[14px] leading-5 text-[var(--sozu-text-secondary)]">{recovery.hint}</p>
            <label className="sr-only" htmlFor="sozu-recovery-email">
              {recovery.placeholder}
            </label>
            <input
              id="sozu-recovery-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={recovery.value}
              placeholder={recovery.placeholder}
              onChange={(event) => recovery.onChange(event.target.value)}
              className="sozu-field mt-3 h-[54px] w-full rounded-2xl px-4 text-[16px] text-[var(--sozu-text-primary)] outline-none placeholder:text-[var(--sozu-text-subtle)]"
            />
            {recovery.error ? (
              <p className="mt-2 text-[13px] leading-[18px] text-[var(--sozu-text-danger)]">{recovery.error}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Full-screen onboarding while the wallet activates.
 *
 * Each step is a card. Changing step fades the current card out and the next
 * one in. The last step opens the wallet from its button, after activation
 * has settled.
 */
export function WalletActivationOnboarding({
  open,
  activationSettled,
  onExitComplete,
  intent = "welcome",
  initialTag = "",
  onCreateAccount,
  onSignIn,
}: WalletActivationOnboardingProps) {
  const { language, t } = useWalletLanguage()
  const slides = activationSlides(language)
  const [phase, setPhase] = useState<Phase>(intent === "signup" ? "tag" : "slides")
  const [chosenTag, setChosenTag] = useState(initialTag)
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [recoveryError, setRecoveryError] = useState("")
  const [slideIndex, setSlideIndex] = useState(0)
  const [cardOn, setCardOn] = useState(true)
  const [exitPending, setExitPending] = useState(false)
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null)

  const exitStartedRef = useRef(false)
  const indexRef = useRef(0)
  const cardTimerRef = useRef(0)
  const dialogRef = useRef<HTMLDivElement>(null)

  const goToSlide = useCallback((next: number) => {
    if (exitStartedRef.current) return
    if (next >= WALLET_ACTIVATION_SLIDE_COUNT) {
      if (intent === "signup") return
      setExitPending(true)
      return
    }
    if (next < 0 || next === indexRef.current) return

    const show = (index: number) => {
      indexRef.current = index
      setSlideIndex(index)
      setCardOn(true)
    }

    if (prefersReducedMotion()) {
      show(next)
      return
    }

    setCardOn(false)
    window.clearTimeout(cardTimerRef.current)
    cardTimerRef.current = window.setTimeout(() => show(next), 220)
  }, [intent])

  const startExit = useCallback(() => {
    if (exitStartedRef.current) return
    exitStartedRef.current = true
    setPhase("black")
    const reduced = prefersReducedMotion()
    const wait = reduced ? 0 : BLACK_FADE_MS + WALLET_REVEAL_MS
    window.setTimeout(() => {
      setPhase("done")
      onExitComplete()
    }, wait)
  }, [onExitComplete])

  useEffect(() => {
    if (!open) return
    setPhase(intent === "signup" ? "tag" : "slides")
    setChosenTag(initialTag)
    setRecoveryEmail("")
    setRecoveryError("")
    indexRef.current = 0
    setSlideIndex(0)
    setCardOn(true)
    setExitPending(false)
    exitStartedRef.current = false
    dialogRef.current?.focus()
  }, [open, intent, initialTag])

  useEffect(() => {
    if (exitPending && activationSettled) startExit()
  }, [exitPending, activationSettled, startExit])

  useLayoutEffect(() => {
    if (phase !== "slides") return
    dialogRef.current?.focus()
  }, [phase])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.target instanceof HTMLElement && event.target.closest("button")) {
        if (event.key === "Enter" || event.key === " ") return
      }
      if (event.key === "ArrowRight" || event.key === " " || event.key === "Enter") {
        event.preventDefault()
        goToSlide(indexRef.current + 1)
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        goToSlide(indexRef.current - 1)
      }
    },
    [goToSlide],
  )

  useLayoutEffect(() => {
    setPortalNode(document.body)
  }, [])

  if (!open || phase === "done" || !portalNode) return null

  if (phase === "tag") {
    return createPortal(
      <div className="sozu-night sozu-night-clear fixed inset-0 z-[200] flex justify-center overflow-x-hidden">
        <div className="pointer-events-none absolute inset-0 z-0 bg-[#061018]/45" />
        <SozuTagScreen
          initialTag={chosenTag}
          onContinue={(tag) => {
            setChosenTag(tag)
            setPhase("slides")
          }}
          onHaveTag={(tag) => {
            if (tag) onSignIn?.(tag)
          }}
          onSignIn={(tag) => {
            if (tag) onSignIn?.(tag)
          }}
        />
      </div>,
      portalNode,
    )
  }

  const waitingForActivation = exitPending && !activationSettled
  const safeIndex = Math.min(slideIndex, slides.length - 1)
  const finishingSignup = intent === "signup" && safeIndex === WALLET_ACTIVATION_SLIDE_COUNT - 1
  const cta = finishingSignup
    ? t.onbRecoveryCta
    : activationCta(language, safeIndex === WALLET_ACTIVATION_SLIDE_COUNT - 1)
  const recoveryReady = normalizeRecoveryEmail(recoveryEmail) !== null
  const fadeMs = BLACK_FADE_MS
  const current = slides[safeIndex]

  return createPortal(
    <>
      <div
        className="pointer-events-none fixed inset-0 bg-[#131210] ease-in-out motion-reduce:transition-none"
        style={{
          opacity: phase === "black" ? 1 : 0,
          transitionProperty: "opacity",
          transitionDuration: `${fadeMs}ms`,
          zIndex: 210,
        }}
      />

      <div
        ref={dialogRef}
        className="sozu-night sozu-night-clear fixed inset-0 z-[200] flex w-full touch-manipulation justify-center overflow-x-hidden select-none outline-none"
        role="dialog"
        aria-modal
        aria-label={activationDialogLabel(language)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 z-0 bg-[#061018]/45" />
        <p className="sr-only" aria-live="polite">
          {current?.step}. {current?.title}
        </p>
        <div className="relative z-10 flex h-dvh w-full min-w-0 max-w-[430px] flex-col overflow-x-hidden">
          <header className="px-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 18px)" }}>
            <ProgressPills count={WALLET_ACTIVATION_SLIDE_COUNT} current={safeIndex} label={current?.step} />
          </header>

          <div className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden">
            <section
              className={`absolute inset-0 overflow-y-auto transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                cardOn ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <SlideCopy
                slide={current ?? slides[0]}
                index={safeIndex}
                recovery={
                  intent === "signup" && safeIndex === WALLET_ACTIVATION_SLIDE_COUNT - 1
                    ? {
                        hint: t.onbRecoveryHint,
                        placeholder: t.onbRecoveryPlaceholder,
                        value: recoveryEmail,
                        error:
                          recoveryError ||
                          (recoveryEmail.includes("@") && !recoveryReady ? t.onbRecoveryInvalid : ""),
                        onChange: (value) => {
                          setRecoveryEmail(value)
                          setRecoveryError("")
                        },
                      }
                    : undefined
                }
              />
            </section>
          </div>

          <footer className="px-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}>
            <div className="mx-auto w-full max-w-[342px]">
              <SozuButton
                aria-label={cta}
                aria-busy={waitingForActivation}
                disabled={waitingForActivation || (finishingSignup && !recoveryReady)}
                onClick={() => {
                  if (!finishingSignup) {
                    goToSlide(safeIndex + 1)
                    return
                  }
                  const email = normalizeRecoveryEmail(recoveryEmail)
                  if (!email || !chosenTag) {
                    setRecoveryError(t.onbRecoveryInvalid)
                    return
                  }
                  onCreateAccount?.(chosenTag, email)
                }}
              >
                {cta}
              </SozuButton>
            </div>
          </footer>
        </div>
      </div>
    </>,
    portalNode,
  )
}
