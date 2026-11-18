"use client"

const PIECES = [
  { left: "6%", delay: "0s", duration: "3.4s", color: "#fff7ed", size: 7, drift: "-18px" },
  { left: "14%", delay: "0.4s", duration: "3.8s", color: "#fdba74", size: 9, drift: "22px" },
  { left: "22%", delay: "0.15s", duration: "3.1s", color: "#ffffff", size: 6, drift: "10px" },
  { left: "31%", delay: "0.7s", duration: "4.1s", color: "#fb923c", size: 8, drift: "-26px" },
  { left: "39%", delay: "0.2s", duration: "3.6s", color: "#ffedd5", size: 5, drift: "16px" },
  { left: "48%", delay: "0.9s", duration: "3.3s", color: "#ffffff", size: 8, drift: "-12px" },
  { left: "57%", delay: "0.05s", duration: "4.2s", color: "#fdba74", size: 6, drift: "20px" },
  { left: "66%", delay: "0.55s", duration: "3.5s", color: "#fff", size: 10, drift: "-8px" },
  { left: "74%", delay: "0.3s", duration: "3.9s", color: "#f97316", size: 7, drift: "14px" },
  { left: "83%", delay: "0.8s", duration: "3.2s", color: "#ffedd5", size: 6, drift: "-20px" },
  { left: "91%", delay: "0.1s", duration: "4s", color: "#ffffff", size: 8, drift: "8px" },
  { left: "18%", delay: "1.2s", duration: "3.7s", color: "#fb923c", size: 5, drift: "24px" },
  { left: "52%", delay: "1.4s", duration: "3.4s", color: "#fff7ed", size: 7, drift: "-16px" },
  { left: "78%", delay: "1.1s", duration: "4.3s", color: "#fdba74", size: 9, drift: "12px" },
] as const

/** A light burst behind a confirmed collectible payment. */
export function PaymentConfetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" data-payment-confetti="">
      <style>{`@keyframes sozu-confetti-fall{0%{transform:translate3d(0,-12vh,0) rotate(0deg);opacity:0}15%{opacity:.95}100%{transform:translate3d(var(--drift),108vh,0) rotate(280deg);opacity:.35}}@media (prefers-reduced-motion:reduce){[data-payment-confetti]{display:none}}`}</style>
      {PIECES.map((piece) => (
        <span
          key={`${piece.left}-${piece.delay}`}
          className="absolute top-0 block rounded-sm"
          style={{
            left: piece.left,
            width: piece.size,
            height: piece.size * 1.6,
            background: piece.color,
            ["--drift" as string]: piece.drift,
            animation: `sozu-confetti-fall ${piece.duration} ${piece.delay} linear infinite`,
          }}
        />
      ))}
    </div>
  )
}
