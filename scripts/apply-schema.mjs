/**
 * Apply schema to the database pointed to by DATABASE_URL.
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/apply-schema.mjs
 * Or from repo root:
 *   npm run db:apply-schema
 *
 * Keep in sync with schema.sql.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error(
    "Missing DATABASE_URL or POSTGRES_URL.\n" +
      "  • Local: docker compose up -d, then copy DATABASE_URL from .env.example\n" +
      "  • Vercel: vercel env pull .env.local in this folder, then npm run db:apply-schema\n" +
      "  • Or: DATABASE_URL='postgresql://…' npm run db:apply-schema"
  );
  process.exit(1);
}

function postgresOptions(connectionString) {
  let hostname = "";
  try {
    hostname = new URL(
      connectionString.replace(/^postgres(ql)?:/i, "http:")
    ).hostname;
  } catch {
    return { ssl: "require", max: 1 };
  }
  const local =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";
  return { ssl: local ? false : "require", max: 1 };
}

const sql = postgres(url, postgresOptions(url));

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS guestbook_entry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_type TEXT NOT NULL CHECK (entry_type IN ('message', 'voice', 'photo')),
      guest_name TEXT NOT NULL,
      message_text TEXT,
      media_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_guestbook_entry_created_at ON guestbook_entry (created_at DESC)
  `;
  console.log("OK — guestbook_entry table and index are ready.");
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
