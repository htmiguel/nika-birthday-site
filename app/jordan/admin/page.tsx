import Link from "next/link";
import { listAllEntries } from "@/lib/entries-query";
import type { GuestbookEntry } from "@/lib/entries-query";

export const dynamic = "force-dynamic";

function kindLabel(type: GuestbookEntry["type"]) {
  if (type === "message") return "Message";
  if (type === "voice") return "Voice";
  return "Photo";
}

function formatTs(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default async function JordanAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>;
}) {
  const { secret } = await searchParams;
  const expected = process.env.JORDAN_ADMIN_SECRET?.trim();

  if (!expected || expected.length < 8) {
    return (
      <div className="admin-page">
        <h1>Jordan admin</h1>
        <p className="admin-muted">
          Set <code className="admin-code">JORDAN_ADMIN_SECRET</code> in Vercel (at least 8
          characters), redeploy, then visit{" "}
          <code className="admin-code">/jordan/admin?secret=…</code>
        </p>
        <p>
          <Link href="/">← Guest book</Link>
        </p>
      </div>
    );
  }

  if (secret !== expected) {
    return (
      <div className="admin-page">
        <h1>Jordan admin</h1>
        <p className="admin-muted">
          Open this page with your secret in the query string, e.g.{" "}
          <code className="admin-code">/jordan/admin?secret=YOUR_SECRET</code>
        </p>
        <p className="admin-muted">Bookmark that URL; don’t share it publicly.</p>
        <p>
          <Link href="/">← Guest book</Link>
        </p>
      </div>
    );
  }

  let entries: GuestbookEntry[];
  try {
    entries = await listAllEntries(500);
  } catch {
    return (
      <div className="admin-page">
        <h1>Jordan admin</h1>
        <p className="admin-error">Could not load entries from the database.</p>
        <p>
          <Link href="/">← Guest book</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Jordan admin</h1>
        <p className="admin-muted">
          {entries.length} submission{entries.length === 1 ? "" : "s"} (newest first)
        </p>
        <p>
          <Link href="/">← Guest book</Link>
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="admin-muted">No entries yet.</p>
      ) : (
        <ul className="admin-list">
          {entries.map((e) => (
            <li key={e.id} className="admin-card">
              <div className="admin-card-meta">
                <time dateTime={e.createdAt}>{formatTs(e.createdAt)}</time>
                <span className="admin-badge">{kindLabel(e.type)}</span>
              </div>
              <p className="admin-name">{e.name}</p>
              {e.type === "message" && e.text && (
                <p className="admin-body">{e.text}</p>
              )}
              {e.type === "voice" && e.mediaUrl && (
                <audio className="admin-audio" src={e.mediaUrl} controls preload="none" />
              )}
              {e.type === "photo" && e.mediaUrl && (
                <div className="admin-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary guest-upload URLs */}
                  <img src={e.mediaUrl} alt="" width={320} height={320} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
