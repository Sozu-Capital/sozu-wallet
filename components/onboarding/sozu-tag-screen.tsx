"use client"

import { formatSozuTagLabel } from "@/lib/payment/sozu-tag-lookup"
import { formatWalletText } from "@/lib/wallet-texts"
import { useWalletLanguage } from "@/lib/wallet-language"
import { useSozuTagAvailability } from "@/hooks/use-sozu-tag-availability"
import { SozuButton, SozuTextButton } from "@/components/ui/sozu-button"
import { ObsidianIcon } from "@/components/onboarding/obsidian-icon"
import { ProgressPills } from "@/components/onboarding/progress-pills"
import { SozuTagInput } from "@/components/onboarding/sozu-tag-input"

type SozuTagScreenProps = {
  initialTag?: string
  onContinue?: (tag: string) => void
  onSignIn?: (tag: string) => void
  onHaveTag?: (tag: string) => void
}

export function SozuTagScreen({ initialTag = "", onContinue, onSignIn, onHaveTag }: SozuTagScreenProps) {
  const { t, language } = useWalletLanguage()
  const field = useSozuTagAvailability(language, initialTag)
  const label = formatSozuTagLabel(field.value)
  const canContinue = field.status === "available"

  const message =
    field.status === "available"
      ? formatWalletText(t.onbTagAvailable, { tag: label })
      : field.status === "taken"
        ? formatWalletText(t.onbTagTaken, { tag: label })
        : field.status === "checking"
          ? formatWalletText(t.onbTagChecking, { tag: label || t.onbTagFieldLabel })
          : field.status === "invalid"
            ? t.onbTagTooShort
            : field.status === "error"
              ? t.onbTagCheckFailed
              : undefined

  return (
    <main
      className="sozu-night mx-auto flex w-full max-w-[430px] flex-col"
      style={{ height: "var(--sozu-visual-viewport-height, var(--sozu-app-height))" }}
      aria-labelledby="sozu-tag-title"
    >
      <header className="px-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 18px)" }}>
        <ProgressPills
          count={4}
          current={0}
          label={formatWalletText(t.onbSetupLabel, { current: 1, count: 4 })}
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pb-4">
        <div className="mt-6">
          <ObsidianIcon size={88} />
        </div>
        <h1
          id="sozu-tag-title"
          tabIndex={-1}
          className="sozu-serif mt-5 max-w-[342px] text-balance text-center text-[38px] font-normal leading-10 tracking-[-0.015em] text-[var(--sozu-text-primary)] outline-none"
        >
          {t.onbPickTagTitle}
        </h1>
        <p className="sozu-serif mt-2.5 max-w-[342px] text-pretty text-center text-[21px] italic leading-[26px] text-[var(--sozu-text-italic)]">
          {t.onbPickTagBody}
        </p>
        <SozuTagInput
          className="mt-6 max-w-[342px]"
          value={field.value}
          status={field.status}
          label={t.onbTagFieldLabel}
          message={message}
          rules={t.onbTagRules}
          filterHint={field.filterHint ? t.onbTagFilterHint : undefined}
          suggestions={field.suggestions}
          tryLabel={t.onbTagTry}
          signInLabel={t.onbTagSignIn}
          retryLabel={t.onbTagRetry}
          clearLabel={t.onbTagClear}
          previewCaption={t.onbTagPreview}
          autoFocus
          shake={field.shake > 0}
          key={field.shake}
          onValueChange={field.onValueChange}
          onFocus={field.onFocus}
          onBlur={field.onBlur}
          onSubmit={() => {
            const tag = field.submit()
            if (tag) onContinue?.(tag)
          }}
          onRetry={field.retry}
          onSignIn={() => onSignIn?.(field.value)}
          onSelectSuggestion={field.onValueChange}
        />
      </div>

      <footer
        className="px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}
      >
        <div className="mx-auto flex w-full max-w-[342px] flex-col items-center gap-1">
          <SozuButton
            disabled={!canContinue}
            onClick={() => {
              const tag = field.submit()
              if (tag) onContinue?.(tag)
            }}
          >
            {t.onbTagContinue}
          </SozuButton>
          <SozuTextButton onClick={() => onHaveTag?.(field.value)}>{t.onbTagHaveOne}</SozuTextButton>
        </div>
      </footer>
    </main>
  )
}
