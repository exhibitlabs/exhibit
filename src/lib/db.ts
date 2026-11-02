import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { dataDir, paypalMode } from "./config";

/** Requests from external AI agents (MCP) waiting for the merchant; see approvals.ts. */
export const APPROVALS_SCHEMA = `
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, target TEXT NOT NULL, action TEXT NOT NULL, title TEXT NOT NULL,
  detail TEXT NOT NULL, amount REAL, currency TEXT, moves_money INTEGER NOT NULL DEFAULT 0, client TEXT NOT NULL,
  note TEXT, status TEXT NOT NULL, run_id TEXT, created_at TEXT NOT NULL, decided_at TEXT, decided_by TEXT, result TEXT
);
CREATE INDEX IF NOT EXISTS approvals_by_target ON approvals (target, status);
`;

/** Sanitized request and response bodies of PayPal API calls, kept apart so the activity list stays light. */
export const API_CALLS_SCHEMA = `
CREATE TABLE IF NOT EXISTS api_calls (activity_id INTEGER PRIMARY KEY, request TEXT, response TEXT);
`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS docs (
  kind TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, dispute_id TEXT NOT NULL, provider TEXT NOT NULL, model TEXT,
  status TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT,
  events TEXT NOT NULL DEFAULT '[]', brief TEXT, error TEXT
);
CREATE INDEX IF NOT EXISTS runs_by_dispute ON runs (dispute_id, started_at);
CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY, dispute_id TEXT NOT NULL, kind TEXT NOT NULL, actor TEXT NOT NULL,
  request TEXT, response TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, kind TEXT NOT NULL,
  dispute_id TEXT, message TEXT NOT NULL, meta TEXT
);
CREATE INDEX IF NOT EXISTS activity_by_dispute ON activity (dispute_id, id);
${APPROVALS_SCHEMA}${API_CALLS_SCHEMA}`;

const globalForDb = globalThis as unknown as { __exhibitDb?: Map<string, DatabaseSync> };
// Tables added after a long-running dev server opened its connection are created on first use.
const migrated = new WeakSet<DatabaseSync>();

/** One SQLite file per PayPal mode so demo data never mixes with sandbox data. */
export function db(): DatabaseSync {
  const mode = paypalMode();
  globalForDb.__exhibitDb ??= new Map();
  const existing = globalForDb.__exhibitDb.get(mode);
  if (existing) {
    if (!migrated.has(existing)) {
      existing.exec(API_CALLS_SCHEMA);
      migrated.add(existing);
    }
    return existing;
  }
  fs.mkdirSync(dataDir(), { recursive: true });
  const conn = new DatabaseSync(path.join(dataDir(), `exhibit-${mode}.db`));
  conn.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;");
  conn.exec(SCHEMA);
  migrated.add(conn);
  globalForDb.__exhibitDb.set(mode, conn);
  return conn;
}

export const now = () => new Date().toISOString();

export function kvGet<T>(k: string, fallback: T): T {
  const row = db().prepare("SELECT v FROM kv WHERE k = ?").get(k) as { v: string } | undefined;
  return row ? (JSON.parse(row.v) as T) : fallback;
}

export function kvSet(k: string, v: unknown) {
  db().prepare("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(k, JSON.stringify(v));
}

export function docGet<T>(kind: string, id: string): T | undefined {
  const row = db().prepare("SELECT json FROM docs WHERE kind = ? AND id = ?").get(kind, id) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as T) : undefined;
}

export function docPut(kind: string, id: string, value: unknown) {
  db()
    .prepare(
      "INSERT INTO docs (kind, id, json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(kind, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at",
    )
    .run(kind, id, JSON.stringify(value), now());
}

export function docList<T>(kind: string): T[] {
  const rows = db().prepare("SELECT json FROM docs WHERE kind = ? ORDER BY id").all(kind) as { json: string }[];
  return rows.map((r) => JSON.parse(r.json) as T);
}

export function docDeleteKind(kind: string) {
  db().prepare("DELETE FROM docs WHERE kind = ?").run(kind);
}

/** Appends to the audit log and returns the new row's id. */
export function logActivity(kind: string, message: string, disputeId?: string | null, meta?: unknown): number {
  const r = db()
    .prepare("INSERT INTO activity (at, kind, dispute_id, message, meta) VALUES (?, ?, ?, ?, ?)")
    .run(now(), kind, disputeId ?? null, message, meta === undefined ? null : JSON.stringify(meta));
  return Number(r.lastInsertRowid);
}

/** One PayPal API call: the audit-log line plus its sanitized request and response bodies. */
export function logApiCall(message: string, meta: unknown, disputeId: string | null | undefined, bodies: { request: unknown; response: unknown }) {
  const id = logActivity("api", message, disputeId, meta);
  db()
    .prepare("INSERT OR REPLACE INTO api_calls (activity_id, request, response) VALUES (?, ?, ?)")
    .run(id, bodies.request === undefined ? null : JSON.stringify(bodies.request), bodies.response === undefined ? null : JSON.stringify(bodies.response));
  return id;
}

export type ApiCallDetail = ActivityRow & { request: unknown; response: unknown };

/** A logged PayPal API call with its bodies, for the request inspector. */
export function apiCallDetail(id: number): ApiCallDetail | undefined {
  const row = db().prepare("SELECT a.*, c.request AS req, c.response AS res FROM activity a LEFT JOIN api_calls c ON c.activity_id = a.id WHERE a.id = ? AND a.kind = 'api'").get(id) as
    | { id: number; at: string; kind: string; dispute_id: string | null; message: string; meta: string | null; req: string | null; res: string | null }
    | undefined;
  if (!row) return undefined;
  return { id: row.id, at: row.at, kind: row.kind, dispute_id: row.dispute_id, message: row.message, meta: row.meta ? JSON.parse(row.meta) : null, request: row.req ? JSON.parse(row.req) : null, response: row.res ? JSON.parse(row.res) : null };
}

export type ActivityRow = { id: number; at: string; kind: string; dispute_id: string | null; message: string; meta: unknown };

export function listActivity(opts: { disputeId?: string; kind?: string; kinds?: string[]; limit?: number } = {}): ActivityRow[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.kinds?.length) {
    where.push(`kind IN (${opts.kinds.map(() => "?").join(", ")})`);
    args.push(...opts.kinds);
  }
  if (opts.disputeId) {
    where.push("dispute_id = ?");
    args.push(opts.disputeId);
  }
  if (opts.kind) {
    where.push("kind = ?");
    args.push(opts.kind);
  }
  const sql = `SELECT * FROM activity ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`;
  args.push(opts.limit ?? 200);
  const rows = db().prepare(sql).all(...args) as { id: number; at: string; kind: string; dispute_id: string | null; message: string; meta: string | null }[];
  return rows.map((r) => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null }));
}

export function resetDatabase() {
  const conn = db();
  conn.exec("DELETE FROM kv; DELETE FROM docs; DELETE FROM runs; DELETE FROM actions; DELETE FROM activity;");
  conn.exec(`${APPROVALS_SCHEMA} DELETE FROM approvals;`);
  conn.exec(`${API_CALLS_SCHEMA} DELETE FROM api_calls;`);
}
