"use client"

import { useLayoutEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { hasServerWalletSession, recoverStaleWalletSession } from "@/lib/auth/wallet-session-client"
import { isClientAuthed, requiresClientAuth } from "@/lib/client-auth-gate"
import { signalBootstrapReady } from "@/lib/app-ready"

type AppBootstrapGateProps = {
  children: ReactNode
}

/**
 * Blocks wallet routes until passkey session is confirmed, and signals bootstrap-ready
 * so the preloader fades only on the final destination screen.
 */
export function AppBootstrapGate({ children }: AppBootstrapGateProps) {
  const pathname = usePathname() ?? ""
  const needsAuth = requiresClientAuth(pathname)
  const [canRender, setCanRender] = useState(!needsAuth)

  useLayoutEffect(() => {
    if (!needsAuth) {
      return
    }

    if (!isClientAuthed()) {
      const next = `/auth${window.location.search}${window.location.hash}`
      window.location.replace(next)
      return
    }

    let cancelled = false
    void (async () => {
      const serverSession = await hasServerWalletSession()
      if (cancelled) return
      if (serverSession === false) {
        recoverStaleWalletSession()
        return
      }
      setCanRender(true)
    })()

    return () => {
      cancelled = true
    }
  }, [needsAuth, pathname])

  useLayoutEffect(() => {
    if (!canRender) return
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        signalBootstrapReady()
      })
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  }, [canRender])

  if (!canRender) return null

  return <>{children}</>
}
