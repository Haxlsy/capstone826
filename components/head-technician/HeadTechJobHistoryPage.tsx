"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, CheckCircle2, Circle, ImagePlus,
  ThumbsUp, AlertTriangle, X, Loader2, Info,
} from "lucide-react";
import { BottomNav } from "./components/BottomNav";

// ── Types ────────────────────────────────────────────────────────────────────

interface StageMedia { url: string; type: string; preview?: string }

interface StageDoc {
  stage_template_id: number;
  name: string;
  order: number;
  category: "preparation" | "installation";
  done: boolean;
  submitted_at: string | null;
  media: StageMedia[];
}

interface TimelineEntry {
  status: string;
  changed_at: string;
  changed_by: string | null;
}

interface JobDetail {
  job_id: string;
  raw_id: string;
  customer_name: string;
  plate_number: string;
  car_make: string;
  car_color: string;
  service: string;
  technician_name: string;
  scheduled_start: string;
  status: string;
  handoff_notes: string | null;
  timeline: TimelineEntry[];
  stages: StageDoc[];
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

  // Stage local overrides: stageId → { done, submittedAt, previews[] }
  const [overrides, setOverrides] = useState<Map<number, {
    done: boolean; submittedAt: string | null; previews: string[];
  }>>(new Map());

  const [markingId, setMarkingId]   = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  // Approve flow
  const [showApprove, setShowApprove]   = useState(false);
  const [handoffNotes, setHandoffNotes] = useState("");
  const [approving, setApproving]       = useState(false);
  const [approved, setApproved]         = useState(false);

  // Flag-for-rework flow
  const [showRework, setShowRework]         = useState(false);
  const [reworkStages, setReworkStages]     = useState<Set<number>>(new Set());
  const [reworkInstructions, setReworkInstructions] = useState("");
  const [flagging, setFlagging]             = useState(false);
  const [flagged, setFlagged]               = useState(false);

