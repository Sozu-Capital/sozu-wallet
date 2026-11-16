"use client"

import { TagInputModal } from "@/components/tag-input-modal"
import { WalletActivationOnboarding } from "@/components/wallet/wallet-activation-onboarding"
import { AuthDeviceChoiceModal } from "@/components/auth-device-choice-modal"
import { RecoverAccountScreen } from "@/components/auth/recover-account-screen"
import { QRCodeRegistrationModal } from "@/components/qr-code-registration-modal"
import { WalletSkeleton } from "@/components/ui/wallet-skeleton"
import { Button } from "@/components/ui/button"
import { Fingerprint, Share, Plus, X } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import {
  generateRegistrationChallenge,
  generateAuthChallenge,
  createPasskey,
  getPasskey,
  verifyRegistration,
  verifyAuthentication
} from "@/lib/turnkey/passkeys"
import { detectDeviceCapabilities } from "@/lib/webauthn/device-detection"
import { resolveEnterAuthPath } from "@/lib/webauthn/enter-auth-path"
import { requestImmediateLocalPasskey } from "@/lib/webauthn/immediate-passkey"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useRef, useEffect, useCallback, Suspense } from "react"
import { usePwaInstall } from "@/hooks/use-pwa-install"
import { useAppViewportLock } from "@/hooks/use-app-viewport-lock"
import { WalletLanguageProvider, useWalletLanguage } from "@/lib/wallet-language"
import {
  loadClientWalletSession,
  persistAuthIdentitySession,
  persistClientWalletSession,
} from "@/lib/client-wallet-session"
import { hasServerWalletSession } from "@/lib/auth/wallet-session-client"
import { clearClientSession } from "@/lib/storage/clear-session"
import { signalBootstrapReady } from "@/lib/app-ready"
import { markWelcomeOnboardingComplete } from "@/lib/wallet/needs-activation-onboarding"
import { peekFaucetHandoffReturn } from "@/lib/sozu-faucet/handoff-return-storage"
import {
  parseAllowlistedFaucetReturnUrl,
  parseFaucetHandoffAuthReturn,
} from "@/lib/sozu-faucet/return-allowlist"
import { toast } from "sonner"
import { nfcUsdcDropReturnPath } from "@/lib/faucet/nfc-usdc-drop"
import { itemAuthReturnPath } from "@/lib/merch/buy-gate"
import { panelAuthReturnPath } from "@/lib/shell/panels"
import { resolvePizzaAuthSearch } from "@/lib/pizza/pay-return"
import { stashPizzaHopReturn } from "@/lib/pizza/hop-return-storage"
import { ConnectPayConfirm } from "@/components/connect/connect-pay-confirm"
import { PizzaAuthContinuation } from "@/components/pizza/PizzaAuthContinuation"
import { circleSacCover } from "@/lib/connect/circle-balance"
import { readSozuPayRequest, sozuConnectInsufficient, sozuConnectPayment } from "@/lib/connect/pay-request"
import {
  deliverSozuConnectResult,
  isSozuConnectSearch,
  sozuConnectSignupFailed,
  sozuConnectSuccess,
} from "@/lib/connect/popup-result"

function navigatePostAuth(
  path: string,
  routerPush: (href: string) => void,
) {
  if (path.startsWith("/auth/faucet-handoff")) {
    window.location.assign(path)
    return
  }
  routerPush(path)
}

