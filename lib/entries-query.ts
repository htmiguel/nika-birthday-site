import { getSql } from "@/lib/db";
import { progressTowardNextGoal } from "@/lib/goals";

export type DbEntryRow = {
  id: string;
  entry_type: string;
  guest_name: string;
  message_text: string | null;
  media_url: string | null;
  created_at: Date | string;
};

export type GuestbookEntry = {
  id: string;
  type: "message" | "voice" | "photo";
  name: string;
  text: string | null;
  mediaUrl: string | null;
  createdAt: string;
};

function mapRow(r: DbEntryRow): GuestbookEntry {
  return {
    id: r.id,
    type: r.entry_type as GuestbookEntry["type"],
    name: r.guest_name,
    text: r.message_text,
    mediaUrl: r.media_url,
    createdAt:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

export async function listAllEntries(limit = 500): Promise<GuestbookEntry[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, entry_type, guest_name, message_text, media_url, created_at
    FROM guestbook_entry
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as DbEntryRow[];
  return rows.map(mapRow);
}

export type PublicStats = {
  uniquePeople: number;
  totalSubmissions: number;
  nextGoal: number;
  remaining: number;
  progressPct: number;
  prevTier: number;
};

export async function getPublicStats(): Promise<PublicStats | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      COUNT(*)::int AS total_submissions,
      COUNT(DISTINCT LOWER(TRIM(guest_name)))::int AS unique_people
    FROM guestbook_entry
  `) as { total_submissions: number; unique_people: number }[];
  const row = rows[0];
  if (!row) return null;
  const uniquePeople = row.unique_people;
  const { nextGoal, prevTier, progressPct, remaining } =
    progressTowardNextGoal(uniquePeople);
  return {
    uniquePeople,
    totalSubmissions: row.total_submissions,
    nextGoal,
    remaining,
    progressPct,
    prevTier,
  };
}
