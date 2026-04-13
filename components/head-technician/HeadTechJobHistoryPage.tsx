"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, CheckCircle2, Circle, ImagePlus, Video,
  ThumbsUp, AlertTriangle, Loader2, Info, RefreshCw, Play, X,
} from "lucide-react";
import { BottomNav } from "./components/BottomNav";

// ── Types ────────────────────────────────────────────────────────────────────

interface StageMedia { id: string; url: string; type: string; pending?: boolean }

interface StageDoc {
  id:                  string;   // UUID — the job_stage_progress row ID
  name:                string;
  order:               number;
  category:            "preparation" | "installation";
  status:              "pending" | "in_progress" | "done" | "for_rework";
  rework_instructions: string | null;
  handoff_notes:       string | null;
  completed_at:        string | null;
  media:               StageMedia[];
}

interface TimelineEntry {
  status:     string;
  changed_at: string;
  changed_by: string | null;
}

interface JobDetail {
  job_id:          string;
  raw_id:          string;
  customer_name:   string;
  plate_number:    string;
  car_make:        string;
  service:         string;
  technician_name: string;
  scheduled_start: string;
  status:          string;
  handoff_notes:   string | null;
  timeline:        TimelineEntry[];
  stages:          StageDoc[];
}

const STATUS_BADGE: Record<string, string> = {
  Pending:       "bg-yellow-50 text-yellow-600",
  Ongoing:       "bg-blue-50 text-blue-600",
  "For Rework":  "bg-orange-50 text-orange-600",
  "For Release": "bg-emerald-50 text-emerald-600",
  Released:      "bg-teal-50 text-teal-600",
  Delayed:       "bg-red-50 text-red-600",
  Cancelled:     "bg-gray-100 text-gray-500",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function HeadTechJobHistoryPage({ jobId }: { jobId: string }) {
  const router = useRouter();

  const [job, setJob]         = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError,  setUploadError]  = useState<Record<string, string>>({});
  const [removingId,   setRemovingId]   = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);

  // Per-stage marking progress
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Start job flow
  const [startingJob, setStartingJob] = useState(false);

  // Approve flow
  const [showApprove, setShowApprove]   = useState(false);
  const [handoffNotes, setHandoffNotes] = useState("");
  const [approving, setApproving]       = useState(false);
  const [approved, setApproved]         = useState(false);


  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const stored = localStorage.getItem("826_user");
      if (stored) setUserRole(JSON.parse(stored).role ?? "");
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/head-technician/jobs/${jobId}`);
      const json = await res.json();
      if (res.ok && json.job) setJob(json.job);
    } catch {}
    finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const isInstaller      = userRole === "head_installer";
  const relevantCategory = isInstaller ? "installation" : "preparation";

  const myStages   = (job?.stages ?? []).filter((s) => s.category === relevantCategory);
  const prepStages = (job?.stages ?? []).filter((s) => s.category === "preparation");

  const doneCount = myStages.filter((s) => s.status === "done").length;
  const allDone   = myStages.length > 0 && myStages.every((s) => s.status === "done");

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleStartJob() {
    setStartingJob(true);
    try {
      const res = await fetch(`/api/head-technician/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_job" }),
      });
      if (res.ok) {
        setJob((prev) => prev ? { ...prev, status: "Ongoing" } : prev);
      }
    } catch {}
    setStartingJob(false);
  }

  async function markDone(stage: StageDoc) {
    if (stage.status === "done" || markingId !== null) return;
    setMarkingId(stage.id);
    try {
      const res = await fetch(`/api/head-technician/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_stage_done", stage_id: stage.id }),
      });
      if (res.ok) {
        setJob((prev) => {
          if (!prev) return prev;
          const now = new Date().toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "2-digit",
          });
          return {
            ...prev,
            stages: prev.stages.map((s) =>
              s.id === stage.id ? { ...s, status: "done", completed_at: now } : s
            ),
          };
        });
      }
    } catch {}
    setMarkingId(null);
  }

  async function handleFileChange(stage: StageDoc, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingId(stage.id);
    setUploadError((prev) => { const n = { ...prev }; delete n[stage.id]; return n; });

    for (const file of Array.from(files)) {
      const tmpId    = `tmp-${Date.now()}`;
      const localUrl = URL.createObjectURL(file);
      const isPhoto  = file.type.startsWith("image/");

      // Show preview immediately
      setJob((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stages: prev.stages.map((s) =>
            s.id === stage.id
              ? { ...s, media: [...s.media, { id: tmpId, url: localUrl, type: isPhoto ? "photo" : "video", pending: true }] }
              : s
          ),
        };
      });

      try {
        const form = new FormData();
        form.append("file", file);
        const res  = await fetch(
          `/api/head-technician/jobs/${jobId}/stages/${stage.id}/media`,
          { method: "POST", body: form }
        );
        const json = await res.json();

        if (res.ok && json.media) {
          // Replace tmp entry with real data
          URL.revokeObjectURL(localUrl);
          setJob((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              stages: prev.stages.map((s) =>
                s.id === stage.id
                  ? { ...s, media: s.media.map((m) => m.id === tmpId
                      ? { id: json.media.id, url: json.media.file_url, type: json.media.media_type }
                      : m
                    )}
                  : s
              ),
            };
          });
        } else {
          // Upload failed — remove the tmp preview and show error
          URL.revokeObjectURL(localUrl);
          setJob((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              stages: prev.stages.map((s) =>
                s.id === stage.id
                  ? { ...s, media: s.media.filter((m) => m.id !== tmpId) }
                  : s
              ),
            };
          });
          setUploadError((prev) => ({ ...prev, [stage.id]: json?.error ?? "Upload failed." }));
        }
      } catch (err: unknown) {
        URL.revokeObjectURL(localUrl);
        setJob((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            stages: prev.stages.map((s) =>
              s.id === stage.id
                ? { ...s, media: s.media.filter((m) => m.id !== tmpId) }
                : s
            ),
          };
        });
        setUploadError((prev) => ({ ...prev, [stage.id]: err instanceof Error ? err.message : "Upload failed." }));
      }
    }

    setUploadingId(null);
  }

  async function removeMedia(stage: StageDoc, mediaId: string) {
    setRemovingId(mediaId);
    try {
      await fetch(`/api/head-technician/jobs/${jobId}/stages/${stage.id}/media`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_id: mediaId }),
      });
      setJob((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stages: prev.stages.map((s) =>
            s.id === stage.id
              ? { ...s, media: s.media.filter((m) => m.id !== mediaId) }
              : s
          ),
        };
      });
    } catch {}
    setRemovingId(null);
  }

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await fetch(`/api/head-technician/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", handoff_notes: handoffNotes }),
      });
      if (res.ok) {
        setApproved(true);
        setShowApprove(false);
      }
    } catch {}
    setApproving(false);
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) return (
    <main className="flex items-center justify-center min-h-screen">
      <Loader2 size={20} className="text-gray-400 animate-spin" />
    </main>
  );

  if (!job) return (
    <main className="px-4 py-6 max-w-md mx-auto text-center">
      <p className="text-sm text-gray-400 mt-20">Job not found.</p>
    </main>
  );

  const approveLabel = isInstaller ? "Approve & Mark for Release" : "Approve Preparation";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <main className="max-w-md mx-auto px-4 pb-32 pt-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm font-medium text-gray-700"
          >
            <ChevronLeft size={18} />
            Jobs
          </button>
          <span className="text-xs text-gray-400 font-mono">{job.job_id}</span>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-500"}`}>
            {job.status}
          </span>
          {approved && (
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-50 text-emerald-600">
              {isInstaller ? "Marked for Release" : "Preparation Approved"}
            </span>
          )}
          {job.status === "For Rework" && !approved && (
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-orange-50 text-orange-600 flex items-center gap-1">
              <AlertTriangle size={11} />
              Rework Required
            </span>
          )}
        </div>

        {/* Job info */}
        <div className="bg-white rounded-2xl p-4 space-y-2.5 text-sm">
          <Row label="Customer"  value={job.customer_name} />
          <Row label="Vehicle"   value={`${job.plate_number}${job.car_make ? ` — ${job.car_make}` : ""}`} />
          <Row label="Service"   value={job.service} accent="orange" />
          <Row label="Scheduled" value={job.scheduled_start} />
        </div>

        {/* Start Job — shown only when Pending */}
        {job.status === "Pending" && (
          <button
            onClick={handleStartJob}
            disabled={startingJob}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gray-900 rounded-2xl py-3 hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {startingJob
              ? <Loader2 size={15} className="animate-spin" />
              : <Play size={15} />
            }
            {startingJob ? "Starting…" : "Start Job"}
          </button>
        )}

        {/* Handoff notes (head_installer only) */}
        {isInstaller && job.handoff_notes && (
          <div className="bg-blue-50 rounded-2xl p-4 flex gap-3">
            <Info size={15} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-1">Handoff Notes from Head Detailer</p>
              <p className="text-sm text-blue-700 leading-snug">{job.handoff_notes}</p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {myStages.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span>{doneCount} / {myStages.length} stages</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-900 rounded-full transition-all duration-500"
                style={{ width: `${myStages.length > 0 ? Math.round((doneCount / myStages.length) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Preparation stages (read-only for head_installer) ── */}
        {isInstaller && prepStages.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Preparation Stages</h2>
            <div className="space-y-2">
              {prepStages.map((stage) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  readOnly
                  isMarking={false}
                  isUploading={false}
                  removingId={null}
                  uploadError={null}
                  onMarkDone={() => {}}
                  onFileChange={() => {}}
                  onRemoveMedia={() => {}}
                  onPreview={(url, type) => setPreview({ url, type })}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── My stages (interactive) ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            {relevantCategory === "preparation" ? "Preparation Stages" : "Installation Stages"}
          </h2>

          {myStages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No stages assigned for your role.</p>
          ) : (
            <div className="space-y-2">
              {myStages.map((stage) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  readOnly={approved}
                  isMarking={markingId === stage.id}
                  isUploading={uploadingId === stage.id}
                  removingId={removingId}
                  uploadError={uploadError[stage.id] ?? null}
                  onMarkDone={() => markDone(stage)}
                  onFileChange={(files) => handleFileChange(stage, files)}
                  onRemoveMedia={(mediaId) => removeMedia(stage, mediaId)}
                  onPreview={(url, type) => setPreview({ url, type })}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Approve action ── */}
        {!approved && myStages.length > 0 && allDone && (
          <div className="space-y-2 pt-1">
            {showApprove ? (
              <div className="bg-white rounded-2xl p-4 space-y-3 border border-emerald-100">
                <p className="text-sm font-semibold text-gray-900">
                  {isInstaller ? "Final Quality Check — Approve" : "Approve Preparation"}
                </p>
                {!isInstaller && (
                  <textarea
                    value={handoffNotes}
                    onChange={(e) => setHandoffNotes(e.target.value)}
                    placeholder="Optional handoff notes for the Installation team…"
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowApprove(false)}
                    className="flex-1 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl py-2.5 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {approving ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                    Confirm
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowApprove(true)}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-600 rounded-2xl py-3 hover:bg-emerald-700 transition-colors"
              >
                <ThumbsUp size={15} />
                {approveLabel}
              </button>
            )}
          </div>
        )}

        {/* Approved success banner */}
        {approved && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
            <ThumbsUp size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                {isInstaller ? "Job approved — marked For Release." : "Preparation approved — handed off to Installation."}
              </p>
              {handoffNotes && (
                <p className="text-xs text-emerald-700 mt-1">Notes: {handoffNotes}</p>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Full-screen preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setPreview(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
            onClick={() => setPreview(null)}
          >
            <X size={20} />
          </button>
          {preview.type === "video" ? (
            <video
              src={preview.url}
              controls
              autoPlay
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={preview.url}
              alt=""
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      <BottomNav active="jobs" />
    </>
  );
}

// ── StageCard ─────────────────────────────────────────────────────────────────

function StageCard({
  stage, readOnly, isMarking, isUploading, removingId, uploadError,
  onMarkDone, onFileChange, onRemoveMedia, onPreview,
}: {
  stage:         StageDoc;
  readOnly:      boolean;
  isMarking:     boolean;
  isUploading:   boolean;
  removingId:    string | null;
  uploadError:   string | null;
  onMarkDone:    () => void;
  onFileChange:  (files: FileList | null) => void;
  onRemoveMedia: (mediaId: string) => void;
  onPreview:     (url: string, type: string) => void;
}) {
  const done       = stage.status === "done";
  const rework     = stage.status === "for_rework";
  const photoCount = stage.media.filter((m) => m.type !== "video").length;
  const videoCount = stage.media.filter((m) => m.type === "video").length;
  const photoFull  = photoCount >= 5;
  const videoFull  = videoCount >= 1;

  return (
    <div className={`bg-white rounded-2xl p-4 space-y-3 border transition-colors ${
      done   ? "border-emerald-100" :
      rework ? "border-orange-200 bg-orange-50/30" :
               "border-gray-100"
    }`}>
      {/* Stage header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {done   ? <CheckCircle2 size={18} className="text-emerald-500" /> :
           rework ? <RefreshCw    size={18} className="text-orange-500" /> :
                    <Circle       size={18} className="text-gray-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${done ? "text-gray-500" : rework ? "text-orange-800" : "text-gray-900"}`}>
            {stage.order}. {stage.name}
          </p>
          {stage.completed_at && (
            <p className="text-xs text-gray-400 mt-0.5">Done: {stage.completed_at}</p>
          )}
          {readOnly && !done && (
            <p className="text-xs text-gray-400 capitalize mt-0.5">{stage.status.replace("_", " ")}</p>
          )}
        </div>
      </div>

      {/* Rework instructions banner */}
      {rework && stage.rework_instructions && (
        <div className="flex gap-2 bg-orange-100 rounded-xl px-3 py-2.5 ml-7">
          <AlertTriangle size={13} className="text-orange-500 mt-0.5 shrink-0" />
          <p className="text-xs text-orange-700 leading-snug">
            <span className="font-semibold">Rework: </span>{stage.rework_instructions}
          </p>
        </div>
      )}

      {/* Media thumbnails */}
      {stage.media.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-7">
          {stage.media.map((m) => (
            <div key={m.id} className="relative w-14 h-14">
              <button
                className="w-14 h-14 rounded-xl overflow-hidden block focus:outline-none"
                onClick={() => !m.pending && onPreview(m.url, m.type)}
              >
                {m.type === "video" ? (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-base text-gray-500">▶</div>
                ) : (
                  <img
                    src={m.url}
                    alt=""
                    className="w-full h-full object-cover bg-gray-100"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </button>

              {/* Upload spinner overlay */}
              {m.pending && (
                <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center pointer-events-none">
                  <Loader2 size={16} className="text-white animate-spin" />
                </div>
              )}

              {/* Remove button — only shown when not pending and not readOnly */}
              {!m.pending && !readOnly && !done && (
                <button
                  onClick={() => onRemoveMedia(m.id)}
                  disabled={removingId === m.id}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center shadow"
                >
                  {removingId === m.id
                    ? <Loader2 size={9} className="text-white animate-spin" />
                    : <X size={9} className="text-white" />
                  }
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <p className="text-[11px] text-red-500 pl-7">{uploadError}</p>
      )}

      {/* Actions — hidden for read-only */}
      {!readOnly && (
        <div className="flex flex-col gap-2 pl-7">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Photo button — disabled at 5 */}
            <label className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-2.5 py-1.5 transition-colors ${
              isUploading || photoFull
                ? "opacity-40 pointer-events-none text-gray-400 border-gray-200"
                : "text-gray-500 border-gray-200 hover:bg-gray-50 cursor-pointer"
            }`}>
              <ImagePlus size={12} />
              Photo {photoCount > 0 && `(${photoCount}/5)`}
              <input
                ref={(el) => { if (el) el.setAttribute("capture", "environment") }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFileChange(e.target.files)}
              />
            </label>

            {/* Video button — disabled at 1 */}
            <label className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-2.5 py-1.5 transition-colors ${
              isUploading || videoFull
                ? "opacity-40 pointer-events-none text-gray-400 border-gray-200"
                : "text-gray-500 border-gray-200 hover:bg-gray-50 cursor-pointer"
            }`}>
              <Video size={12} />
              Video {videoFull ? "(1/1)" : ""}
              <input
                ref={(el) => { if (el) el.setAttribute("capture", "environment") }}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => onFileChange(e.target.files)}
              />
            </label>

            {!done && (
              <button
                onClick={onMarkDone}
                disabled={isMarking || stage.media.length === 0}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-gray-900 rounded-lg px-3 py-1.5 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isMarking ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Mark Done
              </button>
            )}
          </div>

          {!done && stage.media.length === 0 && (
            <p className="text-[11px] text-gray-400">Take a photo or video before marking done.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Row helper ────────────────────────────────────────────────────────────────

function Row({ label, value, accent }: { label: string; value: string; accent?: "orange" }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className={`font-medium text-right ${accent === "orange" ? "text-orange-500" : "text-gray-800"}`}>
        {value}
      </span>
    </div>
  );
}