function AuthPageContent() {
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showSignup, setShowSignup] = useState(false)
  const [signupPrefill, setSignupPrefill] = useState<string | null>(null)
  const [resumeLoginTag, setResumeLoginTag] = useState<string | null>(null)
  const [tagModalPrefill, setTagModalPrefill] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [showIosInstallModal, setShowIosInstallModal] = useState(false)
  const [pwaBannerDismissed, setPwaBannerDismissed] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrUsername, setQRUsername] = useState<string | null>(null)
  const [showDeviceChoice, setShowDeviceChoice] = useState(false)
  const [pendingRecoveryEmail, setPendingRecoveryEmail] = useState<string | null>(null)
  const [showRecover, setShowRecover] = useState(false)
  const [offerCreateAccount, setOfferCreateAccount] = useState(false)
  const [paySession, setPaySession] = useState<{ username: string; accountId: string } | null>(null)
  const [payAccount, setPayAccount] = useState<{ username: string; accountId: string } | null>(null)
  const [payCheck, setPayCheck] = useState<"idle" | "checking" | "unavailable">("idle")
  const router = useRouter()
  const searchParams = useSearchParams()
  const connectMode = isSozuConnectSearch(searchParams)
  const payRequest = connectMode ? readSozuPayRequest(searchParams) : null
  const redirectingRef = useRef(false)
  const { canInstall, triggerInstall, isIos, isInstalled } = usePwaInstall()
  const { t, language } = useWalletLanguage()
  // Stores a passkey credential captured during discovery-mode auth that failed
  // (credential not in DB). Passed to proceedWithRegistration so the user isn't
  // prompted for a second biometric after entering their SozuTag.
  const pendingCredentialRef = useRef<Awaited<ReturnType<typeof getPasskey>>>(null)

  useAppViewportLock()

  /**
   * Login-with-Sozu handoff: `/auth?faucet=1&return=/auth/faucet-handoff?return=…`
   * Absolute faucet callbacks are never accepted here — only the relative
   * Wallet handoff path (allowlist enforced inside parseFaucetHandoffAuthReturn).
   * sessionStorage stash is a backup if nested query encoding gets mangled.
   */
  const faucetHandoffReturn = (() => {
    if (searchParams.get("faucet")?.trim() !== "1") return null
    const fromQuery = parseFaucetHandoffAuthReturn(searchParams.get("return"))
    if (fromQuery) return fromQuery
    const stashed = peekFaucetHandoffReturn()
    if (stashed && parseAllowlistedFaucetReturnUrl(stashed)) {
      return `/auth/faucet-handoff?return=${encodeURIComponent(stashed)}`
    }
    return null
  })()

  /**
   * In-app NFC faucet return is only valid when this visit came from a faucet URL
   * (`/auth?faucet=<slug>`). Stale sessionStorage alone must never yank a
   * normal in-app signup to /faucet/test-orb-001.
   * `faucet=1` is reserved for the Login-with-Sozu handoff (not a slug).
   */
  const faucetReturnPath = (() => {
    if (faucetHandoffReturn) return faucetHandoffReturn
    const slug = searchParams.get("faucet")?.trim()
    if (slug && slug !== "1" && /^[a-z0-9-]+$/i.test(slug)) {
      return `/faucet/${slug}`
    }
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("sozu_faucet_return")
      } catch {
        /* private browsing */
      }
    }
    return null
  })()

  /** SDP onboarding: middleware sends unauthenticated users to /auth?sdpInvite=1 */
  const postAuthPath =
    searchParams.get("sdpInvite") === "1"
      ? "/sdp/register"
      : faucetReturnPath ?? "/home"

  /** Checkout redirect: /checkout/[id] sends unauthenticated users here with ?redirect=/checkout/... */
  const checkoutRedirect = (() => {
    const redirect = searchParams.get("redirect")?.trim()
    if (redirect && redirect.startsWith("/checkout/") && redirect.length > 10) {
      return redirect
    }
    return null
  })()

  const nfcUsdcRedirect = nfcUsdcDropReturnPath(searchParams.get("redirect"))

  const offlineReturn = (() => {
    const redirect = searchParams.get("redirect")?.trim() ?? ""
    if (redirect === "/offline" || redirect.startsWith("/offline?")) return redirect
    return null
  })()

  const itemReturn = itemAuthReturnPath(searchParams.get("redirect"))
  const panelReturn = panelAuthReturnPath(searchParams.get("redirect"))

  const finalPostAuthPath = checkoutRedirect ?? nfcUsdcRedirect ?? offlineReturn ?? itemReturn ?? panelReturn ?? postAuthPath
  const pizzaAuth = resolvePizzaAuthSearch(searchParams)
  const stayOnAuthForPizza = pizzaAuth.kind !== "none"
  const pizzaHopReturnTo = pizzaAuth.kind === "hop" ? pizzaAuth.returnTo : null

  const completeConnect = useCallback(
    (username: string | null | undefined, accountId: string | null | undefined) => {
      const success = sozuConnectSuccess(username, accountId)
      if (payRequest && success) {
        redirectingRef.current = true
        setShowTagModal(false)
        setResumeLoginTag(null)
        setTagModalPrefill(null)
        setIsAuthenticated(true)
        setIsAuthenticating(false)
        setIsExiting(false)
        setPayAccount(success)
        setPayCheck("checking")
        void circleSacCover(success.accountId, payRequest.amount).then((cover) => {
          if (cover === "no") {
            const short = sozuConnectInsufficient(success.username, success.accountId)
            deliverSozuConnectResult(short ?? sozuConnectSignupFailed())
            return
          }
          if (cover !== "yes") {
            setPayCheck("unavailable")
            return
          }
          setPayCheck("idle")
          setPaySession({ username: success.username, accountId: success.accountId })
        })
        return
      }
      const message = success ?? sozuConnectSignupFailed()
      redirectingRef.current = true
      setShowTagModal(false)
      setResumeLoginTag(null)
      setTagModalPrefill(null)
      setIsAuthenticated(true)
      setIsAuthenticating(false)
      setIsExiting(true)
      deliverSozuConnectResult(message)
    },
    [payRequest],
  )

  useEffect(() => {
    if (pizzaHopReturnTo) stashPizzaHopReturn(pizzaHopReturnTo)
  }, [pizzaHopReturnTo])

  useEffect(() => {
    if (redirectingRef.current || isAuthenticating || isAuthenticated) return

    const showTagPicker =
      searchParams.get("showTag") === "1" || searchParams.get("switch") === "1"
    if (showTagPicker) {
      clearClientSession()
      void fetch("/api/sdp/reset-wallet-link", {
        method: "POST",
        credentials: "include",
      })
      setSignupPrefill(null)
      setShowSignup(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => signalBootstrapReady())
      })
      return
    }

    let cancelled = false
    void (async () => {
      const session = await loadClientWalletSession()
      if (cancelled) return
      if (session.isAuthenticated && session.userId) {
        const serverSession = await hasServerWalletSession()
        if (cancelled) return
        if (serverSession === false) {
          clearClientSession()
          requestAnimationFrame(() => {
            requestAnimationFrame(() => signalBootstrapReady())
          })
          return
        }
        if (connectMode) {
          // A cookie is not the passkey check. Stay on this page until they sign.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => signalBootstrapReady())
          })
          return
        }
        if (stayOnAuthForPizza) {
          setIsAuthenticated(true)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => signalBootstrapReady())
          })
          return
        }
        redirectingRef.current = true
        const target =
          searchParams.get("sdpInvite") === "1" ? "/sdp/register" : finalPostAuthPath
        if (target.startsWith("/auth/faucet-handoff")) {
          window.location.replace(target)
        } else {
          router.replace(target)
        }
        return
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => signalBootstrapReady())
      })
    })()

    return () => {
      cancelled = true
    }
  }, [searchParams, router, finalPostAuthPath, stayOnAuthForPizza, isAuthenticating, isAuthenticated, connectMode, completeConnect])

  const finalizePasskeyLoginSuccess = useCallback(
    async (userId: string, username: string | undefined, credential: { id: string }) => {
      const displayUsername =
        username && username !== "" && username !== "user" ? username : undefined

      persistAuthIdentitySession({
        userId,
        credentialId: credential.id,
        credentialRawId: "rawId" in credential && typeof credential.rawId === "string" ? credential.rawId : undefined,
        username: displayUsername,
      })

      let connectAccountId: string | null = null
      try {
        const { alignWalletMaterialAfterLogin } = await import("@/lib/storage/post-login-wallet")
        const { publicKey, needsWalletSync } = await alignWalletMaterialAfterLogin(
          userId,
          credential.id,
        )
        if (needsWalletSync) {
          console.warn("[Auth] Wallet sync may be required for this passkey on this device.")
        } else {
          connectAccountId = publicKey
          persistClientWalletSession({
            userId,
            publicKey,
            credentialId: credential.id,
            username: displayUsername,
          })
        }
      } catch (keyError) {
        console.error("[Auth] Failed to align wallet after login:", keyError)
        if (typeof window !== "undefined") {
          sessionStorage.setItem("wallet_sync_pending", "1")
        }
      }
      if (connectMode) {
        completeConnect(displayUsername, connectAccountId)
        return
      }
      setShowTagModal(false)
      setResumeLoginTag(null)
      setTagModalPrefill(null)
      setIsAuthenticated(true)
      setIsAuthenticating(false)
      if (stayOnAuthForPizza) {
        redirectingRef.current = false
        setIsExiting(false)
        return
      }
      redirectingRef.current = true
      setIsExiting(true)
      navigatePostAuth(finalPostAuthPath, (p) => router.push(p))
    },
    [router, finalPostAuthPath, stayOnAuthForPizza, connectMode, completeConnect]
  )

  const finalizePinLoginSuccess = useCallback(
    async (userId: string, username: string) => {
      sessionStorage.removeItem("credential_id")
      persistAuthIdentitySession({ userId, credentialId: "", username })
      let connectAccountId: string | null = null
      try {
        const res = await fetch("/api/wallet/stellar/address")
        const data = (await res.json()) as { publicKey?: string | null }
        const pk = data.publicKey?.trim().toUpperCase()
        if (pk && (pk.startsWith("C") || pk.startsWith("G")) && pk.length === 56) {
          connectAccountId = pk
          const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
          const credentialId = (await getCurrentCredentialId(pk)) ?? ""
          persistClientWalletSession({
            userId,
            publicKey: pk,
            credentialId,
            username,
          })
          if (pk.startsWith("G")) {
            const { getKeypairByPublicKey } = await import("@/lib/storage/browser-keys")
            const kp = await getKeypairByPublicKey(pk)
            if (kp) sessionStorage.removeItem("wallet_sync_pending")
            else sessionStorage.setItem("wallet_sync_pending", "1")
          }
        }
      } catch (e) {
        console.warn("[Auth] PIN login: could not load wallet address", e)
      }
      if (connectMode) {
        completeConnect(username, connectAccountId)
        return
      }
      setShowTagModal(false)
      setResumeLoginTag(null)
      setTagModalPrefill(null)
      setIsAuthenticated(true)
      setIsAuthenticating(false)
      if (stayOnAuthForPizza) {
        redirectingRef.current = false
        setIsExiting(false)
        return
      }
      redirectingRef.current = true
      setIsExiting(true)
      navigatePostAuth(finalPostAuthPath, (p) => router.push(p))
    },
    [router, finalPostAuthPath, stayOnAuthForPizza, connectMode, completeConnect]
  )

  const attemptLoginWithTag = useCallback(
    async (tag: string): Promise<{
      ok: boolean
      cancelled?: boolean
      error?: string
      /** Credential captured during a failed auth attempt — reuse for registration to skip second biometric. */
      capturedCredential?: Awaited<ReturnType<typeof getPasskey>> | null
    }> => {
      try {
        const challenge = await generateAuthChallenge(tag)
        let credential: Awaited<ReturnType<typeof getPasskey>>
        try {
          credential = await getPasskey(challenge)
        } catch (e) {
          if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError")) {
            return { ok: false, cancelled: true }
          }
          throw e
        }
        if (!credential) return { ok: false, cancelled: true }
        const authResult = await verifyAuthentication(tag, credential, challenge?.challenge)
        if (!authResult?.success || !authResult.userId) {
          // Auth failed (account deleted / credential not in DB).
          // Return the credential so the caller can stash it for registration reuse.
          return { ok: false, error: "Could not sign in", capturedCredential: credential }
        }
        await finalizePasskeyLoginSuccess(authResult.userId, authResult.username, credential)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Could not sign in" }
      }
    },
    [finalizePasskeyLoginSuccess]
  )

  // Extract invite code from URL params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const invite = searchParams?.get("invite") || new URLSearchParams(window.location.search).get("invite")
      if (invite) {
        setReferralCode(invite)
        console.log("[Auth] Referral code found in URL:", invite)
      }
    }
  }, [searchParams])

  // Extract referral code from URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const invite = searchParams.get("invite")
      if (invite) {
        console.log("[Auth] Found referral code in URL:", invite)
        setReferralCode(invite)
      }
    }
  }, [searchParams])

  /**
   * Explicit discovery login (empty allowCredentials).
   * Only call when the user chose "scan with another device" — never as the
   * default Enter path for first-time biometric devices (that surfaces the OS
   * hybrid QR sheet when no local passkey exists).
   */
  const attemptDiscoveryLogin = useCallback(async () => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setIsAuthenticating(false)
      setSignupPrefill(null)
      setShowSignup(true)
      return
    }

    setIsAuthenticating(true)
    try {
      const discoveryChallenge = await generateAuthChallenge()
      console.log("[Auth] Generated discovery challenge, rpId:", discoveryChallenge.rpId)

      const credential = await getPasskey(discoveryChallenge)

      if (!credential) {
        console.log("[Auth] No passkey selected or user cancelled discovery")
        setIsAuthenticating(false)
        setSignupPrefill(null)
        setShowSignup(true)
        return
      }

      console.log(
        "[Auth] Passkey selected in discovery mode, credential ID:",
        credential.id.substring(0, 20) + "...",
      )

      const authResult = await verifyAuthentication("", credential, discoveryChallenge.challenge)

      if (!authResult || !authResult.success) {
        console.log(
          "[Auth] Discovery mode authentication failed — credential captured for registration reuse",
        )
        pendingCredentialRef.current = credential
        setIsAuthenticating(false)
        setShowTagModal(true)
        return
      }

      console.log("[Auth] ✅ Login successful via passkey discovery")
      const finalUserId = authResult.userId
      if (!finalUserId || !credential?.id) {
        throw new Error("No userId or credential from discovery login")
      }
      await finalizePasskeyLoginSuccess(finalUserId, authResult.username, credential)
    } catch (discoveryError: unknown) {
      const err = discoveryError as { name?: string; message?: string }
      console.log("[Auth] Passkey discovery failed:", err?.name, err?.message)
      setIsAuthenticating(false)
      setSignupPrefill(null)
      setShowSignup(true)
    }
  }, [finalizePasskeyLoginSuccess])

  const startSignup = () => {
    setOfferCreateAccount(false)
    setSignupPrefill(null)
    setShowSignup(true)
  }

  const holdForCreateAccount = (
    credential?: Awaited<ReturnType<typeof getPasskey>> | null,
  ) => {
    if (credential) pendingCredentialRef.current = credential
    setIsAuthenticating(false)
    setOfferCreateAccount(true)
  }

  const handleAuth = async () => {
    if (redirectingRef.current || isAuthenticating) {
      return
    }

    setIsAuthenticating(true)
    setShowDeviceChoice(false)

    let storedUsername: string | null = null
    if (typeof window !== "undefined") {
      const value = localStorage.getItem("sozu_username")
      if (value && value !== "user") {
        storedUsername = value
      }
    }

    // Remembered tag: open that saved passkey. Cancelling stays on the lock
    // screen; onboarding only starts from "create a new account".
    if (storedUsername) {
      const result = await attemptLoginWithTag(storedUsername)
      if (result.ok) return

      if (result.cancelled || result.capturedCredential) {
        holdForCreateAccount(result.capturedCredential)
        return
      }

      setIsAuthenticating(false)
      if (result.error && /not found/i.test(result.error)) {
        localStorage.removeItem("sozu_username")
        startSignup()
      }
      return
    }

    // No remembered tag. Ask the browser only for passkeys already on this
    // device. A miss goes to onboarding. A dismissed sheet does not.
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      try {
        const challenge = await generateAuthChallenge()
        const local = await requestImmediateLocalPasskey(challenge)
        if (local.status === "credential") {
          const authResult = await verifyAuthentication("", local.credential, challenge.challenge)
          if (!authResult?.success || !authResult.userId) {
            holdForCreateAccount(local.credential)
            return
          }
          await finalizePasskeyLoginSuccess(authResult.userId, authResult.username, local.credential)
          return
        }
        if (local.status === "cancelled") {
          holdForCreateAccount()
          return
        }
        if (local.status === "none") {
          setIsAuthenticating(false)
          startSignup()
          return
        }
        if (local.status === "error") {
          setIsAuthenticating(false)
          return
        }
      } catch {
        setIsAuthenticating(false)
        return
      }
    }

    // Browsers without immediate mode cannot list local passkeys without
    // opening the cross-device sheet. Fall back to the capability route.
    const capabilities = await detectDeviceCapabilities()
    const path = resolveEnterAuthPath({ storedUsername: null, capabilities })
    setIsAuthenticating(false)

    if (path.action === "create-or-login" || path.action === "unsupported") {
      startSignup()
      return
    }

    setShowDeviceChoice(true)
  }

  const handleRegisterFromModal = (tag: string, email: string) => {
    setShowTagModal(false)
    setResumeLoginTag(null)
    setTagModalPrefill(null)
    setPendingRecoveryEmail(email)
    setIsAuthenticating(true)
    const captured = pendingCredentialRef.current
    pendingCredentialRef.current = null
    void proceedWithRegistration(tag, captured, email)
  }

  const handleLoginPasskeyFromModal = async (tag: string) => {
    const result = await attemptLoginWithTag(tag)
    if (result.cancelled) {
      setResumeLoginTag(tag)
      setShowTagModal(true)
    }
    return result
  }

  const handlePinLoginFromModal = async (tag: string, pin: string) => {
    try {
      const res = await fetch("/api/auth/pin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: tag, pin }),
      })
      const data = (await res.json()) as { error?: string; message?: string; userId?: string; username?: string }
      if (!res.ok) {
        if (data.error === "pin_not_configured" && typeof data.message === "string") {
          return { ok: false as const, error: data.message }
        }
        return { ok: false as const, error: typeof data.message === "string" ? data.message : "Could not sign in" }
      }
      if (!data.userId || !data.username) {
        return { ok: false as const, error: "Could not sign in" }
      }
      await finalizePinLoginSuccess(data.userId, data.username)
      return { ok: true as const }
    } catch {
      return { ok: false as const, error: "Network error" }
    }
  }

  const proceedWithRegistration = async (
    tag: string,
    /** Credential already captured from a prior (failed) discovery-mode auth.
     *  When provided the browser biometric prompt is skipped entirely. */
    existingCredential?: Awaited<ReturnType<typeof getPasskey>> | null,
    recoveryEmail?: string,
  ) => {
    console.log("[Auth] ====== Starting registration with tag:", tag, existingCredential ? "(reusing captured credential)" : "")

    try {
      let credential: Awaited<ReturnType<typeof getPasskey>> = existingCredential ?? null
      const usernameToRegister = tag

      // CRITICAL: Check device capability BEFORE attempting passkey creation
      // This prevents orphaned credentials on devices without biometrics
      if (!existingCredential) {
        console.log("[Auth] Checking device capability before passkey creation...")
        const capabilities = await detectDeviceCapabilities()
        
        if (!capabilities.canUsePasskeys) {
          console.log("[Auth] Device doesn't support passkeys - checking for QR flow...")
          
          // Desktop without biometrics → show QR code for phone registration
          if (capabilities.deviceType === 'desktop') {
            console.log("[Auth] Desktop without biometrics - showing QR code flow")
            setIsAuthenticating(false)
            setQRUsername(usernameToRegister)
            setShowQRModal(true)
            return
          }
          
          // Mobile without biometrics → show clear error
          console.log("[Auth] Mobile without biometrics - self-custodial registration not available")
          setIsAuthenticating(false)
          alert(
            `Your device doesn't support secure biometric authentication.\n\n` +
            `Sozu Wallet requires ${capabilities.os === 'ios' ? 'Face ID or Touch ID' : 'fingerprint or face unlock'} for self-custody security.\n\n` +
            `Please use a device with biometric authentication.`
          )
          setSignupPrefill(usernameToRegister)
          setShowSignup(true)
          return
        }
        console.log("[Auth] Device supports passkeys - proceeding with registration")
      }

      // Store tag in localStorage for future logins
      if (typeof window !== "undefined") {
        localStorage.setItem("sozu_username", tag)
      }

      console.log("[Auth] Reg Step 1: Generating registration challenge with tag:", usernameToRegister)
      let challenge
      try {
        challenge = await generateRegistrationChallenge(usernameToRegister)
      } catch (challengeError: any) {
        // Check if username already exists (409 status or usernameExists flag)
        if (challengeError.status === 409 || challengeError.usernameExists ||
          challengeError.message?.includes("already taken") ||
          challengeError.message?.includes("Username already exists")) {
          console.log("[Auth] Tag already exists — open sign-in in modal")
          setIsAuthenticating(false)
          if (typeof window !== "undefined") {
            localStorage.setItem("sozu_username", usernameToRegister)
          }
          setShowTagModal(true)
          setResumeLoginTag(usernameToRegister)
          return
        }
        throw challengeError
      }

      if (!existingCredential) {
        // Normal path: no prior credential — prompt the user for a new passkey.
        // Update challenge to use tag as displayName for passkey
        if (challenge.user) {
          challenge.user.displayName = usernameToRegister
          challenge.user.name = usernameToRegister
        }

        // PHASE 1: Generate a temporary userId client-side for userHandle storage
        const tempUserId = crypto.randomUUID()
        console.log("[Auth] Reg Step 1.5: Generated temporary userId for userHandle:", tempUserId)

        console.log("[Auth] Reg Step 2: Challenge generated, calling createPasskey with tag as displayName...")

        try {
          // Pass userId and tag to createPasskey so it can be stored in userHandle and used as displayName
          credential = await createPasskey(challenge, tempUserId, usernameToRegister)
          console.log("[Auth] Reg Step 3: createPasskey result:", credential ? "Got credential" : "No credential")
          if (credential?.response?.userHandle) {
            console.log("[Auth] UserHandle stored in passkey:", credential.response.userHandle)
          }
        } catch (passkeyError) {
          // Check if user cancelled the passkey prompt
          if (passkeyError instanceof DOMException && (
            passkeyError.name === "NotAllowedError" ||
            passkeyError.name === "AbortError"
          )) {
            console.log("[Auth] User cancelled passkey registration")
            setIsAuthenticating(false)
            setSignupPrefill(usernameToRegister)
            setShowSignup(true)
            return
          }
          throw passkeyError // Re-throw other errors
        }
      } else {
        console.log("[Auth] Reg Step 2–3: Skipping createPasskey — reusing credential from prior discovery auth")
      }

      if (!credential) {
        throw new Error("Failed to create passkey.")
      }

      console.log("[Auth] Reg Step 4: Verifying registration...")

      // Pass the challenge and referral code to verifyRegistration
      const regResult = await verifyRegistration(
        usernameToRegister,
        credential,
        challenge.challenge,
        referralCode,
        recoveryEmail,
      )
      console.log("[Auth] Reg Step 5: Verification result:", regResult)
      console.log("[Auth] Registration success:", regResult.success)
      console.log("[Auth] Registration userId:", regResult.userId)

      if (!regResult || !regResult.success) {
        console.error("[Auth] Registration verification failed - result:", regResult)
        setIsAuthenticating(false)
        alert("Registration failed. Please try again.")
        return
      }

      console.log("[Auth] Registration successful:", regResult)

      // Set authenticated state to trigger animation ONLY after successful verification
      setIsAuthenticated(true)
      setIsAuthenticating(false)

      // Set up authentication after registration
      if (typeof window !== "undefined") {
        console.log("[Auth] Reg Step 6: Setting up authentication...")

        // Store username in localStorage for future logins
        const registeredUsername = (regResult as any).username || usernameToRegister || "user"
        if (registeredUsername) {
          localStorage.setItem("sozu_username", registeredUsername)
          console.log("[Auth] Saved username to localStorage after registration:", registeredUsername)
        }

        // CRITICAL: Use server userId for key derivation (not tempUserId)
        // Key derivation includes userId, so different userId = different keypair
        const finalUserId = regResult.userId
        if (!finalUserId) {
          console.error("[Auth] ERROR: No userId available from server!")
          throw new Error("No userId available. Cannot continue.")
        }
        markWelcomeOnboardingComplete(finalUserId)

        if (typeof window !== "undefined" && credential?.id) {
          persistAuthIdentitySession({
            userId: finalUserId,
            credentialId: credential.id,
            credentialRawId:
              "rawId" in credential && typeof credential.rawId === "string"
                ? credential.rawId
                : undefined,
            username: registeredUsername,
          })

          try {
            const { extractPasskeyPublicKey65ForStorage } = await import(
              "@/lib/webauthn/extract-attestation-pubkey"
            )
            const { parsePasskeyPublicKey65 } = await import(
              "@/lib/stellar/smartAccounts/passkeyPublicKey"
            )
            const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
            const pub65b = extractPasskeyPublicKey65ForStorage(credential)
            const { kit } = await getSmartAccountKit()
            await kit.credentials.save({
              credentialId: credential.id,
              publicKey: parsePasskeyPublicKey65(pub65b),
            })
            console.log("[Auth] Saved passkey public key to smart-account-kit storage for deploy")
          } catch (kitSaveErr) {
            console.warn("[Auth] kit.credentials.save after register:", kitSaveErr)
          }

          if (connectMode) {
            let connectAccountId: string | null = null
            try {
              const { alignWalletMaterialAfterLogin } = await import(
                "@/lib/storage/post-login-wallet"
              )
              const { publicKey, needsWalletSync } = await alignWalletMaterialAfterLogin(
                finalUserId,
                credential.id,
              )
              if (!needsWalletSync && publicKey) {
                connectAccountId = publicKey
                persistClientWalletSession({
                  userId: finalUserId,
                  publicKey,
                  credentialId: credential.id,
                  username: registeredUsername,
                })
              }
            } catch (walletError) {
              console.error("[Auth] Smart wallet provisioning failed:", walletError)
              sessionStorage.setItem("wallet_sync_pending", "1")
            }
            completeConnect(registeredUsername, connectAccountId)
            return
          }

          // Kick off Wallet Provisioning without blocking redirect — Home shows
          // welcome slides in parallel so deploy latency is hidden behind onboarding.
          sessionStorage.setItem("wallet_sync_pending", "1")
          const credIdForProvision = credential.id
          void (async () => {
            try {
              console.log(
                "[Auth] Reg Step 6.5: Provisioning smart wallet (C…) in background for userId:",
                finalUserId,
              )
              const { alignWalletMaterialAfterLogin } = await import(
                "@/lib/storage/post-login-wallet"
              )
              const { publicKey, needsWalletSync } = await alignWalletMaterialAfterLogin(
                finalUserId,
                credIdForProvision,
              )
              console.log(
                "[Auth] ✅ Wallet ready:",
                publicKey ? publicKey.substring(0, 10) + "…" : "(none)",
                needsWalletSync,
              )
              if (!needsWalletSync && publicKey) {
                persistClientWalletSession({
                  userId: finalUserId,
                  publicKey,
                  credentialId: credIdForProvision,
                  username: registeredUsername,
                })
              }
            } catch (walletError) {
              console.error("[Auth] ❌ Smart wallet provisioning failed:", walletError)
              sessionStorage.setItem("wallet_sync_pending", "1")
            }
          })()
        } else if (connectMode) {
          completeConnect(registeredUsername, null)
          return
        } else {
          console.warn("[Auth] ⚠️ Skipping smart wallet setup — no credential id")
        }

        console.log("[Auth] Persisted session after registration:", finalUserId, "Username:", registeredUsername)

        // Check if Supabase session exists
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()

          if (!user) {
            console.log("[Auth] No Supabase session after registration, using sessionStorage fallback")
          } else {
            console.log("[Auth] Supabase session exists after registration")
          }
        } catch (supabaseError) {
          console.warn("[Auth] Error checking Supabase session after registration (using sessionStorage fallback):", supabaseError)
          // Continue with sessionStorage fallback
        }

        // Force immediate redirect - set flags first
        redirectingRef.current = true

        console.log("[Auth] Reg Step 7: Redirecting to wallet...")
        console.log("[Auth] SessionStorage items after registration:", {
          dev_authenticated: sessionStorage.getItem("dev_authenticated"),
          dev_username: sessionStorage.getItem("dev_username"),
          passkey_registered: sessionStorage.getItem("passkey_registered"),
        })

        // Start fade-out animation, then redirect
        setIsExiting(true)

        setTimeout(() => {
          void (async () => {
          // Ensure sessionStorage is committed, then redirect using Next.js router
          // This prevents full page refresh and preserves console logs
          console.log("[Auth] About to redirect after registration - final check:", {
            pathname: window.location.pathname,
            sessionAuth: sessionStorage.getItem("dev_authenticated"),
            redirectingRef: redirectingRef.current
          })

          // Force a synchronous write to sessionStorage
          // This ensures it's definitely set before we navigate
          // CRITICAL: Use userId (UUID), never fallback to username
          if (!regResult.userId) {
            console.error("[Auth] CRITICAL: No userId available for sessionStorage!")
            return // Don't redirect if we don't have a userId
          }

          console.log("[Auth] Executing redirect after registration:", postAuthPath)

          // Use router.push with replace to prevent back button issues
          // Don't use window.location.href as it causes hard refresh
          console.log("[Auth] Navigating after registration...")
          if (stayOnAuthForPizza) {
            try {
              const credId = credential?.id
              if (finalUserId && credId) {
                const { alignWalletMaterialAfterLogin } = await import(
                  "@/lib/storage/post-login-wallet"
                )
                const { publicKey, needsWalletSync } = await alignWalletMaterialAfterLogin(
                  finalUserId,
                  credId,
                )
                if (!needsWalletSync && publicKey) {
                  persistClientWalletSession({
                    userId: finalUserId,
                    publicKey,
                    credentialId: credId,
                    username: registeredUsername,
                  })
                }
              }
            } catch (walletError) {
              console.error("[Auth] Pizza hop still waiting on wallet after signup:", walletError)
            }
            setIsAuthenticated(true)
            redirectingRef.current = false
            setIsExiting(false)
            return
          }
          navigatePostAuth(finalPostAuthPath, (p) => router.push(p))
          })()
        }, 300) // Wait 300ms for fade-out animation

        return
      }
    } catch (error: unknown) {
      // If we're redirecting, don't do anything else
      if (redirectingRef.current) {
        console.log("[Auth] Redirect in progress, ignoring error")
        return
      }

      // Check if this is a cancellation error (user cancelled passkey prompt)
      if (error instanceof DOMException && (
        error.name === "NotAllowedError" ||
        error.name === "AbortError"
      )) {
        console.log("[Auth] User cancelled passkey authentication/registration")
        setIsAuthenticating(false)
        const stored = typeof window !== "undefined" ? localStorage.getItem("sozu_username") : null
        setSignupPrefill(stored)
        setShowSignup(true)
        return
      }

      // Check if error is a passkey cancellation in the error chain
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes("NotAllowedError") || errorMessage.includes("AbortError")) {
        console.log("[Auth] User cancelled passkey (detected in error message)")
        setIsAuthenticating(false)
        toast.message(t.authCancelledHint)
        const storedTag = typeof window !== "undefined" ? localStorage.getItem("sozu_username") : null
        setSignupPrefill(storedTag)
        setShowSignup(true)
        return
      }

      console.error("[Auth] ====== Authentication error ======")
      console.error("[Auth] Error:", error)
      console.error("[Auth] Error type:", error instanceof Error ? error.constructor.name : typeof error)
      console.error("[Auth] Error message:", error instanceof Error ? error.message : String(error))
      console.error("[Auth] Error stack:", error instanceof Error ? error.stack : "No stack trace")

      // Check if we somehow got authenticated despite the error
      if (typeof window !== "undefined") {
        const isAuth =
          localStorage.getItem("dev_authenticated") === "true" ||
          sessionStorage.getItem("dev_authenticated") === "true"
        console.log("[Auth] Checking sessionStorage after error - authenticated:", isAuth)

        if (isAuth) {
          console.log("[Auth] Found auth state after error, redirecting anyway...")
          if (connectMode) {
            completeConnect(
              localStorage.getItem("sozu_username"),
              localStorage.getItem("stellar_public_key"),
            )
            return
          }
          if (stayOnAuthForPizza) {
            setIsAuthenticated(true)
            return
          }
          redirectingRef.current = true
          console.log("[Auth] Executing error recovery redirect:", postAuthPath)
          navigatePostAuth(finalPostAuthPath, (p) => router.push(p))
          return
        }
      }

      if (connectMode) {
        completeConnect(null, null)
        return
      }
      setIsAuthenticating(false)
      toast.error(t.authFailed)
      console.log("[Auth] Authentication failed - setting isAuthenticating to false")
    } finally {
      console.log("[Auth] ====== Authentication flow complete ======")
    }
  }

  if (payRequest && payCheck === "checking") {
    return (
      <div className="flex h-full min-h-[var(--sozu-app-height,100lvh)] items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Checking Circle USDC…
      </div>
    )
  }

  if (payRequest && payCheck === "unavailable" && payAccount) {
    const account = payAccount
    const request = payRequest
    return (
      <div className="flex h-full min-h-[var(--sozu-app-height,100lvh)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">Couldn’t check the Circle USDC balance. Try again before sending.</p>
        <button
          type="button"
          className="h-11 rounded-full bg-foreground px-5 text-sm text-background"
          onClick={() => {
            setPayCheck("checking")
            void circleSacCover(account.accountId, request.amount).then((cover) => {
              if (cover === "no") {
                const short = sozuConnectInsufficient(account.username, account.accountId)
                deliverSozuConnectResult(short ?? sozuConnectSignupFailed())
                return
              }
              if (cover !== "yes") {
                setPayCheck("unavailable")
                return
              }
              setPayCheck("idle")
              setPaySession(account)
            })
          }}
        >
          Try again
        </button>
        <button type="button" className="text-sm text-muted-foreground" onClick={() => window.close()}>
          Cancel
        </button>
      </div>
    )
  }

  if (paySession && payRequest) {
    return (
      <ConnectPayConfirm
        amount={payRequest.amount}
        to={payRequest.to}
        username={paySession.username}
        accountId={paySession.accountId}
        onSigned={(txHash) => {
          const message = sozuConnectPayment(paySession.username, paySession.accountId, txHash)
          if (!message) {
            deliverSozuConnectResult(sozuConnectSignupFailed())
            return
          }
          deliverSozuConnectResult(message)
        }}
        onCancel={() => window.close()}
      />
    )
  }

  return (
    <div className="sozu-night sozu-night-clear relative h-full min-h-[var(--sozu-app-height,100lvh)] w-full overflow-hidden">
      {isAuthenticated && pizzaAuth.kind !== "none" ? (
        <PizzaAuthContinuation continuation={pizzaAuth} />
      ) : null}

      {/* ── PWA install banner — fixed top toast, visible on mobile before install ── */}
      <AnimatePresence>
        {!isInstalled && !pwaBannerDismissed && (canInstall || isIos) && (
          <motion.div
            key="pwa-banner"
            initial={{ y: "-110%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-110%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300, delay: 1.2 }}
            className="fixed left-3 right-3 z-[60] rounded-2xl border border-white/[0.10] px-4 py-3"
            style={{
              top: "max(0.75rem, env(safe-area-inset-top))",
              background: "rgba(18, 18, 20, 0.82)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            <div className="flex items-center gap-3">
              {/* App icon */}
              <img
                src="/icons/sozu_icon_192.png"
                alt="Sozu"
                className="h-11 w-11 shrink-0 rounded-[22%] object-cover"
              />

              {/* Text */}
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-[13px] font-semibold text-white leading-tight">
                  Sozu
                </p>
                <p className="text-[11px] text-white/45 leading-tight mt-0.5">
                  {isIos ? t.authPwaBannerIos : t.authPwaBannerAndroid}
                </p>
              </div>

              {/* Install / Add CTA */}
              <button
                type="button"
                onClick={() => {
                  if (canInstall) void triggerInstall()
                  else setShowIosInstallModal(true)
                }}
                className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-black hover:bg-white/90 active:scale-95 transition-transform"
              >
                {isIos ? t.authPwaInstallIos : t.authPwaInstallAndroid}
              </button>

              {/* Dismiss */}
              <button
                type="button"
                onClick={() => setPwaBannerDismissed(true)}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-white/35 hover:text-white/60 transition-colors"
                aria-label={t.authClose}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-auth skeleton — full viewport */}
      <div className="relative z-[1] h-full overflow-hidden">
        {isAuthenticated ? (
          <div className="relative z-10 h-full">
            <WalletSkeleton isExiting={isExiting} layout="landing" />
          </div>
        ) : null}
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 z-[4] flex w-full flex-col items-center gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] transition-opacity duration-700 ${
          isAuthenticated ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {offerCreateAccount && !isAuthenticated ? (
          <button
            type="button"
            onClick={startSignup}
            className="text-[13px] font-medium text-white/80 transition-colors hover:text-white"
          >
            {t.authCreateAccount}
          </button>
        ) : null}
        <Button
          type="button"
          onClick={() => void handleAuth()}
          disabled={isAuthenticating}
          className="h-14 w-full max-w-[430px] rounded-full bg-white text-base font-semibold text-black hover:bg-white/90"
        >
          {isAuthenticating ? <Fingerprint className="h-5 w-5" /> : t.authEnter}
        </Button>
        <button
          type="button"
          onClick={() => setShowRecover(true)}
          className="pointer-events-auto text-[11px] font-normal tracking-wide text-white/60 transition-colors hover:text-white"
        >
          {language === "en" ? "Recover my account" : "Recuperar mi cuenta"}
        </button>
      </div>

      {showRecover ? <RecoverAccountScreen onBack={() => setShowRecover(false)} /> : null}

      {showSignup ? (
        <WalletActivationOnboarding
          open
          activationSettled
          intent="signup"
          initialTag={signupPrefill ?? ""}
          onSignIn={(tag) => {
            setShowSignup(false)
            void handleLoginPasskeyFromModal(tag)
          }}
          onCreateAccount={(tag, email) => {
            setShowSignup(false)
            handleRegisterFromModal(tag, email)
          }}
          onExitComplete={() => setShowSignup(false)}
        />
      ) : null}

      {/* Sign-in for an existing tag. New accounts use the night flow above. */}
      <TagInputModal
        isOpen={showTagModal}
        resumeWithTag={resumeLoginTag}
        prefillTag={tagModalPrefill}
        onClose={() => {
          setShowTagModal(false)
          setIsAuthenticating(false)
          setResumeLoginTag(null)
          setTagModalPrefill(null)
        }}
        onRegister={handleRegisterFromModal}
        onLoginPasskey={handleLoginPasskeyFromModal}
        onLoginPin={handlePinLoginFromModal}
      />

      <AuthDeviceChoiceModal
        isOpen={showDeviceChoice}
        onClose={() => {
          setShowDeviceChoice(false)
          setIsAuthenticating(false)
        }}
        onScanOtherDevice={() => {
          setShowDeviceChoice(false)
          void attemptDiscoveryLogin()
        }}
        onCreateAccount={() => {
          setShowDeviceChoice(false)
          setSignupPrefill(null)
          setShowSignup(true)
        }}
      />

      {showQRModal && qrUsername && (
        <QRCodeRegistrationModal
          isOpen={showQRModal}
          username={qrUsername}
          recoveryEmail={pendingRecoveryEmail}
          onComplete={async (userId, username, credentialId) => {
            console.log("[Auth] QR flow completed:", { userId, username, credentialId })
            setShowQRModal(false)
            // Finalize login with the completed registration
            if (typeof window !== "undefined") {
              localStorage.setItem("sozu_username", username)
              persistAuthIdentitySession({
                userId,
                credentialId,
                username
              })
            }
            setIsAuthenticated(true)
            setIsAuthenticating(false)
            if (connectMode) {
              let connectAccountId: string | null = null
              try {
                const { alignWalletMaterialAfterLogin } = await import(
                  "@/lib/storage/post-login-wallet"
                )
                const { publicKey, needsWalletSync } = await alignWalletMaterialAfterLogin(
                  userId,
                  credentialId,
                )
                if (!needsWalletSync && publicKey) {
                  connectAccountId = publicKey
                  persistClientWalletSession({
                    userId,
                    publicKey,
                    credentialId,
                    username,
                  })
                }
              } catch (walletError) {
                console.error("[Auth] Connect still waiting on wallet after QR signup:", walletError)
              }
              completeConnect(username, connectAccountId)
              return
            }
            if (stayOnAuthForPizza) {
              try {
                const { alignWalletMaterialAfterLogin } = await import(
                  "@/lib/storage/post-login-wallet"
                )
                const { publicKey, needsWalletSync } = await alignWalletMaterialAfterLogin(
                  userId,
                  credentialId,
                )
                if (!needsWalletSync && publicKey) {
                  persistClientWalletSession({
                    userId,
                    publicKey,
                    credentialId,
                    username,
                  })
                }
              } catch (walletError) {
                console.error("[Auth] Pizza hop still waiting on wallet after QR signup:", walletError)
              }
              redirectingRef.current = false
              setIsExiting(false)
              return
            }
            redirectingRef.current = true
            setIsExiting(true)
            setTimeout(
              () => navigatePostAuth(finalPostAuthPath, (p) => router.push(p)),
              300,
            )
          }}
          onCancel={() => {
            setShowQRModal(false)
            setQRUsername(null)
            setIsAuthenticating(false)
            setSignupPrefill(qrUsername)
            setShowSignup(true)
          }}
        />
      )}

      {/* iOS "Add to Home Screen" instructions modal */}
      <AnimatePresence>
        {showIosInstallModal && (
          <>
            {/* Backdrop */}
            <motion.div
              key="ios-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowIosInstallModal(false)}
            />

            {/* Bottom sheet */}
            <motion.div
              key="ios-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[#111] border-t border-white/10 px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              {/* Handle */}
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-white font-semibold text-base">Instala Sozu en tu iPhone</p>
                  <p className="text-white/45 text-xs mt-0.5">3 pasos rápidos desde Safari — sin App Store</p>
                </div>
                <button
                  onClick={() => setShowIosInstallModal(false)}
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 ml-4"
                  aria-label={t.authClose}
                >
                  <X className="w-3.5 h-3.5 text-white/60" />
                </button>
              </div>

              {/* Steps */}
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-white/60">1</span>
                  <div className="pt-0.5 min-w-0">
                    <p className="text-white text-[13px] font-medium leading-snug">Abre esta página en Safari</p>
                    <p className="text-white/45 text-[11px] mt-0.5 leading-snug">
                      La instalación solo funciona desde el navegador Safari de Apple
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-white/60">2</span>
                  <div className="pt-0.5 min-w-0">
                    <p className="text-white text-[13px] font-medium leading-snug">
                      Toca{" "}
                      <Share className="inline w-3.5 h-3.5 text-[#0a84ff] align-text-bottom" />
                      {" "}<span className="text-[#0a84ff]">Compartir</span>{" "}en la barra inferior
                    </p>
                    <p className="text-white/45 text-[11px] mt-0.5 leading-snug">
                      Es el ícono de cuadrado con flecha hacia arriba
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-white/60">3</span>
                  <div className="pt-0.5 min-w-0">
                    <p className="text-white text-[13px] font-medium leading-snug">
                      Selecciona{" "}<span className="text-white font-semibold">"Agregar a pantalla de inicio"</span>
                    </p>
                    <p className="text-white/45 text-[11px] mt-0.5 leading-snug">
                      Desplázate en el menú hasta encontrarlo, luego toca{" "}
                      <span className="text-white/70">"Agregar"</span> arriba a la derecha
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-semibold text-emerald-400">✓</span>
                  <div className="pt-0.5 min-w-0">
                    <p className="text-white text-[13px] font-medium leading-snug">Sozu aparece en tu inicio</p>
                    <p className="text-white/45 text-[11px] mt-0.5 leading-snug">
                      Ábrela como cualquier app — sin App Store, sin contraseñas
                    </p>
                  </div>
                </li>
              </ol>

              {/* Dismiss button */}
              <button
                onClick={() => setShowIosInstallModal(false)}
                className="mt-5 w-full py-3.5 rounded-2xl bg-white text-black text-[13px] font-semibold hover:bg-white/90 active:scale-[0.98] transition-all"
              >
                Entendido
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AuthPage() {
  return (
    <WalletLanguageProvider>
      <Suspense fallback={
        <div className="flex min-h-[var(--sozu-app-height,100lvh)] items-center justify-center text-white">
          <div className="text-white">Cargando…</div>
        </div>
      }>
        <AuthPageContent />
      </Suspense>
    </WalletLanguageProvider>
  )
}
