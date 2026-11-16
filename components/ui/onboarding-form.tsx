"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { AtSign, Loader2, Mail, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface OnboardingFormProps {
  className?: string
  imageSrc: string
  avatarSrc?: string
  avatarFallback?: string
  title: string
  description: string
  inputPlaceholder?: string
  buttonText: string
  onUploadClick?: () => void
  onSubmit: (value: string) => void
  isSubmitting?: boolean
  submitDisabled?: boolean
  value?: string
  onValueChange?: (value: string) => void
  inputType?: React.HTMLInputTypeAttribute
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  autoComplete?: string
  autoCapitalize?: string
  leadingIcon?: React.ReactNode
  buttonIcon?: React.ReactNode
  hint?: React.ReactNode
  note?: React.ReactNode
  footer?: React.ReactNode
  hideInput?: boolean
}

const FADE_UP_ANIMATION_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const } },
}

const OnboardingForm = React.forwardRef<HTMLDivElement, OnboardingFormProps>(
  (
    {
      className,
      imageSrc,
      avatarSrc,
      avatarFallback,
      title,
      description,
      inputPlaceholder,
      buttonText,
      onUploadClick,
      onSubmit,
      isSubmitting = false,
      submitDisabled = false,
      value: controlledValue,
      onValueChange,
      inputType = "text",
      inputMode,
      autoComplete,
      autoCapitalize,
      leadingIcon,
      buttonIcon,
      hint,
      note,
      footer,
      hideInput = false,
    },
    ref,
  ) => {
    const [uncontrolled, setUncontrolled] = React.useState("")
    const value = controlledValue ?? uncontrolled

    const setValue = (next: string) => {
      onValueChange?.(next)
      if (controlledValue === undefined) setUncontrolled(next)
    }

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (submitDisabled || isSubmitting) return
      onSubmit(value)
    }

    const icon = leadingIcon ?? (inputType === "email" ? <Mail className="h-4 w-4" /> : <AtSign className="h-4 w-4" />)

    return (
      <motion.div
        initial="hidden"
        animate="show"
        exit="hidden"
        variants={{
          hidden: { opacity: 0, y: 8 },
          show: {
            opacity: 1,
            y: 0,
            transition: { staggerChildren: 0.15 },
          },
        }}
        className={cn(
          "dark w-full max-w-md overflow-hidden rounded-2xl border border-foreground/40 bg-background/60 text-foreground shadow-lg backdrop-blur-lg",
          className,
        )}
        ref={ref}
      >
        <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="h-44 overflow-hidden">
          <img src={imageSrc} alt="" className="h-full w-full object-cover object-top" />
        </motion.div>

        <div className="space-y-6 p-8 text-center">
          <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
            {note ? <div className="pt-1">{note}</div> : null}
          </motion.div>

          {avatarFallback ? (
            <motion.div
              variants={FADE_UP_ANIMATION_VARIANTS}
              className="flex items-center justify-between rounded-lg border bg-background/50 p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={avatarSrc} alt="" />
                  <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Your avatar</p>
                  <p className="text-xs text-muted-foreground">PNG or JPG up to 10MB</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onUploadClick}>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </motion.div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {hideInput ? null : (
              <motion.div variants={FADE_UP_ANIMATION_VARIANTS}>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                    {icon}
                  </span>
                  <Input
                    id="onboarding-field"
                    type={inputType}
                    inputMode={inputMode}
                    autoComplete={autoComplete}
                    autoCapitalize={autoCapitalize}
                    placeholder={inputPlaceholder}
                    className="pl-9"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {hint ? <div className="mt-2 min-h-5">{hint}</div> : null}
              </motion.div>
            )}

            <motion.div variants={FADE_UP_ANIMATION_VARIANTS}>
              <Button type="submit" className="w-full" disabled={isSubmitting || submitDisabled}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : buttonIcon}
                {buttonText}
              </Button>
              {hideInput && hint ? <div className="mt-2">{hint}</div> : null}
            </motion.div>
          </form>
          {footer ? <motion.div variants={FADE_UP_ANIMATION_VARIANTS}>{footer}</motion.div> : null}
        </div>
      </motion.div>
    )
  },
)

OnboardingForm.displayName = "OnboardingForm"

export { OnboardingForm }
