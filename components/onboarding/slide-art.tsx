import type { ReactNode } from "react"
import { Fingerprint, Landmark, ScanFace } from "lucide-react"

/** Each sentence starts on its own line. The period stays with its sentence. */
export function sentenceLines(text: string): string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function BackgroundMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/november-2026/mark.png"
      alt=""
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.16] blur-[12px]"
    />
  )
}

function Tile({ children }: { children: ReactNode }) {
  return (
    <span className="sozu-obsidian flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] text-[var(--sozu-text-primary)]">
      {children}
    </span>
  )
}

export function SlideIcons({ index }: { index: number }) {
  if (index === 1) {
    return (
      <div className="mb-7 flex items-center justify-center gap-3" aria-hidden>
        <Tile>
          <ScanFace size={26} strokeWidth={1.5} />
        </Tile>
        <Tile>
          <Fingerprint size={26} strokeWidth={1.5} />
        </Tile>
      </div>
    )
  }

  if (index === 2) {
    return (
      <div className="mb-7 flex items-center justify-center gap-3" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/stellar.png" alt="" className="h-14 w-14 rounded-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/usdc.png" alt="" className="h-14 w-14 rounded-full object-cover" />
      </div>
    )
  }

  if (index === 3) {
    return (
      <div className="mb-7 flex items-center justify-center gap-3" aria-hidden>
        <Tile>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/november-2026/mark.png" alt="" className="h-[72px] w-[72px] max-w-none object-contain" />
        </Tile>
        <Tile>
          <Landmark size={26} strokeWidth={1.5} />
        </Tile>
      </div>
    )
  }

  return null
}

export function DeviceKeyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="shrink-0 text-[var(--sozu-text-primary)]">
      <rect x="6" y="1.5" width="10" height="19" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9.2 11.2a1.7 1.7 0 1 1 2.3 1.58v.9h.9v1.2h-2.1v-2.1a1.7 1.7 0 0 1-1.1-1.58z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

