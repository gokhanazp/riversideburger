// Edge Function'ların kullandığı kadarıyla bir Supabase istemcisi taklidi.
// Amaç: "ödeme bitmeden orders'a hiçbir şey yazılmıyor" değişmezini kanıtlamak.

export interface Row { [k: string]: unknown }

export class FakeDB {
  tables: Record<string, Row[]> = {
    products: [], product_options: [], users: [], campaigns: [], orders: [],
    settings: [], order_items: [], order_item_customizations: [], payments: [],
    web_checkouts: [],
  };
  authUsers: { id: string; email: string }[] = [];
  /** Her yazma işlemi buraya kaydediliyor — testin asıl ölçtüğü şey. */
  writes: { table: string; op: 'insert' | 'delete'; rows: number }[] = [];
  private seq = 0;

  private uuid() {
    this.seq++;
    const n = this.seq.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${n}`;
  }

  from(table: string) {
    return new Builder(this, table);
  }

  auth = {
    getUser: async (_t: string) => ({ data: { user: null }, error: null }),
    admin: {
      createUser: async ({ email }: { email: string }) => {
        if (this.authUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
          return { data: { user: null }, error: { message: 'already registered' } };
        }
        const user = { id: this.uuid(), email };
        this.authUsers.push(user);
        return { data: { user }, error: null };
      },
      deleteUser: async (id: string) => {
        this.authUsers = this.authUsers.filter((u) => u.id !== id);
        return { data: null, error: null };
      },
    },
  };

  async rpc(fn: string, args: Record<string, unknown>) {
    if (fn === 'auth_user_id_for_email') {
      const email = String(args.p_email).toLowerCase();
      const found = this.authUsers.find((u) => u.email.toLowerCase() === email);
      return { data: found?.id ?? null, error: null };
    }
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  }

  newId() { return this.uuid(); }
}

type Filter = (r: Row) => boolean;

class Builder implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: Filter[] = [];
  private pending: { op: 'select' | 'insert' | 'delete'; payload?: Row | Row[] } = { op: 'select' };
  private limitN: number | null = null;

  constructor(private db: FakeDB, private table: string) {}

  select(_cols?: string) { if (this.pending.op === 'select') this.pending = { op: 'select' }; return this; }
  insert(payload: Row | Row[]) { this.pending = { op: 'insert', payload }; return this; }
  delete() { this.pending = { op: 'delete' }; return this; }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  neq(col: string, val: unknown) { this.filters.push((r) => r[col] !== val); return this; }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  lt(col: string, val: unknown) { this.filters.push((r) => String(r[col]) < String(val)); return this; }
  order(_c: string, _o?: unknown) { return this; }
  limit(n: number) { this.limitN = n; return this; }

  private rows() {
    let rows = this.db.tables[this.table] ?? [];
    for (const f of this.filters) rows = rows.filter(f);
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  private run(): { data: unknown; error: unknown } {
    const t = this.table;
    if (this.pending.op === 'insert') {
      const payload = this.pending.payload!;
      const list = Array.isArray(payload) ? payload : [payload];

      // orders.stripe_session_id üzerindeki BENZERSİZLİK KISITI.
      if (t === 'orders') {
        for (const r of list) {
          const sid = r.stripe_session_id;
          if (sid && this.db.tables.orders.some((o) => o.stripe_session_id === sid)) {
            return { data: null, error: { code: '23505', message: 'duplicate key orders_stripe_session_id_key' } };
          }
          if (r.order_number && this.db.tables.orders.some((o) => o.order_number === r.order_number)) {
            return { data: null, error: { code: '23505', message: 'duplicate key orders_order_number_key' } };
          }
        }
      }
      // public.users birincil anahtarı ve e-posta benzersizliği.
      if (t === 'users') {
        for (const r of list) {
          if (this.db.tables.users.some((u) => u.id === r.id || u.email === r.email)) {
            return { data: null, error: { code: '23505', message: 'duplicate key users_pkey' } };
          }
        }
      }
      const stored = list.map((r) => ({
        ...r,
        id: r.id ?? this.db.newId(),
        public_token: r.public_token ?? this.db.newId(),
      }));
      this.db.tables[t] = [...(this.db.tables[t] ?? []), ...stored];
      this.db.writes.push({ table: t, op: 'insert', rows: stored.length });
      return { data: stored, error: null };
    }

    if (this.pending.op === 'delete') {
      const doomed = this.rows();
      this.db.tables[t] = (this.db.tables[t] ?? []).filter((r) => !doomed.includes(r));
      if (doomed.length) this.db.writes.push({ table: t, op: 'delete', rows: doomed.length });
      return { data: doomed, error: null };
    }

    return { data: this.rows(), error: null };
  }

  async single() {
    const { data, error } = this.run();
    if (error) return { data: null, error };
    const list = data as Row[];
    if (list.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } };
    return { data: list[0], error: null };
  }

  async maybeSingle() {
    const { data, error } = this.run();
    if (error) return { data: null, error };
    const list = data as Row[];
    return { data: list[0] ?? null, error: null };
  }

  then<R1 = { data: unknown; error: unknown }, R2 = never>(
    onfulfilled?: ((v: { data: unknown; error: unknown }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}
