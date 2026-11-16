"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { ShaderBackground } from "@/components/ui/adisyon-shader"

const FADE_MS = 700

type ShaderMode = "off" | "auth" | "home"

function shaderMode(pathname: string): ShaderMode {
  if (pathname === "/auth" || pathname.startsWith("/auth/") || pathname === "/onboarding") {
    return "auth"
  }
  if (pathname === "/home") return "home"
  return "off"
}

export function AuthShaderLayer() {
  const pathname = usePathname() ?? ""
  const target = shaderMode(pathname)
  const shownRef = useRef(target !== "off")
  const [shown, setShown] = useState(target !== "off")
  const [mode, setMode] = useState<ShaderMode>(target === "off" ? "auth" : target)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (target !== "off") {
      shownRef.current = true
      setShown(true)
      setLeaving(false)
      setMode(target)
      return
    }

    if (!shownRef.current) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const duration = reduceMotion ? 0 : FADE_MS
    setLeaving(true)
    const timer = window.setTimeout(() => {
      shownRef.current = false
      setShown(false)
      setLeaving(false)
    }, duration)
    return () => window.clearTimeout(timer)
  }, [target])

  if (!shown) return null

  const softened = mode === "home" && !leaving

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[1] h-[var(--sozu-app-height,100lvh)] w-full overflow-hidden motion-reduce:transition-none"
      style={{
        opacity: leaving ? 0 : 1,
        transitionProperty: "opacity",
        transitionDuration: `${FADE_MS}ms`,
        transitionTimingFunction: "ease-out",
      }}
    >
      <div
        className="h-full w-full motion-reduce:transition-none"
        style={{
          opacity: softened ? 0.42 : 1,
          filter: softened ? "blur(28px)" : "blur(0px)",
          transform: softened ? "scale(1.12)" : "scale(1)",
          transitionProperty: "opacity, filter, transform",
          transitionDuration: `${FADE_MS}ms`,
          transitionTimingFunction: "ease-out",
        }}
      >
        <ShaderBackground className="h-full w-full" />
      </div>
      <img
        src="/brand/november-2026/mark.png"
        alt=""
        className="pointer-events-none absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.07] blur-[12px]"
      />
    </div>
  )
}
