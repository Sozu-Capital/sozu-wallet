"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ChevronLeft, ChevronRight, Copy, LogOut, Plus, X } from "lucide-react"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { CollectibleReceipt } from "@/components/merch/collectible-receipt"
import { BadgePopup, SouvenirPopup } from "@/components/merch/souvenir-popup"
import { SouvenirList, type SouvenirListItem } from "@/components/merch/souvenir-list"
import { SozuShaderAvatar } from "@/components/ui/sozu-shader-avatar"
import { readSavedPurchases, type SavedPurchase } from "@/lib/checkout/saved-purchases"
import type { CollectibleSouvenir } from "@/lib/merch/catalog"
import { claimEventSouvenir, fetchAccountSouvenirs } from "@/lib/merch/claim-souvenir"
import { merchCopy } from "@/lib/merch/copy"
import { profileSouvenirs, readClaimedSouvenirs, type ClaimedSouvenir, type HeldSouvenir } from "@/lib/merch/souvenirs"
import { useWalletLanguage } from "@/lib/wallet-language"

interface WalletSwitcherModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string | null
  walletNetwork: "testnet" | "mainnet"
  sozuTag?: string | null
}

function abbrev(address: string | null): string {
  if (!address || address.length < 12) return address ?? "—"
  return `${address.slice(0, 6)}···${address.slice(-6)}`
}

function WalletAvatar({ address, tag }: { address: string | null; tag?: string | null }) {
  const seed = address ?? "default"
  const initials = tag
    ? tag.replace(/^[@$]/, "").slice(0, 2).toUpperCase()
    : seed.slice(1, 3).toUpperCase()

  return (
    <SozuShaderAvatar className="h-16 w-16 shrink-0 rounded-2xl text-[17px] font-bold">
      {initials}
    </SozuShaderAvatar>
  )
}

