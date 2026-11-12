"use client"

import dynamic from "next/dynamic"
import { Suspense, useState, useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useHorizontalPanelSwipe } from "@/hooks/use-horizontal-panel-swipe"
import { useAppViewportLock } from "@/hooks/use-app-viewport-lock"
import { PanelDots } from "@/components/mobile/panel-dots"
import { SmartAccountKitProvider } from "@/components/SmartAccountKitProvider"
import { WalletDataProvider } from "@/components/wallet/wallet-data-provider"
import { WalletLanguageProvider } from "@/lib/wallet-language"
import { signalBootstrapReady } from "@/lib/app-ready"
import { PANEL_NAMES, panelIndex } from "@/lib/shell/panels"
import {
  followOffset,
  nextPanelIndex,
  releaseMotion,
  springStep,
} from "@/lib/shell/panel-motion"
import {
  OnboardingOverlayProvider,
  useOnboardingOverlay,
} from "@/lib/onboarding-overlay-context"
// Static import: landing panel is always mounted, so paying the dynamic chunk
// cost on cold start would delay the first paint unnecessarily.
import { WalletScreen } from "@/components/wallet/wallet-screen"

const SettingsPanel = dynamic(
  () => import("@/app/settings/page").then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => null },
)

// History panel lazy-loads — only needed after the user swipes right.
const WalletScreenHistory = dynamic(
  () => import("@/components/wallet/wallet-screen").then((mod) => ({ default: mod.WalletScreen })),
  { ssr: false },
)

const CollectionsPanel = dynamic(
  () => import("@/components/merch/collections-panel").then((mod) => ({ default: mod.CollectionsPanel })),
  { ssr: false },
)

