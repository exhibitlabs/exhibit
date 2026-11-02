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
${APPROVALS_SCHEMA}`;

const globalForDb = globalThis as unknown as { __exhibitDb?: Map<string, DatabaseSync> };

/** One SQLite file per PayPal mode so demo data never mixes with sandbox data. */
export function db(): DatabaseSync {
  const mode = paypalMode();
  globalForDb.__exhibitDb ??= new Map();
  const existing = globalForDb.__exhibitDb.get(mode);
  if (existing) return existing;
  fs.mkdirSync(dataDir(), { recursive: true });
  const conn = new DatabaseSync(path.join(dataDir(), `exhibit-${mode}.db`));
  conn.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;");
  conn.exec(SCHEMA);
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

export function logActivity(kind: string, message: string, disputeId?: string | null, meta?: unknown) {
  db()
    .prepare("INSERT INTO activity (at, kind, dispute_id, message, meta) VALUES (?, ?, ?, ?, ?)")
    .run(now(), kind, disputeId ?? null, message, meta === undefined ? null : JSON.stringify(meta));
}

export type ActivityRow = { id: number; at: string; kind: string; dispute_id: string | null; message: string; meta: unknown };

export function listActivity(opts: { disputeId?: string; kind?: string; limit?: number } = {}): ActivityRow[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
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
}
