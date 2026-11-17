"use client";

/**
 * NFC tags open URLs in the system browser. When the Sozu PWA is installed,
 * prefer opening faucet links inside the installed app (Android: manifest
 * handle_links; iOS: user must launch from home screen — we nudge them here).
 */

import { useEffect, useState } from "react";
import { FAUCET_TAP_PATH } from "@/lib/faucet/tap-path";
import { isPwaStandalone, wasPwaInstalled } from "@/lib/pwa/standalone";

export function FaucetPwaHandler() {
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPwaStandalone()) return;

    // Android Chrome: with handle_links=preferred in manifest, installed PWAs
    // should capture same-origin navigations. Re-navigate once to trigger capture.
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid && wasPwaInstalled()) {
      const key = "sozu_faucet_pwa_capture:tap";
      if (!sessionStorage.getItem(key)) {
        try {
          sessionStorage.setItem(key, "1");
          window.location.replace(FAUCET_TAP_PATH);
        } catch {
          /* ignore */
        }
      }
    }

    if (wasPwaInstalled()) {
      setShowNudge(true);
    }
  }, []);

  if (!showNudge || isPwaStandalone()) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="max-w-sm rounded-2xl border border-white/15 bg-[#021018]/85 px-4 py-3 text-center backdrop-blur-xl shadow-lg">
        <p className="text-xs leading-relaxed text-white/80">
          Abre Sozu desde tu pantalla de inicio para la mejor experiencia con el NFC.
        </p>
        <button
          type="button"
          onClick={() => setShowNudge(false)}
          className="mt-2 text-[10px] uppercase tracking-wider text-white/45"
        >
          Continuar en el navegador
        </button>
      </div>
    </div>
  );
}
