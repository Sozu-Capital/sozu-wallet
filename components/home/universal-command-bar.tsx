"use client"

import { ArrowDownToLine, ArrowUp, ArrowUpFromLine, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatWalletText } from "@/lib/wallet-texts"
import { useWalletLanguage } from "@/lib/wallet-language"

const actionIconClass = cn(
  "flex h-12 w-12 items-center justify-center rounded-2xl",
  "border border-white/15 bg-white/[0.08] text-white",
  "shadow-[0_10px_28px_rgba(0,0,0,0.28)]",
  "transition-colors group-hover:bg-white/[0.14] group-active:scale-95",
)

export function UniversalCommandBar({
  className,
  onDepositClick,
  onSendClick,
  onWithdrawClick,
  onEarnClick,
}: {
  className?: string
  onDepositClick?: () => void
  onSendClick?: () => void
  onWithdrawClick?: () => void
  onEarnClick?: () => void
}) {
  const { t } = useWalletLanguage()

  const showComingSoon = (label: string) => {
    toast(t.comingSoon, {
      description: formatWalletText(t.comingSoonDesc, { label }),
    })
  }

  const actions = [
    { key: "deposit", label: t.cmdDeposit, icon: ArrowDownToLine, onClick: onDepositClick },
    { key: "send", label: t.cmdSend, icon: ArrowUp, onClick: onSendClick },
    { key: "withdraw", label: t.cmdWithdraw, icon: ArrowUpFromLine, onClick: onWithdrawClick },
    {
      key: "earn",
      label: t.cmdEarn,
      icon: TrendingUp,
      onClick: onEarnClick ?? (() => showComingSoon(t.cmdEarn)),
    },
  ] as const

  return (
    <div className={cn("grid w-full grid-cols-4", className)}>
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick ?? (() => showComingSoon(action.label))}
            className="group flex min-w-0 flex-col items-center gap-1.5"
          >
            <span className={actionIconClass}>
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="max-w-full text-center text-[11px] font-medium leading-tight text-white/85">
              {action.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
