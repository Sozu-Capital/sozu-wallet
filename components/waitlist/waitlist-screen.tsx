"use client"

import dynamic from "next/dynamic"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type RefObject,
} from "react"
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion"
import { WaitlistCornerWash } from "@/components/waitlist/corner-wash"
import { RotatingStatements } from "@/components/waitlist/rotating-statements"
import { SozuMark } from "@/components/waitlist/sozu-mark"
import { WaitlistForm, type WaitlistStatus } from "@/components/waitlist/waitlist-form"
import { WaitlistManifesto } from "@/components/waitlist/waitlist-manifesto"
import { signalBootstrapReady } from "@/lib/app-ready"
import type { WaitlistLocale } from "@/lib/waitlist/signup"

const WaitlistShader = dynamic(
  () => import("@/components/waitlist/waitlist-shader").then((mod) => mod.WaitlistShader),
  { ssr: false },
)

const DitherHelixCarousel = dynamic(
  () => import("@/components/ui/dither-helix-carousel").then((mod) => mod.DitherHelixCarousel),
  { ssr: false },
)

/** Newest first. Captions state what happened; the pictures are not news photographs. */
const CRISES = [
  {
    image: "/waitlist/crises/paraguay.jpg",
    es: "Paraguay, 2026. Ueno cerró. Millones no pudieron usar su plata.",
    en: "Paraguay, 2026. Ueno closed. Millions couldn't reach their money.",
  },
  {
    image: "/waitlist/crises/lebanon.jpg",
    es: "Líbano, 2019. Los bancos dejaron los dólares adentro.",
    en: "Lebanon, 2019. The banks kept the dollars inside.",
  },
  {
    image: "/waitlist/crises/venezuela.jpg",
    es: "Venezuela, 2018. La inflación borró los ahorros.",
    en: "Venezuela, 2018. Inflation erased people's savings.",
  },
  {
    image: "/waitlist/crises/cyprus.jpg",
    es: "Chipre, 2013. Cerraron los bancos y recortaron depósitos.",
    en: "Cyprus, 2013. The banks shut, and deposits were cut.",
  },
  {
    image: "/waitlist/crises/argentina.jpg",
    es: "Argentina, 2001. El corralito congeló los ahorros.",
    en: "Argentina, 2001. The corralito froze savings.",
  },
  {
    image: "/waitlist/crises/chile.jpg",
    es: "Chile, 1982. El dólar fijo se rompió. Las deudas no.",
    en: "Chile, 1982. The dollar peg broke. The debts didn't.",
  },
] as const

const CRISIS_FRONT = Math.floor(CRISES.length / 2)

/** Same key the wallet uses, so a visitor's language carries over once the app reopens. */
const LANGUAGE_STORAGE_KEY = "sozu_app_language:v2"

/** Exponential camera push. 60× from inside the ribbon covers both phone and laptop. */
const DIVE_SCALE = 60

const SPRING = { stiffness: 640, damping: 64, mass: 0.08, restDelta: 0.0004 }

const COPY = {
  es: {
    statements: [
      "Despierta...",
      "Dólares digitales en tu bolsillo.",
      "Paga a cualquiera con un toque.",
      "Tus llaves. Tu dinero.",
      "Los primeros ganan.",
    ],
    manifesto: [
      "Si otro tiene la llave, el dinero no es tuyo.",
      "El dinero programable vive en la cadena.",
      "Se mueve de persona a persona, sin un banco en el medio.",
      "Así son las finanzas descentralizadas.",
      "Tus activos. Tus llaves.",
    ],
    placeholder: "tu@correo.com",
    submit: "Unirme",
    success: "Estás dentro.",
    invalid: "Revisa tu correo.",
    failed: "No pudimos guardarlo. Intenta de nuevo.",
  },
  en: {
    statements: [
      "Wake up...",
      "Digital dollars in your pocket.",
      "Pay anyone with a tap.",
      "Your keys. Your money.",
      "Early users get rewarded.",
    ],
    manifesto: [
      "If someone else holds the key, the money isn't yours.",
      "Programmable money lives on the chain.",
      "It moves from person to person, with no bank in between.",
      "That is decentralized finance.",
      "Your assets. Your keys.",
    ],
    placeholder: "you@email.com",
    submit: "Join",
    success: "You're in.",
    invalid: "Check your email.",
    failed: "We couldn't save it. Try again.",
  },
} as const satisfies Record<
  WaitlistLocale,
  { statements: readonly string[]; manifesto: readonly string[] } & Record<string, unknown>
