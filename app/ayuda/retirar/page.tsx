import { readFileSync } from "node:fs"
import path from "node:path"
import type { Metadata } from "next"
import type { ReactNode } from "react"

export const dynamic = "force-static"

export const metadata: Metadata = {
  title: "Cómo retirar todo tu dinero — Sozu",
}

/** Renders docs/pilot/retirar-todo.md (single source of truth) at build time. Supports the subset that file uses. */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${m.index}`
    if (m[1]) out.push(<strong key={key} className="font-semibold text-white">{m[1]}</strong>)
    else if (m[2]) out.push(<code key={key} className="rounded bg-white/10 px-1 font-mono text-[0.9em]">{m[2]}</code>)
    else out.push(<a key={key} href={m[4]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{m[3]}</a>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

type Block =
  | { type: "h1" | "h2" | "p"; text: string }
  | { type: "ul" | "ol"; items: { text: string; children: string[] }[] }

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = []
  for (const line of md.split("\n")) {
    const nested = /^ {2,}- (.*)$/.exec(line)
    const bullet = /^- (.*)$/.exec(line)
    const numbered = /^\d+\. (.*)$/.exec(line)
    const prev = blocks[blocks.length - 1]
    if (line.startsWith("## ")) blocks.push({ type: "h2", text: line.slice(3) })
    else if (line.startsWith("# ")) blocks.push({ type: "h1", text: line.slice(2) })
    else if (nested && prev && (prev.type === "ul" || prev.type === "ol")) prev.items[prev.items.length - 1]?.children.push(nested[1])
    else if (bullet || numbered) {
      const type = bullet ? "ul" : "ol"
      const text = (bullet ?? numbered)![1]
      if (prev?.type === type) prev.items.push({ text, children: [] })
      else blocks.push({ type, items: [{ text, children: [] }] })
    } else if (line.trim()) blocks.push({ type: "p", text: line.trim() })
  }
  return blocks
}

export default function RetirarGuidePage() {
  const md = readFileSync(path.join(process.cwd(), "docs/pilot/retirar-todo.md"), "utf8")
  const blocks = parseMarkdown(md)
  return (
    <main className="min-h-dvh bg-black px-5 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))] text-white/80">
      <article className="mx-auto flex max-w-lg flex-col gap-4 text-[15px] leading-relaxed">
        {blocks.map((b, i) => {
          if (b.type === "h1") return <h1 key={i} className="text-2xl font-semibold text-white">{renderInline(b.text)}</h1>
          if (b.type === "h2") return <h2 key={i} className="mt-4 text-lg font-semibold text-white">{renderInline(b.text)}</h2>
          if (b.type === "p") return <p key={i}>{renderInline(b.text)}</p>
          if (b.type !== "ul" && b.type !== "ol") return null
          const List = b.type === "ul" ? "ul" : "ol"
          return (
            <List key={i} className={`flex flex-col gap-2 pl-5 ${b.type === "ul" ? "list-disc" : "list-decimal"}`}>
              {b.items.map((item, j) => (
                <li key={j}>
                  {renderInline(item.text)}
                  {item.children.length > 0 ? (
                    <ul className="mt-1 flex list-[circle] flex-col gap-1 pl-5">
                      {item.children.map((c, k) => <li key={k}>{renderInline(c)}</li>)}
                    </ul>
                  ) : null}
                </li>
              ))}
            </List>
          )
        })}
        <a href="/home" className="mt-6 text-center text-sm text-white/50 underline underline-offset-4">
          Volver a Sozu
        </a>
      </article>
    </main>
  )
}
