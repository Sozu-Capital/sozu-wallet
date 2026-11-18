/**
 * Minimal chainable Supabase stand-in: every query resolves to no rows, auth has no user.
 * `calls` records `.eq(column, value)` filters so tests can assert which user was queried.
 */
export type EqCall = { table: string; column: string; value: unknown }

export function createFakeSupabase(rows: Record<string, unknown[]> = {}) {
  const calls: EqCall[] = []

  function query(table: string) {
    const result = () => ({ data: rows[table] ?? null, error: null, count: 0 })
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    for (const m of [
      "select", "insert", "update", "upsert", "delete", "neq", "gt", "gte", "lt", "lte", "in",
      "is", "like", "ilike", "or", "not", "match", "filter", "order", "limit", "range", "contains",
    ]) {
      builder[m] = chain
    }
    builder.eq = (column: string, value: unknown) => {
      calls.push({ table, column, value })
      return builder
    }
    builder.single = async () => ({ data: (rows[table] ?? [])[0] ?? null, error: null })
    builder.maybeSingle = async () => ({ data: (rows[table] ?? [])[0] ?? null, error: null })
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject)
    return builder
  }

  const client = {
    from: (table: string) => query(table),
    rpc: async () => ({ data: null, error: null }),
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signUp: async () => ({ data: { user: null }, error: { message: "disabled in tests" } }),
      signOut: async () => ({ error: null }),
      admin: {
        deleteUser: async () => ({ error: null }),
      },
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: {} }) }) },
  }

  return { client, calls }
}