>

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function readAppHeight() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--sozu-app-height").trim()
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : Math.round(window.innerHeight)
}

/**
 * Keep the window from scrolling while the top field is focused.
 * iOS Safari scrolls focused inputs into view, which would scrub the dive
 * as the keyboard opens. A transform lifts the field above the keyboard instead.
 */
function useTopFormKeyboardGuard(formRef: RefObject<HTMLDivElement | null>) {
  const [lift, setLift] = useState(0)

  useEffect(() => {
    const node = formRef.current
    if (!node) return

    let locked = false
    let lockedY = 0
    let frame = 0

    const setLiftIfChanged = (next: number) => {
      setLift((current) => (current === next ? current : next))
    }

    const measure = () => {
      const viewport = window.visualViewport
      if (!viewport || !node.contains(document.activeElement)) {
        setLiftIfChanged(0)
        return
      }
      const rect = node.getBoundingClientRect()
      const visibleBottom = viewport.offsetTop + viewport.height
      const overlap = Math.round(rect.bottom + 16 - visibleBottom)
      setLiftIfChanged(overlap > 0 ? overlap : 0)
    }

    const holdScroll = () => {
      cancelAnimationFrame(frame)
      const started = performance.now()
      const tick = () => {
        if (!locked) return
        if (window.scrollY !== lockedY) window.scrollTo(0, lockedY)
        if (performance.now() - started < 900) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    const onFocusIn = () => {
      locked = true
      lockedY = window.scrollY
      holdScroll()
      measure()
    }

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget
      if (next instanceof Node && node.contains(next)) return
      locked = false
      cancelAnimationFrame(frame)
      setLiftIfChanged(0)
    }

    const onScroll = () => {
      if (!locked || window.scrollY === lockedY) return
      window.scrollTo(0, lockedY)
    }

    const onViewport = () => {
      if (!locked) return
      if (window.scrollY !== lockedY) window.scrollTo(0, lockedY)
      measure()
    }

    node.addEventListener("focusin", onFocusIn)
    node.addEventListener("focusout", onFocusOut)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.visualViewport?.addEventListener("resize", onViewport)
    window.visualViewport?.addEventListener("scroll", onViewport)

    return () => {
      node.removeEventListener("focusin", onFocusIn)
      node.removeEventListener("focusout", onFocusOut)
      window.removeEventListener("scroll", onScroll)
      window.visualViewport?.removeEventListener("resize", onViewport)
      window.visualViewport?.removeEventListener("scroll", onViewport)
      cancelAnimationFrame(frame)
    }
  }, [formRef])

  return lift
}

export function WaitlistScreen() {
  const [locale, setLocale] = useState<WaitlistLocale>("es")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [status, setStatus] = useState<WaitlistStatus>("idle")
  const [stagePx, setStagePx] = useState<number | null>(null)
  const [shaderOn, setShaderOn] = useState(true)
  const [restLive, setRestLive] = useState(true)
  const diveRef = useRef<HTMLDivElement>(null)
  const topFormRef = useRef<HTMLDivElement>(null)
  const shaderOnRef = useRef(true)
  const restLiveRef = useRef(true)
  const reducedMv = useMotionValue(0)
  const lift = useTopFormKeyboardGuard(topFormRef)
  const t = COPY[locale]

  const { scrollYProgress } = useScroll({
    target: diveRef,
    offset: ["start start", "end end"],
  })
  const progress = useSpring(scrollYProgress, SPRING)

  const closeScale = useMotionValue(1)
  const closeBlur = useMotionValue(0)
  const closeRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: galleryScroll } = useScroll({
    target: galleryRef,
    offset: ["start start", "end end"],
  })
  const gallerySmooth = useSpring(galleryScroll, SPRING)
  const galleryGoal = useTransform(gallerySmooth, [0, 1], [-CRISIS_FRONT, -CRISIS_FRONT + CRISES.length - 1])
  const { scrollYProgress: closeScroll } = useScroll({
    target: closeRef,
    offset: ["start end", "start start"],
  })
  const closeOpacity = useTransform([closeScroll, reducedMv], ([value, reduced]) => {
    if (reduced) return 1
    return clamp01(((value as number) - 0.72) / 0.28)
  })
  const galleryMask = useTransform([progress, reducedMv], ([value, reduced]) => {
    if (reduced) return "none"
    const amount = clamp01(value as number)
    if (amount >= 0.99) return "none"
    const t = clamp01((amount - 0.68) / 0.31)
    const fade = (1 - t) * 34
    const rx = 54 + t * 110
    const ry = 48 + t * 110
    const solid = 24 + t * 76
    const edge = Math.min(100, 52 + t * 48)
    return `linear-gradient(to bottom, transparent 0%, #000 ${fade}%, #000 100%), radial-gradient(ellipse ${rx}% ${ry}% at 50% 62%, #000 ${solid}%, transparent ${edge}%)`
  })

  const restOpacity = useTransform([progress, reducedMv], ([value, reduced]) => {
    const end = reduced ? 0.85 : 0.4
    return 1 - clamp01((value as number) / end)
  })
  const restBlur = useTransform([progress, reducedMv], ([value, reduced]) => {
    if (reduced) return 0
    return clamp01((value as number) / 0.4) * 12
  })
  const restFilter = useTransform(restBlur, (px) => `blur(${px}px)`)
  const markOpacity = useTransform([restOpacity, reducedMv], ([opacity, reduced]) =>
    reduced ? (opacity as number) : 1,
  )
  const scale = useTransform([progress, reducedMv], ([value, reduced]) => {
    if (reduced) return 1
    const amount = clamp01(value as number)
    return amount <= 0 ? 1 : DIVE_SCALE ** amount
  })
  const edgeBlur = useTransform([progress, reducedMv], ([value, reduced]) => {
    if (reduced) return 0
    return Math.sin(clamp01(value as number) * Math.PI) * 1.35
  })
  const veilOpacity = useTransform([progress, reducedMv], ([value, reduced]) =>
    reduced ? clamp01((value as number) / 0.85) : 0,
  )

  useMotionValueEvent(progress, "change", (value) => {
    const reduced = reducedMv.get() > 0.5
    const fadeEnd = reduced ? 0.85 : 0.4
    const shaderNext = shaderOnRef.current ? value < fadeEnd + 0.05 : value < fadeEnd
    if (shaderNext !== shaderOnRef.current) {
      shaderOnRef.current = shaderNext
      setShaderOn(shaderNext)
    }
    const liveNext = restLiveRef.current ? value < fadeEnd - 0.04 : value < fadeEnd - 0.1
    if (liveNext !== restLiveRef.current) {
      restLiveRef.current = liveNext
      setRestLive(liveNext)
    }
  })

  const formLift = lift > 0 ? `translate3d(0, ${-lift}px, 0)` : undefined
  const stageStyle: CSSProperties | undefined = stagePx
    ? ({ "--waitlist-stage": `${stagePx}px` } as CSSProperties)
    : undefined

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const syncReduced = () => reducedMv.set(media.matches ? 1 : 0)
    syncReduced()
    media.addEventListener("change", syncReduced)

    const root = document.documentElement
    const previousOverscroll = root.style.overscrollBehaviorY
    root.style.overscrollBehaviorY = "none"

    let width = window.innerWidth
    const syncStage = () => setStagePx(readAppHeight())
    syncStage()
    const onResize = () => {
      if (topFormRef.current?.contains(document.activeElement)) return
      if (window.innerWidth === width) return
      width = window.innerWidth
      syncStage()
    }
    window.addEventListener("resize", onResize)
    window.addEventListener("orientationchange", onResize)

    return () => {
      media.removeEventListener("change", syncReduced)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("orientationchange", onResize)
      root.style.overscrollBehaviorY = previousOverscroll
    }
  }, [reducedMv])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (stored === "en" || stored === "es") setLocale(stored)
    } catch {
      // private browsing
    }
    signalBootstrapReady()
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  function changeLocale(next: WaitlistLocale) {
    setLocale(next)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    } catch {
      // private browsing
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === "submitting") return
    setStatus("submitting")
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, company }),
      })
      if (response.ok) {
        setStatus("done")
        return
      }
      setStatus(response.status === 400 ? "invalid" : "failed")
    } catch {
      setStatus("failed")
    }
  }

  function onEmail(value: string) {
    setEmail(value)
    if (status === "invalid" || status === "failed") setStatus("idle")
  }

  const message = status === "invalid" ? t.invalid : status === "failed" ? t.failed : null
  const formProps = {
    email,
    company,
    status,
    placeholder: t.placeholder,
    submitLabel: t.submit,
    success: t.success,
    message,
    onEmail,
    onCompany: setCompany,
    onSubmit,
  }

  return (
    <main className="relative z-[1] bg-black text-white" style={{ overflowAnchor: "none", ...stageStyle }}>
      <div ref={diveRef} className="waitlist-dive">
        <div className="waitlist-stage sticky top-0 overflow-hidden bg-black">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-white"
            style={{ opacity: veilOpacity }}
          />

          <motion.div className="pointer-events-none absolute inset-0 z-[1]" style={{ opacity: restOpacity, filter: restFilter }}>
            {shaderOn ? <WaitlistShader /> : null}
            <WaitlistCornerWash tone="light" />
          </motion.div>

          <div className="relative z-[2] flex h-full items-center justify-center">
            <div className="flex w-full max-w-sm flex-col items-center px-6 text-center">
              <div className="h-40 w-40 -translate-x-[2%] translate-y-[7%] sm:h-48 sm:w-48">
                <motion.div className="waitlist-mark h-full w-full" style={{ opacity: markOpacity }}>
                  <SozuMark
                    className="pointer-events-none block h-full w-full overflow-visible text-white"
                    scale={scale}
                    edgeBlur={edgeBlur}
                  />
                </motion.div>
              </div>

              <motion.div className="w-full" style={{ opacity: restOpacity, filter: restFilter }}>
                <div className="mt-6">
                  <RotatingStatements statements={t.statements} />
                </div>
                <div
                  ref={topFormRef}
                  className="mt-8 w-full"
                  style={{ transform: formLift }}
                  inert={restLive ? undefined : true}
                >
                  <WaitlistForm id="waitlist-email" tone="dark" {...formProps} />
                </div>
              </motion.div>
            </div>
          </div>

          <motion.div
            className="pointer-events-none absolute inset-0 z-[3]"
            style={{ opacity: restOpacity, filter: restFilter }}
            inert={restLive ? undefined : true}
            aria-hidden={restLive ? undefined : true}
          >
            <div className="pointer-events-auto absolute right-0 top-0 flex gap-1 p-[max(1rem,env(safe-area-inset-top))] text-[11px] font-light tracking-[0.14em]">
              {(["es", "en"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => changeLocale(option)}
                  aria-pressed={locale === option}
                  className={`rounded-full px-2.5 py-1 uppercase transition-colors ${
                    locale === option ? "text-white" : "text-white/45 hover:text-white/80"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div
              aria-hidden
              className="absolute inset-x-0 flex justify-center"
              style={{ bottom: "max(2.75rem, calc(env(safe-area-inset-bottom) + 2rem))" }}
            >
              <span className="waitlist-scroll-hint block h-8 w-px bg-white/80" />
            </div>

            <p className="absolute bottom-0 left-0 right-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-[10px] font-extralight tracking-[0.3em] text-white/50">
              SOZU CAPITAL
            </p>
          </motion.div>
        </div>
      </div>

      <section className="waitlist-ink relative z-10 text-black">
        <div ref={galleryRef} className="waitlist-gallery">
          <motion.div
            className="waitlist-gallery-stage"
            style={{
              maskImage: galleryMask,
              WebkitMaskImage: galleryMask,
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
          >
            <DitherHelixCarousel
              items={CRISES.map((item) => ({ image: item.image, title: item[locale] }))}
              scrollProgress={galleryGoal}
              entry={false}
              cardRatio={4 / 3}
              cell={8}
              focusBand={0.32}
              accent="#0a0a0a"
              aria-label={locale === "es" ? "Cuando el banco tenía la llave." : "When the bank held the key."}
              className="h-full bg-white text-black"
            />
          </motion.div>
        </div>
        <div className="bg-white">
          <WaitlistManifesto lines={t.manifesto} />
          <div
            ref={closeRef}
            className="flex items-center justify-center bg-white"
            style={{ height: "var(--waitlist-stage, var(--sozu-app-height, 100lvh))" }}
          >
            <motion.div
              className="flex w-full max-w-sm flex-col items-center px-6"
              style={{ opacity: closeOpacity }}
            >
              <div aria-hidden className="h-40 w-40 -translate-x-[2%] translate-y-[7%] sm:h-48 sm:w-48">
                <SozuMark
                  className="pointer-events-none block h-full w-full overflow-visible text-black"
                  scale={closeScale}
                  edgeBlur={closeBlur}
                />
              </div>
              <div className="mt-10 w-full">
                <WaitlistForm id="waitlist-email-ink" tone="light" {...formProps} />
              </div>
              <p className="mt-8 text-center text-[10px] font-extralight tracking-[0.3em] text-black/45">
                SOZU CAPITAL
              </p>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  )
}
