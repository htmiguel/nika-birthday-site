"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const SHARE_TITLE = "Nika's birthday guest book";

function buildShareMessage(url: string) {
  return `Leave a birthday wish for Nika — add a message, voice note, or photo on her guest book:\n${url}`;
}

type PublicStats = {
  uniquePeople: number;
  totalSubmissions: number;
  nextGoal: number;
  remaining: number;
  progressPct: number;
  prevTier: number;
};

export function GuestBook() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [openModal, setOpenModal] = useState<null | "message" | "voice" | "photo">(null);
  const [shareCopiedVisible, setShareCopiedVisible] = useState(false);
  const [shareCopiedKey, setShareCopiedKey] = useState(0);
  const [sharePageUrl, setSharePageUrl] = useState("");
  const [canSystemShare, setCanSystemShare] = useState(false);

  const dlgMessage = useRef<HTMLDialogElement>(null);
  const dlgVoice = useRef<HTMLDialogElement>(null);
  const dlgPhoto = useRef<HTMLDialogElement>(null);
  /** Skip syncing openModal when we close dialogs to switch to another */
  const progCloseRef = useRef(false);

  const [msgName, setMsgName] = useState("");
  const [msgText, setMsgText] = useState("");
  const [msgStep, setMsgStep] = useState<"form" | "done">("form");
  const [msgBusy, setMsgBusy] = useState(false);

  const [voiceName, setVoiceName] = useState("");
  const [voiceStep, setVoiceStep] = useState<"form" | "done">("form");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [recStatus, setRecStatus] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const playerRef = useRef<HTMLAudioElement>(null);

  const [photoName, setPhotoName] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [photoStep, setPhotoStep] = useState<"form" | "done">("form");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const photoFileRef = useRef<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (!res.ok || data.error) {
        setStats(null);
        setLoadError(data.error ?? "Could not load stats.");
      } else {
        setLoadError(null);
        setStats({
          uniquePeople: data.uniquePeople ?? 0,
          totalSubmissions: data.totalSubmissions ?? 0,
          nextGoal: data.nextGoal ?? 10,
          remaining: data.remaining ?? 10,
          progressPct: data.progressPct ?? 0,
          prevTier: data.prevTier ?? 0,
        });
      }
    } catch {
      setStats(null);
      setLoadError("Could not load stats.");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!shareCopiedVisible) return undefined;
    const id = window.setTimeout(() => setShareCopiedVisible(false), 2500);
    return () => window.clearTimeout(id);
  }, [shareCopiedVisible, shareCopiedKey]);

  useEffect(() => {
    setSharePageUrl(window.location.href);
    setCanSystemShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    const dm = dlgMessage.current;
    const dv = dlgVoice.current;
    const dp = dlgPhoto.current;
    progCloseRef.current = true;
    dm?.close();
    dv?.close();
    dp?.close();
    if (openModal === "message") dm?.showModal();
    else if (openModal === "voice") dv?.showModal();
    else if (openModal === "photo") dp?.showModal();
    requestAnimationFrame(() => {
      progCloseRef.current = false;
    });
  }, [openModal]);

  useLayoutEffect(() => {
    const pairs: [React.RefObject<HTMLDialogElement | null>, "message" | "voice" | "photo"][] = [
      [dlgMessage, "message"],
      [dlgVoice, "voice"],
      [dlgPhoto, "photo"],
    ];
    const cleanups: (() => void)[] = [];
    for (const [ref, kind] of pairs) {
      const el = ref.current;
      if (!el) continue;
      const onDialogClose = () => {
        if (progCloseRef.current) return;
        setOpenModal((cur) => (cur === kind ? null : cur));
      };
      el.addEventListener("close", onDialogClose);
      cleanups.push(() => el.removeEventListener("close", onDialogClose));
    }
    return () => cleanups.forEach((c) => c());
  }, []);

  function resetVoiceUi() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    recordedBlobRef.current = null;
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    if (playerRef.current) {
      playerRef.current.removeAttribute("src");
    }
    setRecStatus("");
  }

  useEffect(() => {
    if (openModal !== "voice") {
      resetVoiceUi();
    }
  }, [openModal]);

  function openMessage() {
    setMsgName("");
    setMsgText("");
    setMsgStep("form");
    setOpenModal("message");
  }

  function openVoice() {
    setVoiceName("");
    setVoiceStep("form");
    resetVoiceUi();
    setOpenModal("voice");
  }

  function openPhoto() {
    setPhotoName("");
    setPhotoMessage("");
    setPhotoStep("form");
    photoFileRef.current = null;
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
      setPhotoPreviewUrl(null);
    }
    if (photoInputRef.current) photoInputRef.current.value = "";
    setOpenModal("photo");
  }

  async function submitMessage() {
    const name = msgName.trim();
    const text = msgText.trim();
    if (!name) {
      alert("Please add your name.");
      return;
    }
    if (!text) {
      alert("Please write a message.");
      return;
    }
    setMsgBusy(true);
    try {
      const res = await fetch("/api/entries/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Could not save.");
        return;
      }
      setMsgStep("done");
      await loadStats();
    } finally {
      setMsgBusy(false);
    }
  }

  async function startRec() {
    chunksRef.current = [];
    recordedBlobRef.current = null;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (playerRef.current) playerRef.current.removeAttribute("src");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        recordedBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        if (playerRef.current) playerRef.current.src = url;
        setRecStatus(`Recorded (${Math.round(blob.size / 1024)} KB).`);
      };
      mr.start();
      setRecStatus("Recording…");
    } catch {
      setRecStatus("Mic not available — check permissions.");
    }
  }

  function stopRec() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    mediaRecorderRef.current = null;
  }

  function playRec() {
    playerRef.current?.play().catch(() => {});
  }

  async function submitVoice() {
    const name = voiceName.trim();
    if (!name) {
      alert("Please add your name.");
      return;
    }
    const blob = recordedBlobRef.current;
    if (!blob || blob.size < 1) {
      alert("Record a voice note first.");
      return;
    }
    setVoiceBusy(true);
    try {
      const fd = new FormData();
      fd.append("kind", "voice");
      fd.append("name", name);
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      fd.append("file", blob, `note.${ext}`);
      const res = await fetch("/api/entries/media", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Upload failed.");
        return;
      }
      setVoiceStep("done");
      await loadStats();
    } finally {
      setVoiceBusy(false);
    }
  }

  function onPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    photoFileRef.current = file;
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    const url = URL.createObjectURL(file);
    setPhotoPreviewUrl(url);
  }

  async function submitPhoto() {
    const name = photoName.trim();
    const file = photoFileRef.current;
    if (!name) {
      alert("Please add your name.");
      return;
    }
    if (!file) {
      alert("Choose a photo first.");
      return;
    }
    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append("kind", "photo");
      fd.append("name", name);
      fd.append("message", photoMessage.trim());
      fd.append("file", file);
      const res = await fetch("/api/entries/media", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Upload failed.");
        return;
      }
      setPhotoStep("done");
      await loadStats();
    } finally {
      setPhotoBusy(false);
    }
  }

  async function copyShare() {
    const url =
      sharePageUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (!url) return;
    const flashCopied = () => {
      setShareCopiedKey((k) => k + 1);
      setShareCopiedVisible(true);
    };
    try {
      await navigator.clipboard.writeText(url);
      flashCopied();
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        flashCopied();
      } catch {
        window.prompt("Copy this link:", url);
      }
    }
  }

  async function systemShare() {
    const url =
      sharePageUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (!url || typeof navigator.share !== "function") {
      void copyShare();
      return;
    }
    const text = buildShareMessage(url);
    try {
      await navigator.share({
        title: SHARE_TITLE,
        text,
        url,
      });
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name !== "AbortError") void copyShare();
    }
  }

  const shareMessage = sharePageUrl ? buildShareMessage(sharePageUrl) : "";
  const smsHref = sharePageUrl ? `sms:?body=${encodeURIComponent(shareMessage)}` : "";
  const mailHref = sharePageUrl
    ? `mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${encodeURIComponent(shareMessage)}`
    : "";
  const waHref = sharePageUrl
    ? `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`
    : "";
  const fbHref = sharePageUrl
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sharePageUrl)}`
    : "";

  return (
    <div className="proto-shell wide">
      {loadError && (
        <div className="bgb-banner bgb-banner--error" role="status">
          {loadError}
        </div>
      )}

      <section className="bgb-card" aria-label="Nika birthday guest book">
        <div className="bgb-card-top">
          <div
            className="bgb-card-visual"
            role="img"
            aria-label="Nika — childhood photo fading into a recent photo, on a loop"
          >
            <div className="bgb-hero-crossfade">
              <span className="bgb-hero-layer-wrap bgb-hero-layer-wrap--now">
                <Image
                  src="/nika-now.png"
                  alt=""
                  fill
                  sizes="(max-width: 480px) 72vw, 14rem"
                  className="bgb-hero-img"
                />
              </span>
              <span className="bgb-hero-layer-wrap bgb-hero-layer-wrap--young">
                <Image
                  src="/nika-young.png"
                  alt=""
                  fill
                  sizes="(max-width: 480px) 72vw, 14rem"
                  className="bgb-hero-img"
                  priority
                />
              </span>
            </div>
          </div>
          <p className="bgb-card-kicker">Birthday guest book</p>
          <p className="bgb-card-title">Nika&apos;s birthday</p>
          <p className="bgb-card-sub">
            Leave her a voice note, a written message, or a photo — it all lands in one guest book.
          </p>
        </div>
        <div className="bgb-actions">
          <button type="button" className="bgb-action-btn primary" onClick={openMessage}>
            Leave a message
          </button>
          <button type="button" className="bgb-action-btn primary" onClick={openVoice}>
            Leave a voice note
          </button>
          <button type="button" className="bgb-action-btn primary" onClick={openPhoto}>
            Add a photo
          </button>
        </div>
      </section>

      {!loadError && (
        <section className="bgb-goal-panel" aria-label="Progress toward goal">
          <div className="bgb-share">
            <p className="bgb-share-lede">Share with someone who knows Nika</p>
            <div className="bgb-share-action">
              {shareCopiedVisible && (
                <span
                  key={shareCopiedKey}
                  className="bgb-copied-toast"
                  role="status"
                  aria-live="polite"
                  onAnimationEnd={(e) => {
                    if (e.animationName === "bgbCopiedFade") {
                      setShareCopiedVisible(false);
                    }
                  }}
                >
                  Copied
                </span>
              )}
              <button type="button" className="bgb-action-btn primary bgb-share-cta" onClick={() => void copyShare()}>
                <span className="bgb-share-cta-inner">
                  <svg
                    className="bgb-share-cta-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    focusable={false}
                  >
                    <circle cx={18} cy={5} r={3} />
                    <circle cx={6} cy={12} r={3} />
                    <circle cx={18} cy={19} r={3} />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Copy link
                </span>
              </button>
            </div>
            {sharePageUrl ? (
              <div className="bgb-share-chips" role="group" aria-label="Share in an app">
                {canSystemShare ? (
                  <button
                    type="button"
                    className="bgb-action-btn bgb-share-chip"
                    onClick={() => void systemShare()}
                  >
                    Share…
                  </button>
                ) : null}
                <a className="bgb-action-btn bgb-share-chip" href={smsHref}>
                  Messages
                </a>
                <a
                  className="bgb-action-btn bgb-share-chip"
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
                <a className="bgb-action-btn bgb-share-chip" href={mailHref}>
                  Mail
                </a>
                <a
                  className="bgb-action-btn bgb-share-chip"
                  href={fbHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Facebook
                </a>
              </div>
            ) : null}
          </div>
          {loadingStats || !stats ? (
            <p className="proto-sub bgb-goal-panel-after-share" style={{ marginBottom: 0 }}>
              Loading…
            </p>
          ) : (
            <>
              <p className="bgb-goal-count bgb-goal-panel-after-share">
                <span className="num">{stats.uniquePeople}</span>{" "}
                {stats.uniquePeople === 1 ? "person has" : "people have"} shared something
              </p>
              <p className="bgb-goal-sub">
                {stats.totalSubmissions} total{" "}
                {stats.totalSubmissions === 1 ? "wish" : "wishes"} (messages, voice notes, photos)
              </p>
              <p className="bgb-goal-next">
                Next goal: <strong>{stats.nextGoal}</strong> people ·{" "}
                <strong>{stats.remaining}</strong> to go
              </p>
              <div className="bgb-goal-bar" role="progressbar" aria-valuenow={stats.progressPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="bgb-goal-bar-fill" style={{ width: `${stats.progressPct}%` }} />
              </div>
              <p className="bgb-goal-pct">{stats.progressPct}% toward this goal</p>
            </>
          )}
        </section>
      )}

      <dialog
        ref={dlgMessage}
        className="bgb-modal"
        aria-labelledby="dlgMessageTitle"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            dlgMessage.current?.close();
            setOpenModal(null);
          }
        }}
      >
        <div className="bgb-modal-inner">
          <div className="bgb-modal-head">
            <h2 id="dlgMessageTitle">Leave a message</h2>
            <button
              type="button"
              className="bgb-modal-close"
              aria-label="Close"
              onClick={() => {
                dlgMessage.current?.close();
                setOpenModal(null);
              }}
            >
              ×
            </button>
          </div>
          <div className={msgStep === "form" ? "" : "bgb-hidden"}>
            <div className="bgb-field">
              <label htmlFor="msgName">Your name</label>
              <input
                id="msgName"
                type="text"
                maxLength={60}
                autoComplete="name"
                placeholder="Required"
                value={msgName}
                onChange={(e) => setMsgName(e.target.value)}
              />
            </div>
            <div className="bgb-field">
              <label htmlFor="msgText">Your wish</label>
              <textarea
                id="msgText"
                maxLength={500}
                placeholder="Happy birthday…"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
              />
            </div>
            <div className="bgb-modal-actions">
              <button
                type="button"
                className="bgb-action-btn primary"
                disabled={msgBusy}
                onClick={() => void submitMessage()}
              >
                {msgBusy ? "Saving…" : "Post to guest book"}
              </button>
            </div>
          </div>
          <div className={msgStep === "done" ? "bgb-confirm" : "bgb-confirm bgb-hidden"}>
            <div className="bgb-confirm-icon" aria-hidden>
              ✓
            </div>
            <p>Thanks, {msgName.trim() || "friend"}! Your message is saved.</p>
            <div className="bgb-modal-actions">
              <button
                type="button"
                className="bgb-action-btn primary"
                onClick={() => {
                  dlgMessage.current?.close();
                  setOpenModal(null);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </dialog>

      <dialog
        ref={dlgVoice}
        className="bgb-modal"
        aria-labelledby="dlgVoiceTitle"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            dlgVoice.current?.close();
            setOpenModal(null);
          }
        }}
      >
        <div className="bgb-modal-inner">
          <div className="bgb-modal-head">
            <h2 id="dlgVoiceTitle">Leave a voice note</h2>
            <button
              type="button"
              className="bgb-modal-close"
              aria-label="Close"
              onClick={() => {
                dlgVoice.current?.close();
                setOpenModal(null);
              }}
            >
              ×
            </button>
          </div>
          <div className={voiceStep === "form" ? "" : "bgb-hidden"}>
            <p className="proto-sub" style={{ margin: "0 0 0.5rem", fontSize: "0.82rem" }}>
              Record up to a short clip; it uploads when you save.
            </p>
            <div className="bgb-field">
              <label htmlFor="voiceName">Your name</label>
              <input
                id="voiceName"
                type="text"
                maxLength={60}
                autoComplete="name"
                placeholder="Required"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
              />
            </div>
            <div className="bgb-rec-row">
              <button type="button" className="bgb-action-btn primary" onClick={() => void startRec()}>
                Record
              </button>
              <button type="button" className="bgb-action-btn" onClick={stopRec}>
                Stop
              </button>
              <button type="button" className="bgb-action-btn" onClick={playRec}>
                Play
              </button>
            </div>
            <audio ref={playerRef} controls />
            <p className="proto-sub" style={{ margin: 0, fontSize: "0.82rem" }} aria-live="polite">
              {recStatus}
            </p>
            <div className="bgb-modal-actions">
              <button
                type="button"
                className="bgb-action-btn primary"
                disabled={voiceBusy}
                onClick={() => void submitVoice()}
              >
                {voiceBusy ? "Uploading…" : "Save to guest book"}
              </button>
            </div>
          </div>
          <div className={voiceStep === "done" ? "bgb-confirm" : "bgb-confirm bgb-hidden"}>
            <div className="bgb-confirm-icon" aria-hidden>
              ✓
            </div>
            <p>Thanks, {voiceName.trim() || "friend"}! Your voice note is saved.</p>
            <div className="bgb-modal-actions">
              <button
                type="button"
                className="bgb-action-btn primary"
                onClick={() => {
                  dlgVoice.current?.close();
                  setOpenModal(null);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </dialog>

      <dialog
        ref={dlgPhoto}
        className="bgb-modal"
        aria-labelledby="dlgPhotoTitle"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            dlgPhoto.current?.close();
            setOpenModal(null);
          }
        }}
      >
        <div className="bgb-modal-inner">
          <div className="bgb-modal-head">
            <h2 id="dlgPhotoTitle">Add a photo</h2>
            <button
              type="button"
              className="bgb-modal-close"
              aria-label="Close"
              onClick={() => {
                dlgPhoto.current?.close();
                setOpenModal(null);
              }}
            >
              ×
            </button>
          </div>
          <div className={photoStep === "form" ? "" : "bgb-hidden"}>
            <div className="bgb-field">
              <label htmlFor="photoName">Your name</label>
              <input
                id="photoName"
                type="text"
                maxLength={60}
                autoComplete="name"
                placeholder="Required"
                value={photoName}
                onChange={(e) => setPhotoName(e.target.value)}
              />
            </div>
            <div className="bgb-field">
              <label htmlFor="photoMessage">Your message</label>
              <textarea
                id="photoMessage"
                maxLength={500}
                placeholder="Optional — a note to go with the photo"
                value={photoMessage}
                onChange={(e) => setPhotoMessage(e.target.value)}
              />
            </div>
            <input
              ref={photoInputRef}
              type="file"
              className="bgb-file-input"
              accept="image/*"
              tabIndex={-1}
              aria-hidden
              onChange={onPhotoPick}
            />
            <button type="button" className="bgb-action-btn" onClick={() => photoInputRef.current?.click()}>
              Choose a photo
            </button>
            {photoPreviewUrl && (
              <div className="bgb-photo-preview">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob: object URL from file picker */}
                <img src={photoPreviewUrl} alt="Preview" />
              </div>
            )}
            <div className="bgb-modal-actions">
              <button
                type="button"
                className="bgb-action-btn primary"
                disabled={photoBusy || !photoPreviewUrl}
                onClick={() => void submitPhoto()}
              >
                {photoBusy ? "Uploading…" : "Add to guest book"}
              </button>
            </div>
          </div>
          <div className={photoStep === "done" ? "bgb-confirm" : "bgb-confirm bgb-hidden"}>
            <div className="bgb-confirm-icon" aria-hidden>
              ✓
            </div>
            <p>Thanks, {photoName.trim() || "friend"}! Your photo is saved.</p>
            <div className="bgb-modal-actions">
              <button
                type="button"
                className="bgb-action-btn primary"
                onClick={() => {
                  dlgPhoto.current?.close();
                  setOpenModal(null);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