  const fileInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const stored = localStorage.getItem("826_user");
      if (stored) setUserRole(JSON.parse(stored).role ?? "");
    } catch {}
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res  = await fetch(`/api/head-technician/jobs/${jobId}`);
        const json = await res.json();
        if (res.ok && json.job) setJob(json.job);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, [jobId]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const relevantCategory = userRole === "head_installer" ? "installation" : "preparation";

  const myStages = (job?.stages ?? []).filter(
    (s) => s.category === relevantCategory
  );

  function isStgDone(s: StageDoc) {
    return overrides.get(s.stage_template_id)?.done ?? s.done;
  }

  const allDone    = myStages.length > 0 && myStages.every((s) => isStgDone(s));
  const doneCount  = myStages.filter((s) => isStgDone(s)).length;

  // ── Actions ───────────────────────────────────────────────────────────────

  async function markDone(stage: StageDoc) {
    if (isStgDone(stage) || markingId !== null) return;
    setMarkingId(stage.stage_template_id);
    const now = new Date().toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
    // Optimistic update
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(stage.stage_template_id, {
        done: true,
        submittedAt: now,
        previews: prev.get(stage.stage_template_id)?.previews ?? [],
      });
      return next;
    });
    try {
      await fetch(`/api/head-technician/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_stage_done", stage_id: stage.stage_template_id }),
      });
    } catch {}
    setMarkingId(null);
  }

  function handleFileChange(stage: StageDoc, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingId(stage.stage_template_id);
    const readers = Array.from(files).map(
      (file) =>
        new Promise<string>((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((previews) => {
      setOverrides((prev) => {
        const next    = new Map(prev);
        const current = prev.get(stage.stage_template_id);
        next.set(stage.stage_template_id, {
          done:        current?.done        ?? stage.done,
          submittedAt: current?.submittedAt ?? stage.submitted_at,
          previews:    [...(current?.previews ?? []), ...previews],
        });
        return next;
      });
      setUploadingId(null);
    });
  }

  async function handleApprove() {
    setApproving(true);
    try {
      await fetch(`/api/head-technician/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", handoff_notes: handoffNotes }),
      });
      setApproved(true);
      setShowApprove(false);
    } catch {}
    setApproving(false);
  }

  async function handleFlagRework() {
    if (reworkStages.size === 0 || !reworkInstructions.trim()) return;
    setFlagging(true);
    try {
      await fetch(`/api/head-technician/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "flag_rework",
          rework_stage_ids: [...reworkStages],
          rework_instructions: reworkInstructions.trim(),
        }),
      });
      setFlagged(true);
      setShowRework(false);
    } catch {}
    setFlagging(false);
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <Loader2 size={20} className="text-gray-400 animate-spin" />
      </main>
    );
  }

  if (!job) {
    return (
      <main className="px-4 py-6 max-w-md mx-auto text-center">
        <p className="text-sm text-gray-400 mt-20">Job not found.</p>
      </main>
    );
  }

  const approveLabel =
    userRole === "head_installer" ? "Approve & Mark for Release" : "Approve Preparation";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <main className="max-w-md mx-auto px-4 pb-32 pt-4 space-y-4">

        {/* ── Header ── */}
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

        {/* ── Status ── */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-500"}`}>
            {job.status}
          </span>
          {approved && (
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-50 text-emerald-600">
              {userRole === "head_installer" ? "Marked for Release" : "Preparation Approved"}
            </span>
          )}
          {flagged && (
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-orange-50 text-orange-600">
              Flagged for Rework
            </span>
          )}
        </div>

        {/* ── Job info ── */}
        <div className="bg-white rounded-2xl p-4 space-y-2.5 text-sm">
          <Row label="Customer"  value={job.customer_name} />
          <Row label="Vehicle"   value={`${job.plate_number}${job.car_make ? ` — ${job.car_make}` : ""}${job.car_color ? ` (${job.car_color})` : ""}`} />
          <Row label="Service"   value={job.service} accent="orange" />
          <Row label="Scheduled" value={job.scheduled_start} />
        </div>

        {/* ── Handoff notes (head_installer only) ── */}
        {userRole === "head_installer" && job.handoff_notes && (
          <div className="bg-blue-50 rounded-2xl p-4 flex gap-3">
            <Info size={15} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-1">Handoff Notes from Head Detailer</p>
              <p className="text-sm text-blue-700 leading-snug">{job.handoff_notes}</p>
            </div>
          </div>
        )}

        {/* ── Progress ── */}
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

        {/* ── Stage checklist ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            {relevantCategory === "preparation" ? "Preparation Stages" : "Installation Stages"}
          </h2>

          {myStages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No stages assigned for your role.</p>
          ) : (
            <div className="space-y-2">
              {myStages.map((stage) => {
                const override   = overrides.get(stage.stage_template_id);
                const done       = override?.done       ?? stage.done;
                const submittedAt = override?.submittedAt ?? stage.submitted_at;
                const previews   = override?.previews   ?? [];
                const allMedia   = [...stage.media, ...previews.map((p) => ({ url: p, type: "photo", preview: p }))];
                const isMarking  = markingId === stage.stage_template_id;
                const isUploading = uploadingId === stage.stage_template_id;

                return (
                  <div
                    key={stage.stage_template_id}
                    className={`bg-white rounded-2xl p-4 space-y-3 border transition-colors ${
                      done ? "border-emerald-100" : "border-gray-100"
                    }`}
                  >
                    {/* Stage header */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {done
                          ? <CheckCircle2 size={18} className="text-emerald-500" />
                          : <Circle size={18} className="text-gray-300" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${done ? "text-gray-500" : "text-gray-900"}`}>
                          {stage.order}. {stage.name}
                        </p>
                        {submittedAt && (
                          <p className="text-xs text-gray-400 mt-0.5">Done: {submittedAt}</p>
                        )}
                      </div>
                    </div>

                    {/* Media thumbnails */}
                    {allMedia.length > 0 && (
                      <div className="flex flex-wrap gap-2 pl-7">
                        {allMedia.map((m, i) =>
                          m.type === "video" ? (
                            <video
                              key={i}
                              src={m.url}
                              className="w-14 h-14 rounded-xl object-cover bg-gray-100"
                            />
                          ) : (
                            <img
                              key={i}
                              src={(m as any).preview ?? m.url}
                              alt=""
                              className="w-14 h-14 rounded-xl object-cover bg-gray-100"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          )
                        )}
                      </div>
                    )}

                    {/* Actions row — only if not approved/flagged yet */}
                    {!approved && !flagged && (
                      <div className="flex items-center gap-2 pl-7">
                        {/* Media upload */}
                        <button
                          onClick={() => fileInputRefs.current.get(stage.stage_template_id)?.click()}
                          disabled={isUploading}
                          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-40"
                        >
                          {isUploading
                            ? <Loader2 size={12} className="animate-spin" />
                            : <ImagePlus size={12} />
                          }
                          Add Media
                        </button>
                        <input
                          ref={(el) => { if (el) fileInputRefs.current.set(stage.stage_template_id, el); }}
                          type="file"
                          accept="image/jpeg,image/png,video/mp4,video/quicktime"
                          multiple
                          className="hidden"
                          onChange={(e) => handleFileChange(stage, e.target.files)}
                        />

                        {/* Mark Done */}
                        {!done && (
                          <button
                            onClick={() => markDone(stage)}
                            disabled={isMarking}
                            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-gray-900 rounded-lg px-3 py-1.5 hover:bg-gray-700 transition-colors disabled:opacity-50"
                          >
                            {isMarking
                              ? <Loader2 size={12} className="animate-spin" />
                              : <CheckCircle2 size={12} />
                            }
                            Mark Done
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Approve / Rework actions ── */}
        {!approved && !flagged && myStages.length > 0 && (
          <div className="space-y-2 pt-1">

            {/* Approve — only when all stages done */}
            {allDone && !showRework && (
              showApprove ? (
                <div className="bg-white rounded-2xl p-4 space-y-3 border border-emerald-100">
                  <p className="text-sm font-semibold text-gray-900">
                    {userRole === "head_installer"
                      ? "Final Quality Check — Approve"
                      : "Approve Preparation"}
                  </p>
                  {userRole === "head_detailer" && (
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
              )
            )}

            {/* Flag for Rework */}
            {!showApprove && (
              showRework ? (
                <div className="bg-white rounded-2xl p-4 space-y-3 border border-orange-100">
                  <p className="text-sm font-semibold text-gray-900">Flag Stages for Rework</p>

                  <p className="text-xs text-gray-500">Select which stages need rework:</p>
                  <div className="space-y-2">
                    {myStages.map((s) => (
                      <label key={s.stage_template_id} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reworkStages.has(s.stage_template_id)}
                          onChange={() => {
                            setReworkStages((prev) => {
                              const next = new Set(prev);
                              next.has(s.stage_template_id) ? next.delete(s.stage_template_id) : next.add(s.stage_template_id);
                              return next;
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-200"
                        />
                        <span className="text-sm text-gray-700">{s.order}. {s.name}</span>
                      </label>
                    ))}
                  </div>

                  <textarea
                    value={reworkInstructions}
                    onChange={(e) => setReworkInstructions(e.target.value)}
                    placeholder="Describe what needs to be corrected…"
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowRework(false); setReworkStages(new Set()); setReworkInstructions(""); }}
                      className="flex-1 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFlagRework}
                      disabled={flagging || reworkStages.size === 0 || !reworkInstructions.trim()}
                      className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-orange-500 rounded-xl py-2.5 hover:bg-orange-600 transition-colors disabled:opacity-40"
                    >
                      {flagging ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                      Submit
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowRework(true)}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium text-orange-600 border border-orange-200 rounded-2xl py-3 hover:bg-orange-50 transition-colors"
                >
                  <AlertTriangle size={15} />
                  Flag for Rework
                </button>
              )
            )}
          </div>
        )}

        {/* ── Approved success banner ── */}
        {approved && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
            <ThumbsUp size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                {userRole === "head_installer" ? "Job approved — marked For Release." : "Preparation approved — handed off to Installation."}
              </p>
              {handoffNotes && (
                <p className="text-xs text-emerald-700 mt-1">Notes: {handoffNotes}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Rework flagged banner ── */}
        {flagged && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold text-orange-700">
              Flagged for rework. Operations has been notified.
            </p>
          </div>
        )}

      </main>

      <BottomNav active="jobs" />
    </>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "orange";
}) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className={`font-medium text-right ${accent === "orange" ? "text-orange-500" : "text-gray-800"}`}>
        {value}
      </span>
    </div>
  );
}
