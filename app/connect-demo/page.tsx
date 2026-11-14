"use client"

import { useState } from "react"
import { login, pay, type SozuLoginResult, type SozuPayResult } from "../../packages/connect/src"

export default function ConnectDemoPage() {
  const [username, setUsername] = useState("")
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState("1")
  const [to, setTo] = useState("")
  const [output, setOutput] = useState("No result yet.")
  const [busy, setBusy] = useState(false)

  async function onLogin() {
    setBusy(true)
    try {
      const result: SozuLoginResult = await login({ origin: window.location.origin })
      setUsername(result.username)
      setAccountId(result.accountId)
      setOutput(JSON.stringify(result, null, 2))
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Login failed")
    } finally {
      setBusy(false)
    }
  }

  async function onPay() {
    setBusy(true)
    try {
      const result: SozuPayResult = await pay({
        amount,
        to,
        origin: window.location.origin,
      })
      if (!("error" in result)) {
        setUsername(result.username)
        setAccountId(result.accountId)
      }
      setOutput(JSON.stringify(result, null, 2))
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Pay failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[var(--sozu-app-height,100lvh)] w-full max-w-md flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Sozu Connect</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Login returns a username and a C account. Pay sends Circle testnet USDC that account already holds.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void onLogin()}
        disabled={busy}
        className="h-12 rounded-full bg-foreground text-background disabled:opacity-50"
      >
        Login with Sozu
      </button>

      <label className="flex flex-col gap-2 text-sm">
        Amount
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          className="h-11 rounded-xl border bg-transparent px-3"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        Destination
        <input
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="G… or C…"
          className="h-11 rounded-xl border bg-transparent px-3"
        />
      </label>

      <button
        type="button"
        onClick={() => void onPay()}
        disabled={busy}
        className="h-12 rounded-full border disabled:opacity-50"
      >
        Pay
      </button>

      <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs">{output}</pre>

      {accountId ? (
        <p className="text-xs text-muted-foreground">
          {username} · {accountId}
        </p>
      ) : null}
    </main>
  )
}
