import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  BlobClientTokenExpiredError,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  put,
} from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

/** Keep under typical Vercel function request body limits (~4.5 MB on many plans). */
const MAX_BYTES = 4 * 1024 * 1024;

/** Vercel/dashboard paste sometimes includes wrapping quotes — those break auth. */
function normalizeEnvToken(raw: string): string {
  let t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function getBlobToken(): string | null {
  const a = process.env.BLOB_READ_WRITE_TOKEN;
  const b = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  const picked = (a ?? b ?? "").trim();
  if (!picked) return null;
  return normalizeEnvToken(picked);
}

function uploadErrorMessage(e: unknown): string {
  if (e instanceof BlobStoreNotFoundError) {
    return "Blob store not linked to this project. In Vercel: Storage → connect Blob to this deployment.";
  }
  if (e instanceof BlobStoreSuspendedError) {
    return "Blob store is suspended. Check Vercel Storage.";
  }
  if (e instanceof BlobClientTokenExpiredError) {
    return "Blob token expired. Regenerate BLOB_READ_WRITE_TOKEN in Vercel.";
  }
  if (e instanceof Error) {
    const m = e.message.replace(/^Vercel Blob:\s*/i, "").trim();
    if (/no token found/i.test(m)) {
      return "Blob token missing. Set BLOB_READ_WRITE_TOKEN for this Vercel project (Production + Preview).";
    }
    if (/401|unauthorized|invalid token|forbidden/i.test(m)) {
      return "Blob token invalid. Regenerate BLOB_READ_WRITE_TOKEN in Vercel project settings.";
    }
    return m.slice(0, 280) || "Upload failed.";
  }
  return "Upload failed.";
}

function extFor(kind: string, file: File): string {
  const fromName = file.name.match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  if (kind === "voice") return file.type.includes("mp4") ? ".m4a" : ".webm";
  return ".jpg";
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    console.error("entries/media formData", e);
    const msg = e instanceof Error ? e.message : "";
    const hint =
      /exceeded|too large|413|limit|parse/i.test(msg)
        ? "Upload may be too large for the server to accept, or the connection was cut off. Try a smaller photo or shorter recording."
        : "Could not read the upload. Try again or use a smaller file.";
    return NextResponse.json({ error: hint, code: "FORM_PARSE" }, { status: 400 });
  }

  const kind = formData.get("kind");
  const name = String(formData.get("name") ?? "").trim();
  const file = formData.get("file");

  if (kind !== "voice" && kind !== "photo") {
    return NextResponse.json({ error: "kind must be voice or photo" }, { status: 400 });
  }
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Name is required (max 60 characters)." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 4 MB)." }, { status: 400 });
  }

  if (kind === "voice") {
    if (file.type && !file.type.startsWith("audio/")) {
      return NextResponse.json({ error: "Voice uploads must be audio." }, { status: 400 });
    }
  } else if (file.type && !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Photo uploads must be images." }, { status: 400 });
  }

  const ext = extFor(kind, file);
  const pathname = `guestbook/${kind}/${randomUUID()}${ext}`;

  const contentType =
    file.type ||
    (kind === "voice" ? "audio/webm" : "image/jpeg");

  const buf = Buffer.from(await file.arrayBuffer());
  let publicUrl: string;

  const blobToken = getBlobToken();
  const useDevDisk =
    !blobToken &&
    process.env.NODE_ENV === "development" &&
    process.env.DISABLE_DEV_LOCAL_MEDIA !== "1";

  if (useDevDisk) {
    const rel = path.join("public", "dev-media", pathname);
    const abs = path.join(process.cwd(), rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buf);
    publicUrl = `/dev-media/${pathname}`;
  } else {
    if (!blobToken) {
      return NextResponse.json(
        {
          error:
            "Blob storage not configured. Add Vercel Blob and BLOB_READ_WRITE_TOKEN (Production + Preview), then redeploy. For local dev without Blob, run `next dev` (NODE_ENV=development) or set DISABLE_DEV_LOCAL_MEDIA=1 to force this error.",
          code: "BLOB_TOKEN_MISSING",
        },
        { status: 503 }
      );
    }
    try {
      const uploaded = await put(pathname, buf, {
        access: "public",
        token: blobToken,
        contentType,
      });
      publicUrl = uploaded.url;
    } catch (e) {
      console.error(e);
      return NextResponse.json(
        { error: uploadErrorMessage(e), code: "BLOB_PUT" },
        { status: 500 }
      );
    }
  }

  try {
    const sql = getSql();
    await sql`
      INSERT INTO guestbook_entry (entry_type, guest_name, message_text, media_url)
      VALUES (${kind}, ${name}, NULL, ${publicUrl})
    `;
    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "";
    const missingTable = /does not exist|relation\s+"guestbook_entry"/i.test(msg);
    return NextResponse.json(
      {
        error: missingTable
          ? "Database table missing. Run npm run db:apply-schema (or schema.sql) against your DATABASE_URL."
          : "File was saved but the database insert failed. Check DATABASE_URL / POSTGRES_URL and server logs.",
        code: "DB_INSERT",
      },
      { status: 500 }
    );
  }
}
