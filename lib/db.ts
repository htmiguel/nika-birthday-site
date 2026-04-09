import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

/** Vercel Neon/Postgres often sets DATABASE_URL; some flows use POSTGRES_URL only. */
export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

function postgresOptions(connectionString: string): NonNullable<
  Parameters<typeof postgres>[1]
> {
  let hostname = "";
  try {
    hostname = new URL(
      connectionString.replace(/^postgres(ql)?:/i, "http:")
    ).hostname;
  } catch {
    return { ssl: "require" };
  }
  const local =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";
  return { ssl: local ? false : "require" };
}

export function getSql() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL or POSTGRES_URL is not set");
  }
  if (!sql) {
    sql = postgres(url, postgresOptions(url));
  }
  return sql;
}
