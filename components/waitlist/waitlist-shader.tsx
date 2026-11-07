"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { usePageVisibility } from "@/hooks/use-page-visibility"
import { useShaderPerformanceTier } from "@/hooks/use-shader-performance-tier"
import {
  DESKTOP_MAX_PIXEL_COUNT,
  MOBILE_MAX_PIXEL_COUNT,
  MOBILE_MIN_PIXEL_RATIO,
} from "@/lib/shader/mobile-shader-config"

const COLORS = ["#000000", "#0b0b0b", "#1f1f1f", "#4a4a4a"]

const STATIC_BACKGROUND =
  "radial-gradient(ellipse 80% 60% at 30% 20%, #262626 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 75% 85%, #1a1a1a 0%, transparent 60%), #000"

export function WaitlistShader() {
  const tier = useShaderPerformanceTier()
  const isVisible = usePageVisibility()

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-black">
      {tier === "static" || !isVisible ? (
        <div className="absolute inset-0" style={{ background: STATIC_BACKGROUND }} />
      ) : (
        <MeshGradient
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          colors={COLORS}
          distortion={0.85}
          swirl={0.55}
          grainMixer={0}
          grainOverlay={0.12}
          speed={tier === "full" ? 0.22 : 0.14}
          minPixelRatio={MOBILE_MIN_PIXEL_RATIO}
          maxPixelCount={tier === "full" ? DESKTOP_MAX_PIXEL_COUNT : MOBILE_MAX_PIXEL_COUNT}
        />
      )}
      {/* Darkens the center so the white mark and form stay legible over the brightest swirls. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 120% 100% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </div>
  )
}
