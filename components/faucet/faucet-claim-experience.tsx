"use client";

/**
 * Secret tap claim. The wallet's blue wave sits behind a generative tree.
 * No toasts, no confetti, no tx hashes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FaucetPwaHandler } from "@/components/faucet/faucet-pwa-handler";
import { ShaderBackground } from "@/components/ui/adisyon-shader";
import { GenerativeTree } from "@/components/ui/generative-tree";
import { isClientAuthed } from "@/lib/client-auth-gate";
import { FAUCET_TAP_PATH } from "@/lib/faucet/tap-path";
import { getFaucetTexts, readFaucetLanguage } from "@/lib/faucet/texts";
import {
  hapticClaimError,
  hapticClaimPress,
  hapticClaimSuccess,
  hapticClaimingPulse,
} from "@/lib/haptics/web-haptics";
import type {
  FaucetClaimResponse,
  FaucetStatusResponse,
} from "@/lib/faucet/types";

const FAUCET_RETURN_KEY = "sozu_faucet_return";
const MIN_CLAIM_THEATRE_MS = 2800;

type Phase =
  | "loading"
  | "unauthenticated"
  | "available"
  | "claiming"
  | "success"
  | "empty"
  | "global_cooldown"
  | "user_cooldown"
  | "inactive"
  | "not_found"
  | "error";

function getStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("dev_username") ?? sessionStorage.getItem("dev_username")
  );
}

export function FaucetClaimExperience({ slug }: { slug: string }) {
  const router = useRouter();
  const t = useMemo(() => getFaucetTexts(readFaucetLanguage()), []);

  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<FaucetStatusResponse | null>(null);
  const [nextAvailableAt, setNextAvailableAt] = useState<string | null>(null);
  const [claimedAmount, setClaimedAmount] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [showHow, setShowHow] = useState(false);
  const claimingRef = useRef(false);

  const applyAvailability = useCallback(
    (data: FaucetStatusResponse) => {
      setStatus(data);
      setNextAvailableAt(data.availability.nextAvailableAt ?? null);
      if (data.faucet.status !== "active") {
        setPhase("inactive");
        return;
      }
      if (data.availability.available) {
        setPhase("available");
        return;
      }
      switch (data.availability.reason) {
        case "empty_today":
        case "insufficient_vault":
        case "pilot_cap":
        case "pilot_contract_required":
          setPhase("empty");
          break;
        case "global_cooldown":
          setPhase("global_cooldown");
          break;
        case "user_cooldown":
          setPhase("user_cooldown");
          break;
        case "mainnet_refused":
        case "pilot_slug":
          setPhase("inactive");
          break;
        default:
          setPhase("inactive");
      }
    },
    [],
  );

  const fetchStatus = useCallback(async () => {
    const userId = getStoredUserId();
    const headers: HeadersInit = {};
    const res = await fetch(`/api/faucets/${encodeURIComponent(slug)}/status`, {
      headers,
      cache: "no-store",
    });
    if (res.status === 404) {
      setPhase("not_found");
      return;
    }
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as FaucetStatusResponse;

    if (!isClientAuthed()) {
      setStatus(data);
      setPhase("unauthenticated");
      return;
    }
    applyAvailability(data);
  }, [slug, applyAvailability]);

  // Arrived (back) at the faucet — clear the post-auth return marker.
  useEffect(() => {
    try {
      sessionStorage.removeItem(FAUCET_RETURN_KEY);
    } catch {
      /* private browsing */
    }
  }, []);

  // Intro: hold the black screen with a distant orb, then resolve real state.
  useEffect(() => {
    let cancelled = false;
    const intro = new Promise((r) => setTimeout(r, 1600));
    Promise.all([fetchStatus().catch(() => setPhase("error")), intro]).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [fetchStatus]);

  // Countdown ticker for cooldown / empty states.
  useEffect(() => {
    if (!nextAvailableAt) return;
    const target = new Date(nextAvailableAt).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setCountdown("");
        fetchStatus().catch(() => {});
        return;
      }
      const totalMin = Math.ceil(diff / 60_000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      setCountdown(
        h > 0 ? `${h} ${t.hoursShort} ${m} ${t.minutesShort}` : `${m} ${t.minutesShort}`,
      );
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextAvailableAt, fetchStatus, t]);

  // Soft haptic pulse while the transfer is in flight.
  useEffect(() => {
    if (phase !== "claiming") return;
    const id = setInterval(() => hapticClaimingPulse(), 500);
    return () => clearInterval(id);
  }, [phase]);

  const goCreateWallet = useCallback(() => {
    hapticClaimPress();
    try {
      sessionStorage.setItem(FAUCET_RETURN_KEY, FAUCET_TAP_PATH);
    } catch {
      /* private browsing */
    }
    router.push(`/auth?redirect=${encodeURIComponent(FAUCET_TAP_PATH)}`);
  }, [router]);

  const handleClaim = useCallback(async () => {
    if (claimingRef.current) return;
    claimingRef.current = true;
    hapticClaimPress();
    setPhase("claiming");

    const startedAt = Date.now();
    try {
      const userId = getStoredUserId();
      const res = await fetch(`/api/faucets/${encodeURIComponent(slug)}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = (await res.json()) as FaucetClaimResponse;

      // Let the orb finish gathering energy before resolving.
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_CLAIM_THEATRE_MS) {
        await new Promise((r) => setTimeout(r, MIN_CLAIM_THEATRE_MS - elapsed));
      }

      if (data.success) {
        setClaimedAmount(data.amount);
        hapticClaimSuccess();
        setPhase("success");
        return;
      }

      setNextAvailableAt(data.nextAvailableAt ?? null);
      hapticClaimError();
      switch (data.reason) {
        case "empty_today":
        case "insufficient_vault":
        case "pilot_cap":
        case "pilot_contract_required":
          setPhase("empty");
          break;
        case "mainnet_refused":
        case "pilot_slug":
          setPhase("inactive");
          break;
        case "global_cooldown":
          setPhase("global_cooldown");
          break;
        case "user_cooldown":
          setPhase("user_cooldown");
          break;
        case "inactive":
          setPhase("inactive");
          break;
        default:
          setPhase("error");
      }
    } catch {
      hapticClaimError();
      setPhase("error");
    } finally {
      claimingRef.current = false;
    }
  }, [slug]);

  const amount = claimedAmount ?? status?.faucet.claimAmount ?? 1;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-end overflow-hidden bg-[#021018]">
      <FaucetPwaHandler />
      <ShaderBackground className="pointer-events-none absolute inset-0 h-full w-full" />
      <GenerativeTree
        hue={188}
        saturation={1.15}
        brightness={1.15}
        speed={phase === "claiming" ? 1.5 : 1}
        className="absolute inset-0"
      />

      <div className="relative z-20 mb-[max(2rem,env(safe-area-inset-bottom))] flex w-full max-w-sm flex-col items-center px-8 text-center">
        <AnimatePresence mode="wait">
          {phase === "loading" && (
            <motion.p
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="text-sm tracking-wide text-white/60"
            >
              {t.loadingLabel}
            </motion.p>
          )}

          {phase === "unauthenticated" && (
            <motion.div
              key="unauth"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <h1 className="text-2xl font-semibold text-white">
                {t.noWalletTitle}
              </h1>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">
                {t.noWalletBody}
              </p>
              <button
                onClick={goCreateWallet}
                className="mt-2 w-full rounded-full border border-white/15 bg-white px-8 py-3.5 text-base font-semibold text-[#042433] shadow-[0_0_30px_rgba(90,190,230,0.35)] transition-transform active:scale-95"
              >
                {t.createWalletCta}
              </button>
            </motion.div>
          )}

          {phase === "available" && (
            <motion.div
              key="available"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <h1 className="text-2xl font-semibold text-white">
                {t.availableTitle}
              </h1>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">
                {t.availableBody}
              </p>
              <button
                onClick={handleClaim}
                className="mt-2 w-full rounded-full border border-white/15 bg-white px-8 py-3.5 text-base font-semibold text-[#042433] shadow-[0_0_30px_rgba(90,190,230,0.35)] transition-transform active:scale-95"
              >
                {t.claimCta}
              </button>
              <button
                onClick={() => setShowHow(true)}
                className="text-sm text-white/50 underline-offset-4 hover:underline"
              >
                {t.howItWorks}
              </button>
            </motion.div>
          )}

          {phase === "claiming" && (
            <motion.div
              key="claiming"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center gap-3"
            >
              <h1 className="text-xl font-medium text-white">
                {t.claimingTitle}
              </h1>
              <p className="whitespace-pre-line text-sm text-white/60">
                {t.claimingBody}
              </p>
            </motion.div>
          )}

          {phase === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.4 }}
              className="flex flex-col items-center gap-5"
            >
              {/* Floating glass card — only the amount. No tx hash, no addresses. */}
              <div className="rounded-3xl border border-white/15 bg-white/10 px-10 py-6 backdrop-blur-xl shadow-[0_0_60px_rgba(56,189,248,0.2)]">
                <p className="text-3xl font-semibold tracking-tight text-white">
                  {t.successAmount(amount)}
                </p>
                <p className="mt-1 text-sm text-white/70">{t.successReceived}</p>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">
                {t.successBody}
              </p>
              <Link
                href="/home"
                className="mt-1 w-full rounded-full border border-white/15 bg-white px-8 py-3.5 text-center text-base font-semibold text-[#042433] shadow-[0_0_30px_rgba(90,190,230,0.35)] transition-transform active:scale-95"
              >
                {t.viewWalletCta}
              </Link>
            </motion.div>
          )}

          {phase === "empty" && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <h1 className="text-2xl font-semibold text-white/90">
                {t.emptyTitle}
              </h1>
              <p className="text-sm italic text-white/50">{t.emptyPoetic}</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/60">
                {t.emptyBody}
              </p>
              {countdown && (
                <p className="text-lg font-medium text-sky-100">{countdown}</p>
              )}
              <Link
                href="/faucets/map"
                className="mt-1 rounded-full border border-white/25 px-8 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
              >
                {t.viewMapCta}
              </Link>
            </motion.div>
          )}

          {phase === "global_cooldown" && (
            <motion.div
              key="gcooldown"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <h1 className="text-2xl font-semibold text-white/90">
                {t.globalCooldownTitle}
              </h1>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/60">
                {t.globalCooldownBody}
              </p>
              <p className="text-2xl font-semibold tracking-tight text-sky-100">
                {countdown || "…"}
              </p>
              <Link
                href="/faucets/map"
                className="mt-1 rounded-full border border-white/25 px-8 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
              >
                {t.viewMapCta}
              </Link>
            </motion.div>
          )}

          {phase === "user_cooldown" && (
            <motion.div
              key="ucooldown"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <h1 className="text-2xl font-semibold text-white/90">
                {t.userCooldownTitle}
              </h1>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/60">
                {t.userCooldownBody}
              </p>
              <p className="text-2xl font-semibold tracking-tight text-sky-100">
                {countdown || "…"}
              </p>
              <p className="text-sm italic text-white/50">
                {t.userCooldownThanks}
              </p>
            </motion.div>
          )}

          {phase === "inactive" && (
            <motion.div
              key="inactive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <h1 className="text-xl font-medium text-white/70">
                {t.inactiveTitle}
              </h1>
              <p className="text-sm text-white/50">{t.inactiveBody}</p>
              <Link
                href="/faucets/map"
                className="mt-1 rounded-full border border-white/25 px-8 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
              >
                {t.viewMapCta}
              </Link>
            </motion.div>
          )}

          {phase === "not_found" && (
            <motion.div
              key="notfound"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <h1 className="text-xl font-medium text-white/70">
                {t.notFoundTitle}
              </h1>
              <p className="text-sm text-white/50">{t.notFoundBody}</p>
              <Link
                href="/faucets/map"
                className="mt-1 rounded-full border border-white/25 px-8 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
              >
                {t.viewMapCta}
              </Link>
            </motion.div>
          )}

          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <h1 className="text-2xl font-semibold text-white/90">
                {t.errorTitle}
              </h1>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/60">
                {t.errorBody}
              </p>
              <button
                onClick={() => {
                  hapticClaimPress();
                  setPhase("loading");
                  fetchStatus().catch(() => setPhase("error"));
                }}
                className="mt-2 w-full rounded-full border border-white/15 bg-white px-8 py-3.5 text-base font-semibold text-[#042433] shadow-[0_0_30px_rgba(90,190,230,0.35)] transition-transform active:scale-95"
              >
                {t.retryCta}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* How it works — minimal glass sheet, background stays alive */}
      <AnimatePresence>
        {showHow && (
          <motion.div
            className="absolute inset-0 z-40 flex items-end justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHow(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl border-t border-white/15 bg-[#021018]/95 px-7 pb-10 pt-6 backdrop-blur-xl"
            >
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
              <h2 className="text-lg font-semibold text-white">
                {t.tooltipTitle}
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70">
                {t.tooltipBody}
              </p>
              <button
                onClick={() => setShowHow(false)}
                className="mt-6 w-full rounded-full border border-white/25 px-8 py-3 text-sm font-medium text-white/80"
              >
                OK
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
