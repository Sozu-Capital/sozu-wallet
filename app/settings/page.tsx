"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { SozuTagCard } from "@/components/settings/sozu-tag-card"
import { AccountSettingsContent } from "@/components/settings/account-settings-content"
import { Coins, Languages } from "lucide-react"
import { loadTreasuryPrefs, saveTreasuryPrefs } from "@/lib/treasury/prefs-storage"
import type { TreasuryPrefs } from "@/lib/treasury/types"
import { REFERENCE_FIAT_OPTIONS } from "@/lib/treasury/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AppLanguageSelector } from "@/components/app-language-selector"
import { useWalletLanguage } from "@/lib/wallet-language"

export default function SettingsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const redirectedRef = useRef(false)
  const { t } = useWalletLanguage()

  useEffect(() => {
    if (redirectedRef.current || pathname !== "/settings") return
    redirectedRef.current = true
    router.replace("/home?panel=settings")
  }, [pathname, router])

  const [settingsView, setSettingsView] = useState<"main" | "profile_settings">("main")

  // Reference fiat only (treasury mode / yield strategy are out of demo settings)
  const [treasuryPrefs, setTreasuryPrefs] = useState<TreasuryPrefs>(() => loadTreasuryPrefs())

  useEffect(() => {
    const storedUsername =
      localStorage.getItem("dev_username") ?? sessionStorage.getItem("dev_username")
    if (!storedUsername) router.push("/auth")
  }, [router])

  if (settingsView === "profile_settings") {
    return (
      <div className="min-h-screen bg-transparent text-white">
        <AccountSettingsContent onBack={() => setSettingsView("main")} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-white">
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <SozuTagCard onOpenAccountSettings={() => setSettingsView("profile_settings")} />

        <Card className="border-white/15 bg-black/55 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Languages className="w-5 h-5" />
              {t.language}
            </CardTitle>
            <CardDescription className="text-white/60">{t.settingsLanguageDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <AppLanguageSelector variant="settings" className="w-full max-w-sm" />
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-black/55 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Coins className="w-5 h-5" />
              {t.currency}
            </CardTitle>
            <CardDescription className="text-white/60">
              {t.referenceFiatNote} USDC
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-white/80 text-sm">{t.currency}</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {REFERENCE_FIAT_OPTIONS.map((fiat) => (
                <button
                  key={fiat}
                  type="button"
                  onClick={() => {
                    const next = { ...treasuryPrefs, referenceFiat: fiat }
                    setTreasuryPrefs(next)
                    saveTreasuryPrefs(next)
                  }}
                  className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                    treasuryPrefs.referenceFiat === fiat
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                      : "border-white/15 bg-white/[0.03] text-white/70 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {fiat}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
