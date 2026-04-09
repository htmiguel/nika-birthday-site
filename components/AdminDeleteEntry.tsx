"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminDeleteEntry({
  entryId,
  adminSecret,
}: {
  entryId: string;
  adminSecret: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const confirmed = window.confirm(
      "Delete this guest book entry permanently?\n\nThis is irreversible. The row will be removed from the database. Files already stored in Blob are not removed automatically."
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/entries/${entryId}`, {
        method: "DELETE",
        headers: { "X-Jordan-Admin-Secret": adminSecret },
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error ?? "Could not delete this entry.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="admin-delete-btn"
      disabled={busy}
      onClick={() => void onDelete()}
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