function MobileAppShellPanels() {
  const { isOnboardingOverlayOpen } = useOnboardingOverlay()
  const searchParams = useSearchParams()
  const [activePanel, setActivePanel] = useState(() => panelIndex(searchParams?.get("panel")))
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
  const [settingsMounted, setSettingsMounted] = useState(() => activePanel === 0)
  const [historyMounted, setHistoryMounted] = useState(false)
  const [collectionsMounted, setCollectionsMounted] = useState(false)
  const [fading, setFading] = useState(false)
  const panelParamConsumedRef = useRef(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(0)
  const indexRef = useRef(activePanel)
  const reducedRef = useRef(false)
  const modeRef = useRef<"idle" | "drag" | "spring" | "fade">("idle")
  const rafRef = useRef(0)
  const fadeTimerRef = useRef(0)
  const shownRef = useRef(0)
  const dragOriginRef = useRef<number | null>(null)

  useEffect(() => {
    if (activePanel === 0) setSettingsMounted(true)
    if (activePanel === 2) setHistoryMounted(true)
    if (activePanel === 3) setCollectionsMounted(true)
  }, [activePanel])

  useAppViewportLock()

  useEffect(() => {
    if (panelParamConsumedRef.current) return
    const panel = searchParams?.get("panel")
    if (!panel) return

    panelParamConsumedRef.current = true
    setActivePanel(panelIndex(panel))

    const url = new URL(window.location.href)
    if (!url.searchParams.has("panel")) return
    url.searchParams.delete("panel")
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, "", next)
  }, [searchParams])

  // Bootstrap gate on /home signals ready after auth; other wallet routes signal here.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname === "/home") return

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        signalBootstrapReady()
      })
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [])

  const place = useCallback((px: number) => {
    shownRef.current = px
    const track = trackRef.current
    if (!track) return
    track.style.transform = `translate3d(${px}px,0,0)`
  }, [])

  const baseX = useCallback((index = indexRef.current) => -index * widthRef.current, [])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    const measure = () => {
      widthRef.current = shell.clientWidth
      if (modeRef.current === "idle") place(baseX())
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(shell)
    return () => observer.disconnect()
  }, [baseX, place])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => {
      reducedRef.current = media.matches
    }
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.clearTimeout(fadeTimerRef.current)
    }
  }, [])

  const fadeTo = useCallback(
    (index: number) => {
      modeRef.current = "fade"
      indexRef.current = index
      cancelAnimationFrame(rafRef.current)
      if (index === 0) setSettingsMounted(true)
      if (index === 2) setHistoryMounted(true)
      if (index === 3) setCollectionsMounted(true)
      setFading(true)
      window.clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = window.setTimeout(() => {
        setActivePanel(index)
        place(-index * widthRef.current)
        setFading(false)
        modeRef.current = "idle"
      }, 160)
    },
    [place],
  )

  const springTo = useCallback(
    (index: number, from: number) => {
      modeRef.current = "spring"
      cancelAnimationFrame(rafRef.current)
      indexRef.current = index
      if (index === 0) setSettingsMounted(true)
      if (index === 2) setHistoryMounted(true)
      if (index === 3) setCollectionsMounted(true)
      setActivePanel(index)
      let x = from
      let v = 0
      let last = performance.now()
      const tick = (now: number) => {
        const to = -index * widthRef.current
        const dt = Math.min(0.032, (now - last) / 1000)
        last = now
        const next = springStep({ x, v }, to, dt)
        x = next.x
        v = next.v
        place(x)
        if (Math.abs(x - to) < 0.5 && Math.abs(v) < 8) {
          place(to)
          modeRef.current = "idle"
          return
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [place],
  )

  const moveTo = useCallback(
    (index: number, from: number) => {
      if (releaseMotion(reducedRef.current) === "fade") {
        if (index === indexRef.current) {
          window.clearTimeout(fadeTimerRef.current)
          setFading(false)
          modeRef.current = "idle"
          place(-index * widthRef.current)
          return
        }
        fadeTo(index)
        return
      }
      springTo(index, from)
    },
    [fadeTo, place, springTo],
  )

  const swipeHandlers = useHorizontalPanelSwipe({
    disabled: isSendModalOpen || isDepositModalOpen || isOnboardingOverlayOpen,
    onDrag: (dx) => {
      cancelAnimationFrame(rafRef.current)
      if (dragOriginRef.current === null) dragOriginRef.current = shownRef.current
      modeRef.current = "drag"
      const index = indexRef.current
      if (dx > 0 && index === 1) setSettingsMounted(true)
      if (dx < 0 && index === 1) setHistoryMounted(true)
      if (dx > 0 && index === 3) setHistoryMounted(true)
      if (dx < 0 && index === 2) setCollectionsMounted(true)
      place(
        followOffset(
          dragOriginRef.current,
          dx,
          PANEL_NAMES.length,
          widthRef.current || 1,
        ),
      )
    },
    onRelease: ({ dx, velocity }) => {
      dragOriginRef.current = null
      const from = shownRef.current
      const next = nextPanelIndex({
        index: indexRef.current,
        count: PANEL_NAMES.length,
        dx,
        velocity,
        width: widthRef.current || 1,
      })
      moveTo(next, from)
    },
  })

  useLayoutEffect(() => {
    const shell = shellRef.current
    if (shell) widthRef.current = shell.clientWidth
    indexRef.current = activePanel
    if (modeRef.current !== "idle") return
    place(-activePanel * widthRef.current)
  }, [activePanel, place])

  return (
        <div
          ref={shellRef}
          className={`sozu-app-shell sozu-app-viewport overscroll-none select-none touch-pan-y ${
            isSendModalOpen || isDepositModalOpen
              ? "cursor-default"
              : "cursor-grab active:cursor-grabbing"
          } ${fading ? "opacity-0" : "opacity-100"}`}
          style={{ transition: fading || reducedRef.current ? "opacity 160ms linear" : undefined }}
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={swipeHandlers.onTouchEnd}
      onTouchCancel={swipeHandlers.onTouchCancel}
      onMouseDown={swipeHandlers.onMouseDown}
      onMouseMove={swipeHandlers.onMouseMove}
      onMouseUp={swipeHandlers.onMouseUp}
      onMouseLeave={swipeHandlers.onMouseLeave}
    >
      <div
        ref={trackRef}
        className="flex h-full overflow-hidden"
        style={{
          width: `${PANEL_NAMES.length * 100}%`,
          willChange: "transform",
        }}
      >
        {/* Panel 0 — Settings (lazy: only mount when visited) */}
        <div
          className="h-full overflow-y-auto overscroll-none no-scrollbar"
          style={{ width: `${100 / PANEL_NAMES.length}%` }}
        >
          {settingsMounted ? (
            <Suspense fallback={null}>
              <SettingsPanel />
            </Suspense>
          ) : null}
        </div>

        {/* Panel 1 — Landing: balance card + commands (statically imported, critical path) */}
        <div className="h-full overflow-hidden" style={{ width: `${100 / PANEL_NAMES.length}%` }}>
          <WalletScreen
            shellLayout="landing"
            isSendModalOpen={isSendModalOpen}
            onSendModalOpenChange={setIsSendModalOpen}
            isDepositModalOpen={isDepositModalOpen}
            onDepositModalOpenChange={setIsDepositModalOpen}
            hideBottomBar
          />
        </div>

        {/* Panel 2 — Transaction history (lazy: only mounted after first swipe) */}
        <div className="relative h-full overflow-hidden" style={{ width: `${100 / PANEL_NAMES.length}%` }}>
          {historyMounted ? (
            <Suspense fallback={null}>
              <WalletScreenHistory shellLayout="history" hideBottomBar />
            </Suspense>
          ) : null}
        </div>

        <div className="relative h-full overflow-hidden" style={{ width: `${100 / PANEL_NAMES.length}%` }}>
          {collectionsMounted ? (
            <Suspense fallback={null}>
              <CollectionsPanel />
            </Suspense>
          ) : null}
        </div>
      </div>

      {!isOnboardingOverlayOpen ? (
        <PanelDots
          names={PANEL_NAMES}
          active={activePanel}
          onSelect={(index) => {
            dragOriginRef.current = null
            moveTo(index, shownRef.current)
          }}
        />
      ) : null}
    </div>
  )
}

export function MobileAppShell() {
  return (
    <WalletLanguageProvider>
      <SmartAccountKitProvider>
        <WalletDataProvider>
          <OnboardingOverlayProvider>
            <MobileAppShellPanels />
          </OnboardingOverlayProvider>
        </WalletDataProvider>
      </SmartAccountKitProvider>
    </WalletLanguageProvider>
  )
}