export function WalletSwitcherModal({
  isOpen,
  onClose,
  walletAddress,
  walletNetwork,
  sozuTag,
}: WalletSwitcherModalProps) {
  const [copied, setCopied] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [showProHint, setShowProHint] = useState(false)
  const [view, setView] = useState<"wallets" | "souvenirs">("wallets")
  const [purchases, setPurchases] = useState<SavedPurchase[]>([])
  const [claims, setClaims] = useState<ClaimedSouvenir[]>([])
  const [catalog, setCatalog] = useState<readonly CollectibleSouvenir[]>([])
  const [openSouvenir, setOpenSouvenir] = useState<HeldSouvenir | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const { language } = useWalletLanguage()
  const copy = merchCopy(language === "en" ? "en" : "es")
  const lang = language === "en" ? "en" : "es"
  const { held, claimable } = profileSouvenirs({
    purchases,
    claims,
    catalog,
    language: lang,
    network: walletNetwork,
  })
  const souvenirItems: SouvenirListItem[] = [
    ...held.map((item) =>
      item.kind === "receipt"
        ? {
            id: item.id,
            kind: "receipt" as const,
            name: item.name,
            drop: item.drop,
            imageUrl: item.receipt.imageUrl,
          }
        : { id: item.id, kind: "badge" as const, name: item.name, drop: item.drop, imagePath: item.imagePath },
    ),
    ...claimable.map((item) => ({
      id: `claim:${item.slug}`,
      kind: "claim" as const,
      name: item.name,
      drop: item.drop,
      imagePath: item.imagePath,
      claimLabel: copy.claimSouvenir,
      signingLabel: copy.claimWithWallet,
    })),
  ]

  const handleAddWallet = useCallback(() => {
    setShowProHint(true)
    setTimeout(() => {
      setShowProHint(false)
      window.open("https://sozu.capital/pricing", "_blank", "noopener,noreferrer")
    }, 1400)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!walletAddress) return
    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* ignore */ }
  }, [walletAddress])

  const handleSignOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      const supabase = createSupabaseClient()
      await supabase.auth.signOut()
    } catch { /* continue regardless */ } finally {
      const { clearClientSession } = await import("@/lib/storage/clear-session")
      clearClientSession()
      window.location.replace("/auth")
    }
  }, [signingOut])

  const displayName = sozuTag
    ? sozuTag.startsWith("$") ? sozuTag : `$${sozuTag}`
    : abbrev(walletAddress)

  // Portal to body so fixed positioning isn't trapped by the shell's translateX
  // stacking context (otherwise the bottom nav dots paint above this sheet).
  // Store the element — never pass a bare document.body during HMR / early mount
  // (createPortal throws "Target container is not a DOM element").
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setPortalEl(document.body)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setView("wallets")
      setOpenSouvenir(null)
      setClaimError(null)
      return
    }
    setPurchases(readSavedPurchases())
    setClaims(readClaimedSouvenirs(walletAddress))
    setCatalog([])
    void fetchAccountSouvenirs().then((remote) => {
      if (!remote) return
      setCatalog(remote.catalog)
      setClaims(remote.claims)
    })
  }, [isOpen, walletAddress])

  const handleSouvenirSelect = useCallback(
    async (id: string) => {
      const heldItem = held.find((item) => item.id === id)
      if (heldItem) {
        setOpenSouvenir(heldItem)
        return
      }
      const claim = claimable.find((item) => `claim:${item.slug}` === id)
      if (!claim || !walletAddress || claimingId) return
      setClaimingId(id)
      setClaimError(null)
      try {
        const saved = await claimEventSouvenir({ souvenir: claim, walletAddress })
        if (saved) {
          setClaims((current) => {
            const slug = saved.slug.trim().toLowerCase()
            return [saved, ...current.filter((row) => row.slug.trim().toLowerCase() !== slug)]
          })
        }
      } catch (error) {
        setClaimError(error instanceof Error && error.message === "claim_closed" ? copy.claimClosed : copy.claimFailed)
      } finally {
        setClaimingId(null)
      }
    },
    [claimable, claimingId, copy.claimClosed, copy.claimFailed, held, walletAddress],
  )

  if (!portalEl) return null

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          {/* Backdrop — semi-transparent so the wallet shader shows through */}
          <motion.div
            key="wsm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet — draggable downward to dismiss */}
          <motion.div
            key="wsm-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.28 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 450) onClose()
            }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[81] mx-auto flex max-w-sm flex-col rounded-t-[32px]"
            style={{
              height: "60vh",
              paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
              background: "rgb(10, 10, 11)",
            }}
          >
            {/* Drag handle — visual affordance */}
            <div className="mx-auto mt-3 mb-1 h-[3px] w-10 shrink-0 rounded-full bg-white/[0.14] cursor-grab active:cursor-grabbing" />

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                {view === "souvenirs" ? (
                  <button
                    type="button"
                    onClick={() => setView("wallets")}
                    aria-label={copy.back}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-white/55 hover:text-white/80 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                ) : null}
                <p className="truncate text-[13px] font-medium tracking-wider text-white/40 uppercase">
                  {view === "souvenirs" ? copy.souvenirs : "Mis billeteras"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-white/35 hover:text-white/70 transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-3 px-4 overflow-hidden">
              {view === "souvenirs" ? (
                <>
                  {claimError ? <p className="px-1 text-sm text-red-300">{claimError}</p> : null}
                  <SouvenirList
                    label={copy.souvenirs}
                    items={souvenirItems}
                    emptyLabel={copy.emptySouvenirs}
                    onSelect={(id) => void handleSouvenirSelect(id)}
                    claimingId={claimingId}
                  />
                </>
              ) : (
              <>
              {/* Active wallet card */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <button
                  type="button"
                  onClick={() => setView("souvenirs")}
                  aria-label={copy.openSouvenirs}
                  className="flex w-full items-start gap-4 text-left"
                >
                  <WalletAvatar address={walletAddress} tag={sozuTag} />

                  <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                    <p className="text-[16px] font-bold text-white leading-tight truncate">
                      {displayName}
                    </p>
                    <p className="font-mono text-[11px] text-white/30 truncate">
                      {abbrev(walletAddress)}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-bold tracking-[0.12em] uppercase text-violet-300">
                        Beta
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold tracking-[0.10em] uppercase text-emerald-400">
                        <Check className="h-2.5 w-2.5" />
                        Activa
                      </span>
                      {walletNetwork === "testnet" && (
                        <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-[9px] font-bold tracking-[0.10em] uppercase text-yellow-400/80">
                          Testnet
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/30" aria-hidden />
                </button>

                <div className="my-4 h-px bg-white/[0.06]" />

                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-white/20">Stellar Network</span>
                  <button
                    onClick={handleCopy}
                    disabled={!walletAddress}
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-white/35 hover:bg-white/[0.11] hover:text-white/65 transition-colors disabled:opacity-30"
                    aria-label="Copiar dirección"
                  >
                    {copied ? (
                      <><Check className="h-3 w-3 text-emerald-400" /><span className="text-[11px] text-emerald-400">Copiado</span></>
                    ) : (
                      <><Copy className="h-3 w-3" /><span className="text-[11px]">Copiar</span></>
                    )}
                  </button>
                </div>
              </div>

              {/* Add wallet card */}
              <motion.button
                onClick={handleAddWallet}
                whileTap={{ scale: 0.97 }}
                className="rounded-2xl p-5 text-left transition-colors"
                style={{
                  background: showProHint
                    ? "rgba(251,191,36,0.08)"
                    : "rgba(255,255,255,0.03)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition-colors"
                    style={{
                      background: showProHint
                        ? "rgba(251,191,36,0.10)"
                        : "rgba(255,255,255,0.05)",
                    }}
                  >
                    <Plus
                      className="h-6 w-6 transition-colors"
                      style={{ color: showProHint ? "rgba(251,191,36,0.6)" : "rgba(255,255,255,0.15)" }}
                    />
                  </div>
                  <div className="flex flex-col gap-1 pt-0.5">
                    <p
                      className="text-[16px] font-bold leading-tight transition-colors"
                      style={{ color: showProHint ? "rgba(251,191,36,0.75)" : "rgba(255,255,255,0.20)" }}
                    >
                      Agregar billetera
                    </p>
                    <p
                      className="text-[11px] transition-colors"
                      style={{ color: showProHint ? "rgba(251,191,36,0.55)" : "rgba(255,255,255,0.15)" }}
                    >
                      {showProHint
                        ? "Abriendo planes Pro…"
                        : "Función para cuenta Pro"}
                    </p>
                    <div className="mt-1.5">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.12em] uppercase transition-colors"
                        style={{
                          background: showProHint ? "rgba(251,191,36,0.15)" : "rgba(251,191,36,0.08)",
                          color: showProHint ? "rgba(251,191,36,0.9)" : "rgba(251,191,36,0.45)",
                        }}
                      >
                        Pro
                      </span>
                    </div>
                  </div>
                </div>
              </motion.button>

              <div className="flex-1" />
              </>
              )}
            </div>

            {/* Sign out — white text, clearly visible */}
            <div className="shrink-0 px-4 pt-2">
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-white/80 font-medium transition-colors hover:text-white disabled:opacity-40"
                style={{ background: "rgba(239,68,68,0.13)" }}
              >
                <LogOut className="h-4 w-4 shrink-0 text-red-400" />
                <span className="text-[14px]">
                  {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
                </span>
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
      {openSouvenir?.kind === "badge" ? (
        <BadgePopup
          name={openSouvenir.name}
          drop={openSouvenir.drop}
          imagePath={openSouvenir.imagePath}
          onClose={() => setOpenSouvenir(null)}
        />
      ) : null}
      {openSouvenir?.kind === "receipt" ? (
        <SouvenirPopup label={openSouvenir.name} onClose={() => setOpenSouvenir(null)}>
          <div data-souvenir-popup="receipt">
            <CollectibleReceipt model={openSouvenir.receipt} />
          </div>
        </SouvenirPopup>
      ) : null}
    </AnimatePresence>,
    portalEl,
  )
}
