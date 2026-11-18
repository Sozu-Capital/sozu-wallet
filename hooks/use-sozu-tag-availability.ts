"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { normalizeSozuTag } from "@/lib/payment/sozu-tag-lookup"
import {
  sozuTagSuggestions,
  tagFieldStatus,
  type TagCheckPhase,
  type TagStatus,
} from "@/lib/onboarding/sozu-tag"
import type { WalletLanguage } from "@/lib/wallet-texts"

type CheckResult = { ok: true; available: boolean } | { ok: false }

async function checkTag(username: string, lang: WalletLanguage): Promise<CheckResult> {
  const response = await fetch("/api/auth/username/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, lang }),
  })
  const data = (await response.json()) as { available?: boolean }
  if (!response.ok || typeof data.available !== "boolean") return { ok: false }
  return { ok: true, available: data.available }
}

export function useSozuTagAvailability(language: WalletLanguage, initial = "") {
  const [value, setValue] = useState(initial)
  const [focused, setFocused] = useState(false)
  const [showInvalid, setShowInvalid] = useState(false)
  const [phase, setPhase] = useState<TagCheckPhase | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [filterHint, setFilterHint] = useState(false)
  const [shake, setShake] = useState(0)
  const verified = useRef(new Map<string, boolean>())
  const generation = useRef(0)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const valueRef = useRef("")
  valueRef.current = value

  const status: TagStatus = tagFieldStatus({ value, focused, phase, showInvalid })

  const remember = useCallback((tag: string, available: boolean) => {
    verified.current.set(tag.toLowerCase(), available)
  }, [])

  const loadSuggestions = useCallback(
    async (tag: string, gen: number) => {
      const candidates = sozuTagSuggestions(tag).filter(
        (candidate) => verified.current.get(candidate.toLowerCase()) !== false,
      )
      const checks = await Promise.all(
        candidates.map(async (candidate) => {
          const cached = verified.current.get(candidate.toLowerCase())
          if (cached === true) return candidate
          const next = await checkTag(candidate, language)
          if (!next.ok) return null
          remember(candidate, next.available)
          return next.available ? candidate : null
        }),
      )
      if (gen !== generation.current) return
      setSuggestions(checks.filter((candidate): candidate is string => Boolean(candidate)).slice(0, 3))
    },
    [language, remember],
  )

  const runCheck = useCallback(
    async (tag: string, gen: number) => {
      setPhase("checking")
      setSuggestions([])
      try {
        const result = await checkTag(tag, language)
        if (gen !== generation.current) return
        if (!result.ok) {
          setPhase("error")
          return
        }
        remember(tag, result.available)
        if (result.available) {
          setPhase("available")
          return
        }
        setPhase("taken")
        await loadSuggestions(tag, gen)
      } catch {
        if (gen !== generation.current) return
        setPhase("error")
      }
    },
    [language, loadSuggestions, remember],
  )

  useEffect(() => {
    if (value.length < 3) return
    const cached = verified.current.get(value.toLowerCase())
    if (cached === true) {
      setPhase("available")
      setSuggestions([])
      return
    }
    if (cached === false) {
      setPhase("taken")
      void loadSuggestions(value, generation.current)
      return
    }
    const gen = generation.current
    const timer = setTimeout(() => {
      void runCheck(value, gen)
    }, 400)
    return () => clearTimeout(timer)
  }, [loadSuggestions, value, runCheck])

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current)
    }
  }, [])

  const onValueChange = useCallback((raw: string) => {
    const stripped = raw.replace(/^\$+/, "")
    const next = normalizeSozuTag(raw).slice(0, 30)
    if (stripped !== next) {
      setFilterHint(true)
      if (hintTimer.current) clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setFilterHint(false), 2000)
    }
    if (next === valueRef.current) return
    generation.current += 1
    setPhase(null)
    setSuggestions([])
    setShowInvalid(false)
    setValue(next)
  }, [])

  const onFocus = useCallback(() => setFocused(true), [])

  const onBlur = useCallback(() => {
    setFocused(false)
    setShowInvalid(true)
  }, [])

  const retry = useCallback(() => {
    if (value.length < 3) return
    const gen = ++generation.current
    void runCheck(value, gen)
  }, [runCheck, value])

  const submit = useCallback(() => {
    if (status === "available") return value
    setShowInvalid(true)
    setShake((n) => n + 1)
    return null
  }, [status, value])

  return {
    value,
    status,
    suggestions,
    filterHint,
    focused,
    shake,
    onValueChange,
    onFocus,
    onBlur,
    retry,
    submit,
  }
}
