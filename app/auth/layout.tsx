import type { ReactNode } from "react"

/**
 * Keeps every auth screen above the lock-screen shader.
 * The shader itself lives in the root shell so it can fade after /home mounts.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="relative z-10">{children}</div>
}
