"use client"

import type { ReactNode } from "react"

/**
 * Dark signup card. The mark, the title, and the rounded fields sit in one
 * panel; the sentence under the panel is the recovery notice.
 */
export function AccountAccessCard({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#0c0c0c] px-5">
      <div className="w-full max-w-[420px] rounded-[28px] bg-[#1c1c1c] px-7 pb-7 pt-10 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <img
          src="/brand/november-2026/mark.png"
          alt=""
          className="mx-auto h-16 w-16 object-contain"
        />
        <h1 className="mt-6 text-center text-[1.75rem] font-semibold tracking-tight text-white">
          {title}
        </h1>
        <div className="mt-8 flex flex-col gap-3">{children}</div>
      </div>
      {footer ? (
        <p className="mt-8 max-w-[420px] text-center text-[15px] leading-relaxed text-white/55">
          {footer}
        </p>
      ) : null}
    </div>
  )
}

export const accountFieldClass =
  "h-14 w-full rounded-2xl border-0 bg-[#2a2a2a] px-5 text-base text-white outline-none placeholder:text-white/40"

export const accountButtonClass =
  "h-14 w-full rounded-2xl bg-[#2e2e2e] text-base font-medium text-white transition-colors hover:bg-[#3a3a3a] disabled:opacity-50"
