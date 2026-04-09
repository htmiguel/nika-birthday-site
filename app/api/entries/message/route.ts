import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = body as { name?: string; text?: string };
  const name = String(o.name ?? "").trim();
  const text = String(o.text ?? "").trim();
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Name is required (max 60 characters)." }, { status: 400 });
  }
  if (!text || text.length > 500) {
    return NextResponse.json({ error: "Message is required (max 500 characters)." }, { status: 400 });
  }
  try {
    const sql = getSql();
    await sql`
      INSERT INTO guestbook_entry (entry_type, guest_name, message_text, media_url)
      VALUES ('message', ${name}, ${text}, NULL)
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save message." }, { status: 500 });
  }
}
