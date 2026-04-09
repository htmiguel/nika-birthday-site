import { neon } from "@neondatabase/serverless";

let sql: ReturnType<typeof neon> | null = null;

/** Vercel Neon/Postgres often sets DATABASE_URL; some flows use POSTGRES_URL only. */
export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

export function getSql() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL or POSTGRES_URL is not set");
  }
  if (!sql) {
    sql = neon(url);
  }
  return sql;
}
