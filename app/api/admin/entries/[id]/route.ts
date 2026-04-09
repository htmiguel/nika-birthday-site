import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const expected = process.env.JORDAN_ADMIN_SECRET?.trim();
  if (!expected || expected.length < 8) {
    return NextResponse.json({ error: "Admin not configured." }, { status: 503 });
  }

  const secret = req.headers.get("x-jordan-admin-secret")?.trim();
  if (!secret || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid entry id." }, { status: 400 });
  }

  try {
    const sql = getSql();
    const rows = await sql`
      DELETE FROM guestbook_entry
      WHERE id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin delete entry", e);
    return NextResponse.json({ error: "Could not delete entry." }, { status: 500 });
  }
}
