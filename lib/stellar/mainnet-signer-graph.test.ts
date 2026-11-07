import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { isPilotBlockedPath } from "@/lib/pilot/pilot-mainnet"

const root = path.resolve(__dirname, "../..")

const FORBIDDEN = new Set([
  "lib/webauthn/key-derivation.ts",
  "lib/stellar/ensure-passkey-signer.ts",
  "lib/stellar/smart-account-provision.ts",
])

function listAppEntries(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) listAppEntries(full, out)
    else if (/^(page|route)\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

function routeUrl(file: string): string {
  const rel = path.relative(path.join(root, "app"), file)
  const dir = path.dirname(rel)
  const parts = dir.split(path.sep).filter((segment) => segment !== "." && !/^\(.*\)$/.test(segment))
  return `/${parts.join("/")}` || "/"
}

function resolveSpec(fromFile: string, spec: string): string | null {
  let target: string
  if (spec.startsWith("@/")) target = path.join(root, spec.slice(2))
  else if (spec.startsWith(".")) target = path.resolve(path.dirname(fromFile), spec)
  else return null
  const candidates = [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    path.join(target, "index.ts"),
    path.join(target, "index.tsx"),
  ]
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch {
      /* try next */
    }
  }
  return null
}

function importsOf(source: string): { spec: string; dynamic: boolean; index: number }[] {
  const found: { spec: string; dynamic: boolean; index: number }[] = []
  const re = /(?:import\s*\(\s*|from\s+)["']([^"']+)["']/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    const dynamic = match[0].startsWith("import")
    const lineStart = source.lastIndexOf("\n", match.index) + 1
    const line = source.slice(lineStart, match.index)
    if (!dynamic && /import\s+type\b/.test(line)) continue
    found.push({ spec: match[1], dynamic, index: match.index })
  }
  return found
}

function isGuardedDynamicImport(source: string, index: number): boolean {
  const prior = source.slice(0, index).split("\n").slice(-12).join("\n")
  if (/NEXT_PUBLIC_PILOT_MAINNET\s*!==\s*["']1["']/.test(prior)) return true
  if (/(?<!NEXT_PUBLIC_)PILOT_MAINNET\s*!==\s*["']1["']/.test(prior)) return true
  if (/PILOT_MAINNET\s*===\s*["']1["']/.test(prior) && /(?:throw|return)\b/.test(prior)) return true
  return false
}

function reachableForbidden(): string[] {
  const hits: string[] = []
  const seen = new Set<string>()

  function walk(file: string, chain: string[]) {
    const rel = path.relative(root, file)
    if (FORBIDDEN.has(rel)) {
      hits.push([...chain, rel].join(" -> "))
      return
    }
    if (seen.has(file)) return
    seen.add(file)
    let source: string
    try {
      source = readFileSync(file, "utf8")
    } catch {
      return
    }
    for (const imported of importsOf(source)) {
      if (imported.dynamic && isGuardedDynamicImport(source, imported.index)) continue
      const next = resolveSpec(file, imported.spec)
      if (!next || !next.startsWith(root)) continue
      walk(next, [...chain, rel])
    }
  }

  for (const file of listAppEntries(path.join(root, "app"))) {
    const url = routeUrl(file)
    if (isPilotBlockedPath(url)) continue
    walk(file, [])
  }
  return hits
}

describe("mainnet build signer graph", () => {
  it("has no call path to HKDF, ensure-passkey-signer, or G-signer provisioning", () => {
    expect(reachableForbidden()).toEqual([])
  })

  it("aliases those modules out of the PILOT_MAINNET build", () => {
    const config = readFileSync(path.join(root, "next.config.mjs"), "utf8")
    expect(config).toContain("pilotSignerAlias")
    expect(config).toContain("@/lib/webauthn/key-derivation")
    expect(config).toContain("@/lib/stellar/ensure-passkey-signer")
    expect(config).toContain("@/lib/stellar/smart-account-provision")
  })
})
