import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

/**
 * Vercel + Neon integration may set any of these (see Storage → your DB → .env in dashboard).
 * Prefer pooled URLs for serverless.
 */
export function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    undefined
  );
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
  const opts: NonNullable<Parameters<typeof postgres>[1]> = {
    ssl: local ? false : "require",
  };
  if (process.env.VERCEL) {
    opts.max = 1;
  }
  return opts;
}

export function getSql() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "No Postgres connection string: set DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL (e.g. link Neon in Vercel → Storage → connect to this project for Production, then redeploy)."
    );
  }
  if (!sql) {
    sql = postgres(url, postgresOptions(url));
  }
  return sql;
}
