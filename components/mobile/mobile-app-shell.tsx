"use client"

import dynamic from "next/dynamic"
import { Suspense, useState, useCallback, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useHorizontalPanelSwipe } from "@/hooks/use-horizontal-panel-swipe"
import { useAppViewportLock } from "@/hooks/use-app-viewport-lock"
import { SmartAccountKitProvider } from "@/components/SmartAccountKitProvider"
import { WalletDataProvider } from "@/components/wallet/wallet-data-provider"
import { WalletLanguageProvider } from "@/lib/wallet-language"
import { signalBootstrapReady } from "@/lib/app-ready"
import { PANEL_NAMES, panelIndex } from "@/lib/shell/panels"
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
  const [historyMounted, setHistoryMounted] = useState(false)
  const [collectionsMounted, setCollectionsMounted] = useState(false)
  const panelParamConsumedRef = useRef(false)

  useEffect(() => {
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

  const goLeft = useCallback(() => {
    setActivePanel(p => Math.max(0, p - 1))
  }, [])

  const goRight = useCallback(() => {
    setActivePanel(p => Math.min(PANEL_NAMES.length - 1, p + 1))
  }, [])

  const swipeHandlers = useHorizontalPanelSwipe({
    onSwipeLeft: goRight,
    onSwipeRight: goLeft,
    disabled: isSendModalOpen || isDepositModalOpen || isOnboardingOverlayOpen,
  })

  const translateX = -((100 / PANEL_NAMES.length) * activePanel)

  return (
        <div
          className={`sozu-app-shell sozu-app-viewport overscroll-none select-none touch-pan-x ${
            isSendModalOpen || isDepositModalOpen
              ? "cursor-default"
              : "cursor-grab active:cursor-grabbing"
          }`}
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={swipeHandlers.onTouchEnd}
      onMouseDown={swipeHandlers.onMouseDown}
      onMouseMove={swipeHandlers.onMouseMove}
      onMouseUp={swipeHandlers.onMouseUp}
      onMouseLeave={swipeHandlers.onMouseLeave}
    >
      <div
        className="flex h-full overflow-hidden"
        style={{
          width: `${PANEL_NAMES.length * 100}%`,
          transform: `translateX(${translateX}%)`,
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: "transform",
        }}
      >
        {/* Panel 0 — Settings (lazy: only mount when visited) */}
        <div
          className="h-full overflow-y-auto overscroll-none no-scrollbar"
          style={{ width: `${100 / PANEL_NAMES.length}%` }}
        >
          {activePanel === 0 ? (
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
              <CollectionsPanel onLeavePrevious={goLeft} />
            </Suspense>
          ) : null}
        </div>
      </div>

      {!isOnboardingOverlayOpen ? (
        <nav
          aria-label="Wallet panels"
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5"
        >
          {PANEL_NAMES.map((name, i) => {
            const active = i === activePanel
            return (
              <button
                key={name}
                type="button"
                onClick={() => setActivePanel(i)}
                aria-label={name}
                aria-current={active ? "page" : undefined}
                className="flex h-5 w-5 items-center justify-center"
              >
                <span
                  className={`block h-1 rounded-full transition-all duration-300 ${
                    active ? "w-5 bg-white/70" : "w-1 bg-white/25"
                  }`}
                />
              </button>
            )
          })}
        </nav>
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
