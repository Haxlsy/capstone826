"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, CheckCircle2, Circle, ImagePlus, Video,
  ThumbsUp, AlertTriangle, Loader2, Info, RefreshCw, Play, X, Users, ChevronDown, Clock, AlarmClock,
} from "lucide-react";
import { BottomNav } from "./components/BottomNav";

// ── Helpers ──────────────────────────────────────────────────────────────────

function compressImage(file: File, maxWidth = 1920, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) : file),
        "image/jpeg", quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

interface StageMedia { id: string; url: string; type: string; pending?: boolean }

interface StageDoc {
  id:                  string;
  name:                string;
  order:               number;
  category:            string;
  category_id:         string | null;
  category_role:       string;
  category_color:      string | null;
  stage_duration_mins: number;
  expected_end_at:     string | null;
  is_delayed:          boolean;
  is_unlocked:         boolean;
  status:              "pending" | "in_progress" | "done" | "for_rework";
  rework_instructions: string | null;
  handoff_notes:       string | null;
  completion_notes:    string | null;
  completed_at:        string | null;
  media:               StageMedia[];
}

interface TimelineEntry {
  status:     string;
  changed_at: string;
  changed_by: string | null;
}

interface JobDetail {
  job_id:                string;
  raw_id:                string;
  customer_name:         string;
  plate_number:          string;
  car_make:              string;
  service:               string;
  technician_name:       string;
  scheduled_start:       string;
  status:                string;
  handoff_notes:         string | null;
  preparation_finished:  boolean;
  last_stage_role:       string;
  finishing_approved_at: string | null;
  category_handoffs:     Record<string, string>;
  detailers:             string[];
  installers:            string[];
  timeline:              TimelineEntry[];
  stages:                StageDoc[];
}

// Category group derived from stages
interface CategoryGroup {
  id:     string;
  name:   string;
  role:   string;
  color:  string;
  stages: StageDoc[];
  minOrder: number;
}

const STATUS_BADGE: Record<string, string> = {
  Pending:       "bg-yellow-50 text-yellow-600 border border-yellow-100",
  Ongoing:       "bg-blue-50 text-blue-600 border border-blue-100",
  "For Rework":  "bg-orange-50 text-orange-600 border border-orange-100",
  "For Release": "bg-emerald-50 text-emerald-600 border border-emerald-100",
  Released:      "bg-teal-50 text-teal-600 border border-teal-100",
  Delayed:       "bg-red-50 text-red-600 border border-red-100",
  Cancelled:     "bg-gray-100 text-gray-500 border border-gray-200",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function HeadTechJobHistoryPage({ jobId }: { jobId: string }) {
  const router = useRouter();

  const [job, setJob]             = useState<JobDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userRole, setUserRole]   = useState<string>("");

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const [removingId,  setRemovingId]  = useState<string | null>(null);
  const [preview, setPreview]         = useState<{ url: string; type: string } | null>(null);

  const [markingId,    setMarkingId]    = useState<string | null>(null);
  const [startingJob,  setStartingJob]  = useState(false);
  const [rejectionAlert, setRejectionAlert] = useState<{ message: string } | null>(null);

  // Unified approve state — tracks which category is being approved
  const [approvingCategoryId, setApprovingCategoryId] = useState<string | null>(null);
  const [handoffNotes, setHandoffNotes] = useState("");
  const [approving,    setApproving]    = useState(false);

  // Unified rework state — tracks which category's stages are being flagged
  const [reworkOpen,       setReworkOpen]       = useState(false);
  const [reworkCategoryId, setReworkCategoryId] = useState<string | null>(null);
  const [selectedRework,   setSelectedRework]   = useState<string | null>(null);
  const [reworkNote,       setReworkNote]        = useState("");
  const [submittingRework, setSubmittingRework]  = useState(false);
  const [reworkError,      setReworkError]       = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const stored = localStorage.getItem("826_user");
      if (stored) setUserRole(JSON.parse(stored).role ?? "");
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res  = await fetch(`/api/head-technician/jobs/${jobId}`);
      const json = await res.json();
      if (!res.ok) { setLoadError(json?.error ?? `HTTP ${res.status}`); return; }
      if (json.job) setJob(json.job);
      else setLoadError("No job data returned.");
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const isInstaller = userRole === "head_installer";
  const myRole      = isInstaller ? "installer" : "detailer";

  const delayedStages = useMemo(
    () => (job?.stages ?? []).filter((s) => s.is_delayed),
    [job]
  );

  // Build ordered category groups from all stages.
  const allCategoryGroups: CategoryGroup[] = useMemo(() => {
    const map = new Map<string, CategoryGroup>();
    for (const s of job?.stages ?? []) {
      const key = s.category_id ?? s.category;
      if (!map.has(key)) {
        map.set(key, {
          id:       s.category_id ?? s.category,
          name:     s.category,
          role:     s.category_role,
          color:    s.category_color ?? "blue",
          stages:   [],
          minOrder: s.order,
        });
      }
      const g = map.get(key)!;
      g.stages.push(s);
      g.minOrder = Math.min(g.minOrder, s.order);
    }
    return [...map.values()].sort((a, b) => a.minOrder - b.minOrder);
  }, [job]);

  // Categories belonging to the current user's role.
  const myGroups = useMemo(
    () => allCategoryGroups.filter((g) => g.role === myRole),
    [allCategoryGroups, myRole]
  );

  // Categories from the other role, shown read-only.
  const otherGroups = useMemo(
    () => allCategoryGroups.filter((g) => g.role !== myRole),
    [allCategoryGroups, myRole]
  );

  const categoryHandoffs = job?.category_handoffs ?? {};
  const finishingAlreadyApproved = Boolean(job?.finishing_approved_at);

  // All of my stages (unlocked) done.
  const myUnlockedStages = myGroups.flatMap((g) => g.stages.filter((s) => s.is_unlocked));

  // All stages across all groups done.
  const allJobStagesDone = (job?.stages ?? []).length > 0 && (job?.stages ?? []).every((s) => s.status === "done");

  // The last category group overall determines who gets "Pass to Operations".
  const lastGroup  = allCategoryGroups.at(-1);
  const isLastRole = lastGroup?.role === myRole;

  // Progress counts across all my unlocked stages.
  const progressDone = myUnlockedStages.filter((s) => s.status === "done").length;
  const progress     = myUnlockedStages.length > 0
    ? Math.round((progressDone / myUnlockedStages.length) * 100)
    : 0;

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleStartJob() {
    setStartingJob(true);
    try {
      const res = await fetch(`/api/head-technician/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_job" }),
      });
      if (!res.ok) { const j = await res.json(); alert(j.error ?? "Failed to start job."); return; }
      setJob((prev) => prev ? { ...prev, status: "Ongoing" } : prev);
    } catch {}
    finally { setStartingJob(false); }
  }

  async function markDone(stage: StageDoc, notes: string) {
    if (stage.status === "done" || markingId !== null) return;
    setMarkingId(stage.id);
    try {
      const res = await fetch(`/api/head-technician/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_stage_done", stage_id: stage.id, completion_notes: notes || null }),
      });
      if (res.ok) {
        const now = new Date().toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        });
        setJob((prev) => prev ? {
          ...prev,
          stages: prev.stages.map((s) =>
            s.id === stage.id ? { ...s, status: "done", completed_at: now, completion_notes: notes || null } : s
          ),
        } : prev);
      }
    } catch {}
    setMarkingId(null);
  }

  async function handleFileChange(stage: StageDoc, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingId(stage.id);
    setUploadError((prev) => { const n = { ...prev }; delete n[stage.id]; return n; });

    for (let file of Array.from(files)) {
      const isPhoto = file.type.startsWith("image/");
      if (isPhoto) file = await compressImage(file);

      const tmpId    = `tmp-${Date.now()}`;
      const localUrl = URL.createObjectURL(file);

      setJob((prev) => prev ? {
        ...prev,
        stages: prev.stages.map((s) =>
          s.id === stage.id
            ? { ...s, media: [...s.media, { id: tmpId, url: localUrl, type: isPhoto ? "photo" : "video", pending: true }] }
            : s
        ),
      } : prev);

      if (isPhoto) {
        try {
          const validateForm = new FormData();
          validateForm.append("file", file);
          const validateRes  = await fetch("/api/ai/image-handler", { method: "POST", body: validateForm });
          const validateJson = await validateRes.json();

          if (!validateJson.approved) {
            URL.revokeObjectURL(localUrl);
            setJob((prev) => prev ? {
              ...prev,
              stages: prev.stages.map((s) =>
                s.id === stage.id ? { ...s, media: s.media.filter((m) => m.id !== tmpId) } : s
              ),
            } : prev);
            setRejectionAlert({ message: validateJson.message ?? "This image is not acceptable. Please retake the photo." });
            continue;
          }
        } catch {}
      }

      try {
        const form = new FormData();
        form.append("file", file);
        const res  = await fetch(`/api/head-technician/jobs/${jobId}/stages/${stage.id}/media`, { method: "POST", body: form });
        const json = await res.json();

        if (res.ok && json.media) {
          URL.revokeObjectURL(localUrl);
          setJob((prev) => prev ? {
            ...prev,
            stages: prev.stages.map((s) =>
              s.id === stage.id
                ? { ...s, media: s.media.map((m) => m.id === tmpId
                    ? { id: json.media.id, url: json.media.file_url, type: json.media.media_type }
                    : m
                  )}
                : s
            ),
          } : prev);
        } else {
          URL.revokeObjectURL(localUrl);
          setJob((prev) => prev ? {
            ...prev,
            stages: prev.stages.map((s) =>
              s.id === stage.id ? { ...s, media: s.media.filter((m) => m.id !== tmpId) } : s
            ),
          } : prev);
          setUploadError((prev) => ({ ...prev, [stage.id]: json?.error ?? "Upload failed." }));
        }
      } catch (err: unknown) {
        URL.revokeObjectURL(localUrl);
        setJob((prev) => prev ? {
          ...prev,
          stages: prev.stages.map((s) =>
            s.id === stage.id ? { ...s, media: s.media.filter((m) => m.id !== tmpId) } : s
          ),
        } : prev);
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
      setJob((prev) => prev ? {
        ...prev,
        stages: prev.stages.map((s) =>
          s.id === stage.id ? { ...s, media: s.media.filter((m) => m.id !== mediaId) } : s
        ),
      } : prev);
    } catch {}
    setRemovingId(null);
  }

  // Approve a category handoff (or pass to operations for the last category).
  async function handleApprove(categoryId: string) {
    setApproving(true);
    const action = (isLastRole && allJobStagesDone) ? "approve_finishing" : "approve";
    try {
      const res  = await fetch(`/api/head-technician/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, category_id: categoryId, handoff_notes: handoffNotes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to approve.");
      setApprovingCategoryId(null);
      setHandoffNotes("");
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to approve.");
    } finally {
      setApproving(false);
    }
  }

  async function handleFlagRework() {
    if (!selectedRework || !reworkNote.trim()) return;
    setSubmittingRework(true);
    setReworkError(null);
    try {
      const res  = await fetch(`/api/head-technician/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "flag_rework", stage_ids: [selectedRework], rework_instructions: reworkNote.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to flag rework");
      closeRework();
      await load();
    } catch (err: unknown) {
      setReworkError(err instanceof Error ? err.message : String(err));
    } finally { setSubmittingRework(false); }
  }

  function openRework(categoryId: string) {
    setReworkCategoryId(categoryId);
    setSelectedRework(null);
    setReworkNote("");
    setReworkError(null);
    setReworkOpen(true);
  }

  function closeRework() {
    setReworkOpen(false);
    setReworkCategoryId(null);
    setSelectedRework(null);
    setReworkNote("");
    setReworkError(null);
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) return (
    <main className="flex items-center justify-center min-h-screen">
      <Loader2 size={22} className="text-gray-300 animate-spin" />
    </main>
  );

  if (!job) return (
    <main className="px-4 py-6 max-w-md mx-auto text-center space-y-3 mt-20">
      <p className="text-sm text-red-500">{loadError ?? "Job not found."}</p>
      <button onClick={() => router.back()} className="text-xs text-gray-400 underline">Go back</button>
    </main>
  );

  function isReadOnly(stage: StageDoc): boolean {
    if (job!.status === "Pending") return true;
    if (finishingAlreadyApproved) return true;
    if (!stage.is_unlocked) return true;
    return false;
  }

  // Find handoff notes left for my current category from the preceding other-role category.
  function getPrecedingHandoffNotes(group: CategoryGroup): string | null {
    const groupIdx = allCategoryGroups.findIndex((g) => g.id === group.id);
    if (groupIdx <= 0) return null;
    const preceding = allCategoryGroups[groupIdx - 1];
    if (preceding.role === myRole) return null;
    const lastStage = [...preceding.stages].sort((a, b) => b.order - a.order)[0];
    return lastStage?.handoff_notes ?? null;
  }

  // Stages available for rework flagging (done stages in the category).
  const reworkableStages = reworkCategoryId
    ? (allCategoryGroups.find((g) => g.id === reworkCategoryId)?.stages ?? []).filter((s) => s.status === "done")
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <main className="max-w-md mx-auto px-4 pb-32 pt-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
            Jobs
          </button>
          <span className="text-[11px] text-gray-400 font-mono tracking-wide">{job.job_id}</span>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-500"}`}>
            {job.status}
          </span>
          {finishingAlreadyApproved && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              Passed to Operations
            </span>
          )}
          {job.status === "For Rework" && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100 flex items-center gap-1">
              <AlertTriangle size={11} />
              Rework Required
            </span>
          )}
        </div>

        {/* Delay summary */}
        {delayedStages.length > 0 && (
          <div className="bg-red-50 rounded-2xl p-4 flex gap-3 border border-red-100">
            <AlarmClock size={15} className="text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-700 mb-1.5">
                {delayedStages.length} Stage{delayedStages.length > 1 ? "s" : ""} Delayed
              </p>
              <ul className="space-y-1">
                {delayedStages.map((s) => (
                  <li key={s.id} className="text-xs text-red-700 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                    <span className="font-medium">{s.order}. {s.name}</span>
                    {s.expected_end_at && (
                      <span className="text-red-400 truncate">
                        · was due {new Date(s.expected_end_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Job info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] divide-y divide-gray-50">
          <InfoRow label="Customer"       value={job.customer_name} />
          <InfoRow label="Vehicle"        value={`${job.plate_number}${job.car_make ? ` · ${job.car_make}` : ""}`} />
          <InfoRow label="Service"        value={job.service} accent="orange" />
          <InfoRow label="Scheduled Start" value={job.scheduled_start} />
          {!isInstaller && job.detailers.length > 0 && <CrewRow label="Detailers"  members={job.detailers} />}
          {isInstaller  && job.installers.length > 0 && <CrewRow label="Installers" members={job.installers} />}
        </div>

        {/* Start Job */}
        {job.status === "Pending" && (
          <div className="space-y-2">
            <button
              onClick={handleStartJob}
              disabled={startingJob || isInstaller}
              className={`w-full flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-2xl py-3.5 transition-all disabled:opacity-50 ${
                isInstaller ? "bg-gray-300 cursor-not-allowed" : "bg-gray-900 hover:bg-gray-800 active:scale-[0.98]"
              }`}
            >
              {startingJob ? <Loader2 size={15} className="animate-spin" /> : isInstaller ? <Clock size={15} /> : <Play size={15} />}
              {startingJob ? "Starting…" : isInstaller ? "Waiting for Preparation" : "Start Job"}
            </button>
            {isInstaller && (
              <p className="text-[10px] text-gray-400 text-center px-6">
                Only the Head Detailer can start the job. Please wait for preparation to begin.
              </p>
            )}
          </div>
        )}

        {/* Finishing passed notice */}
        {!isInstaller && finishingAlreadyApproved && (
          <div className="bg-emerald-50 rounded-2xl p-4 flex gap-3 border border-emerald-100">
            <ThumbsUp size={15} className="text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-1">Passed to Operations</p>
              <p className="text-sm text-emerald-700 leading-snug">All stages are complete and the job has been handed off to Operations.</p>
            </div>
          </div>
        )}

        {/* Locked stages notice */}
        {myGroups.some((g) => g.stages.some((s) => !s.is_unlocked)) && (
          <div className="bg-amber-50 rounded-2xl p-4 flex gap-3 border border-amber-100">
            <Clock size={15} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">Stages Pending</p>
              <p className="text-sm text-amber-700 leading-snug">
                Some of your stages are locked until the other team completes and approves their preceding work.
              </p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {myUnlockedStages.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-gray-500">
              <span>Progress</span>
              <span>{progressDone} / {myUnlockedStages.length} stages · {progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progress === 100 ? "bg-emerald-500" : progress >= 50 ? "bg-blue-500" : "bg-gray-400"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Other-role stages shown read-only */}
        {otherGroups.some((g) => g.stages.some((s) => s.status === "done")) && (
          <section className="space-y-4">
            <SectionLabel>
              {isInstaller ? "Preparation Stages" : "Installation Stages"}
            </SectionLabel>
            {otherGroups.map((g) => {
              const doneStages = g.stages.filter((s) => s.status === "done");
              if (doneStages.length === 0) return null;
              return (
                <div key={g.id} className="space-y-2">
                  <CategoryBadge name={g.name} color={g.color} />
                  {doneStages.map((stage) => (
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
                  {/* Handoff notes left by this other-role category */}
                  {(() => {
                    const lastStage = [...g.stages].sort((a, b) => b.order - a.order)[0];
                    return lastStage?.handoff_notes ? (
                      <div className="bg-blue-50 rounded-2xl p-3 flex gap-2 border border-blue-100">
                        <Info size={13} className="text-blue-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-blue-700 mb-0.5">Handoff Notes</p>
                          <p className="text-xs text-blue-700 leading-snug">{lastStage.handoff_notes}</p>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              );
            })}
          </section>
        )}

        {/* My stages — grouped by category */}
        {myGroups.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No stages assigned for your role.</p>
        ) : (
          <section className="space-y-4">
            {myGroups.map((g, idx) => {
              const precedingNotes = getPrecedingHandoffNotes(g);
              const isApproved     = g.id in categoryHandoffs;
              const isLastOverall  = g.id === lastGroup?.id;
              const allGroupDone   = g.stages.every((s) => s.status === "done");

              return (
                <div key={g.id} className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CategoryBadge name={g.name} color={g.color} />
                    {isLastOverall && isLastRole && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                        Last stage before Operations Inspection
                      </span>
                    )}
                    {isApproved && !isLastOverall && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✓ Handed off
                      </span>
                    )}
                  </div>

                  {/* Handoff notes received from the preceding other-role category */}
                  {precedingNotes && idx === myGroups.findIndex((gg) => gg.id === g.id) && (
                    <div className="bg-blue-50 rounded-2xl p-3 flex gap-2 border border-blue-100">
                      <Info size={13} className="text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-blue-700 mb-0.5">Handoff Notes</p>
                        <p className="text-xs text-blue-700 leading-snug">{precedingNotes}</p>
                      </div>
                    </div>
                  )}

                  {g.stages.map((stage) => (
                    <StageCard
                      key={stage.id}
                      stage={stage}
                      readOnly={isReadOnly(stage)}
                      isMarking={markingId === stage.id}
                      isUploading={uploadingId === stage.id}
                      removingId={removingId}
                      uploadError={uploadError[stage.id] ?? null}
                      onMarkDone={(notes) => markDone(stage, notes)}
                      onFileChange={(files) => handleFileChange(stage, files)}
                      onRemoveMedia={(mediaId) => removeMedia(stage, mediaId)}
                      onPreview={(url, type) => setPreview({ url, type })}
                    />
                  ))}

                  {/* Per-category approve/rework panel */}
                  {allGroupDone && !isApproved && !finishingAlreadyApproved && !isLastOverall && (
                    <div className="pt-1">
                      {approvingCategoryId === g.id ? (
                        <div className="bg-white rounded-2xl p-4 space-y-3 border border-emerald-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
                          <p className="text-sm font-semibold text-gray-900">Approve {g.name}</p>
                          <textarea
                            value={handoffNotes}
                            onChange={(e) => setHandoffNotes(e.target.value)}
                            placeholder={`Optional handoff notes for the next team…`}
                            rows={3}
                            className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 transition"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setApprovingCategoryId(null); setHandoffNotes(""); }}
                              className="flex-1 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl py-3 hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleApprove(g.id)}
                              disabled={approving}
                              className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl py-3 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {approving ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                              Confirm
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => openRework(g.id)}
                            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-orange-500 rounded-2xl py-3.5 hover:bg-orange-600 active:scale-[0.98] transition-all"
                          >
                            <AlertTriangle size={15} />
                            Flag for Rework
                          </button>
                          <button
                            onClick={() => { setApprovingCategoryId(g.id); setHandoffNotes(""); }}
                            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-600 rounded-2xl py-3.5 hover:bg-emerald-700 active:scale-[0.98] transition-all"
                          >
                            <ThumbsUp size={15} />
                            Approve {g.name}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Approved success banner for this category */}
                  {isApproved && !isLastOverall && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex items-start gap-2">
                      <ThumbsUp size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                      <p className="text-xs font-semibold text-emerald-800">
                        {g.name} approved — handed off to the next team.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Pass to Operations — last category, all done */}
        {isLastRole && allJobStagesDone && !finishingAlreadyApproved && (
          <div className="pt-1">
            {approvingCategoryId === "__finishing__" ? (
              <div className="bg-white rounded-2xl p-4 space-y-3 border border-emerald-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
                <p className="text-sm font-semibold text-gray-900">Pass to Operations</p>
                <p className="text-xs text-gray-500">
                  All finishing stages are done. Passing to Operations will allow them to mark this job for release.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setApprovingCategoryId(null); setHandoffNotes(""); }}
                    className="flex-1 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl py-3 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApprove(lastGroup?.id ?? "__finishing__")}
                    disabled={approving}
                    className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl py-3 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {approving ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                    Confirm
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => openRework(lastGroup?.id ?? "__finishing__")}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-orange-500 rounded-2xl py-3.5 hover:bg-orange-600 active:scale-[0.98] transition-all"
                >
                  <AlertTriangle size={15} />
                  Flag for Rework
                </button>
                <button
                  onClick={() => setApprovingCategoryId("__finishing__")}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-600 rounded-2xl py-3.5 hover:bg-emerald-700 active:scale-[0.98] transition-all"
                >
                  <ThumbsUp size={15} />
                  Pass to Operation
                </button>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Unified rework modal */}
      {reworkOpen && (
        <ReworkModal
          title={`Flag ${allCategoryGroups.find((g) => g.id === reworkCategoryId)?.name ?? "Stages"} for Rework`}
          stages={reworkableStages}
          selected={selectedRework}
          note={reworkNote}
          submitting={submittingRework}
          error={reworkError}
          onSelect={(id) => setSelectedRework((prev) => prev === id ? null : id)}
          onNoteChange={setReworkNote}
          onSubmit={handleFlagRework}
          onClose={closeRework}
        />
      )}

      {/* Full-screen media preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            aria-label="Close preview"
            className="absolute top-5 right-5 text-white bg-white/10 hover:bg-white/20 rounded-full p-2.5 transition-colors"
            onClick={() => setPreview(null)}
          >
            <X size={20} />
          </button>
          {preview.type === "video" ? (
            <video src={preview.url} controls autoPlay className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={preview.url} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}

      {/* Image rejection alert */}
      {rejectionAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Image Not Accepted</h3>
                <p className="text-xs text-gray-400 mt-0.5">Please retake your photo</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-snug">{rejectionAlert.message}</p>
            <button
              type="button"
              onClick={() => setRejectionAlert(null)}
              className="w-full text-sm font-semibold text-white bg-gray-900 rounded-xl py-3 hover:bg-gray-800 active:scale-[0.98] transition-all"
            >
              OK, Retake Photo
            </button>
          </div>
        </div>
      )}

      <BottomNav active="jobs" />
    </>
  );
}

// ── ReworkModal ───────────────────────────────────────────────────────────────

function ReworkModal({
  title, stages, selected, note, submitting, error,
  onSelect, onNoteChange, onSubmit, onClose,
}: {
  title:        string;
  stages:       StageDoc[];
  selected:     string | null;
  note:         string;
  submitting:   boolean;
  error:        string | null;
  onSelect:     (id: string) => void;
  onNoteChange: (v: string) => void;
  onSubmit:     () => void;
  onClose:      () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-orange-500" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-xs text-gray-500">
          Select the stage that needs to be redone. It will be reverted to In Progress with your instructions.
        </p>

        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {stages.map((s) => (
            <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="rework-stage"
                checked={selected === s.id}
                onChange={() => onSelect(s.id)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-gray-700 flex-1">{s.order}. {s.name}</span>
            </label>
          ))}
          {stages.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No completed stages to flag.</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Instructions <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Describe what needs to be redone…"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 bg-gray-50 text-gray-800 placeholder-gray-400 transition"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl py-3 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !selected || !note.trim()}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-orange-500 rounded-xl py-3 hover:bg-orange-600 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            {submitting ? "Flagging…" : "Flag for Rework"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CategoryBadge ─────────────────────────────────────────────────────────────

const COLOR_BADGE: Record<string, string> = {
  blue:    "bg-blue-50 text-blue-700 border-blue-200",
  purple:  "bg-purple-50 text-purple-700 border-purple-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  orange:  "bg-orange-50 text-orange-700 border-orange-200",
  rose:    "bg-rose-50 text-rose-700 border-rose-200",
  teal:    "bg-teal-50 text-teal-700 border-teal-200",
  yellow:  "bg-yellow-50 text-yellow-700 border-yellow-200",
};

function CategoryBadge({ name, color }: { name: string; color: string }) {
  const cls = COLOR_BADGE[color] ?? COLOR_BADGE.blue;
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide border ${cls}`}>
      {name}
    </span>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-0.5">
      {children}
    </p>
  );
}

// ── StageCard ─────────────────────────────────────────────────────────────────

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

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
  onMarkDone:    (notes: string) => void;
  onFileChange:  (files: FileList | null) => void;
  onRemoveMedia: (mediaId: string) => void;
  onPreview:     (url: string, type: string) => void;
}) {
  const [notes, setNotes] = useState("");

  const done       = stage.status === "done";
  const rework     = stage.status === "for_rework";
  const photoCount = stage.media.filter((m) => m.type !== "video").length;
  const videoCount = stage.media.filter((m) => m.type === "video").length;
  const photoFull  = photoCount >= 5;
  const videoFull  = videoCount >= 1;

  return (
    <div className={`bg-white rounded-2xl border transition-colors duration-150 ${
      done   ? "border-emerald-100" :
      rework ? "border-orange-200 bg-orange-50/30" :
               "border-gray-100"
    } shadow-[0_1px_4px_-2px_rgba(0,0,0,0.04)]`}>

      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 shrink-0">
          {done   ? <CheckCircle2 size={18} className="text-emerald-500" /> :
           rework ? <RefreshCw    size={18} className="text-orange-500" /> :
                    <Circle       size={18} className="text-gray-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`text-sm font-semibold leading-snug ${
              done ? "text-gray-400 line-through decoration-gray-300" :
              rework ? "text-orange-800" :
              "text-gray-900"
            }`}>
              {stage.order}. {stage.name}
            </p>
            {!done && stage.is_delayed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Delayed</span>
            )}
          </div>
          {!done && (stage.expected_end_at || stage.stage_duration_mins > 0) && (
            <p className={`flex items-center gap-1 text-[11px] mt-0.5 ${stage.is_delayed ? "text-red-500" : "text-gray-400"}`}>
              <Clock size={10} />
              {stage.expected_end_at && (
                <span>Due by {new Date(stage.expected_end_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              )}
              {stage.expected_end_at && stage.stage_duration_mins > 0 && <span className="text-gray-300">·</span>}
              {stage.stage_duration_mins > 0 && <span>{fmtDuration(stage.stage_duration_mins)}</span>}
            </p>
          )}
          {stage.completed_at && (
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">✓ Done {stage.completed_at}</p>
          )}
          {done && stage.completion_notes && (
            <p className="text-[11px] text-gray-500 mt-1 leading-snug italic">{stage.completion_notes}</p>
          )}
          {readOnly && !done && (
            <p className="text-[11px] text-gray-400 capitalize mt-0.5">{stage.status.replace("_", " ")}</p>
          )}
        </div>
      </div>

      {(rework || (!done && stage.rework_instructions)) && stage.rework_instructions && (
        <div className="mx-4 mb-3 flex gap-2 bg-orange-100 rounded-xl px-3 py-2.5">
          <AlertTriangle size={13} className="text-orange-500 mt-0.5 shrink-0" />
          <p className="text-xs text-orange-700 leading-snug">
            <span className="font-semibold">Rework: </span>{stage.rework_instructions}
          </p>
        </div>
      )}

      {stage.media.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {stage.media.map((m) => (
            <div key={m.id} className="relative w-16 h-16">
              <button className="w-16 h-16 rounded-xl overflow-hidden block focus:outline-none" onClick={() => !m.pending && onPreview(m.url, m.type)}>
                {m.type === "video" ? (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500"><Play size={20} /></div>
                ) : (
                  <img src={m.url} alt="" className="w-full h-full object-cover bg-gray-100" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                )}
              </button>
              {m.pending && (
                <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center pointer-events-none">
                  <Loader2 size={16} className="text-white animate-spin" />
                </div>
              )}
              {!m.pending && !readOnly && !done && (
                <button onClick={() => onRemoveMedia(m.id)} disabled={removingId === m.id} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center shadow">
                  {removingId === m.id ? <Loader2 size={9} className="text-white animate-spin" /> : <X size={9} className="text-white" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {uploadError && <p className="text-[11px] text-red-500 px-4 pb-3">{uploadError}</p>}

      {!readOnly && (
        <div className="px-4 pb-4 space-y-2">
          {!done && !rework && stage.media.length === 0 && (
            <p className="text-[11px] text-gray-400">Upload a photo or video before marking done.</p>
          )}
          {rework && <p className="text-[11px] text-orange-500">Media locked — stage is flagged for rework.</p>}
          {!done && !rework && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add completion notes… (required)"
              rows={2}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 transition"
            />
          )}
          <div className="flex items-center gap-2">
            <label className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border rounded-xl py-2.5 transition-colors ${
              isUploading || photoFull || done || rework
                ? "opacity-40 pointer-events-none text-gray-400 border-gray-200 bg-gray-50"
                : "text-gray-600 border-gray-200 hover:bg-gray-50 cursor-pointer bg-white"
            }`}>
              <ImagePlus size={13} />
              Photo {photoCount > 0 && `(${photoCount}/5)`}
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={isUploading || photoFull || done || rework} onChange={(e) => onFileChange(e.target.files)} />
            </label>

            <label className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border rounded-xl py-2.5 transition-colors ${
              isUploading || videoFull || done || rework
                ? "opacity-40 pointer-events-none text-gray-400 border-gray-200 bg-gray-50"
                : "text-gray-600 border-gray-200 hover:bg-gray-50 cursor-pointer bg-white"
            }`}>
              <Video size={13} />
              Video {videoFull ? "(1/1)" : ""}
              <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => onFileChange(e.target.files)} disabled={done || rework} />
            </label>

            {!done && (
              <button
                onClick={() => onMarkDone(notes)}
                disabled={isMarking || isUploading || stage.media.length === 0 || !notes.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-gray-900 rounded-xl py-2.5 hover:bg-gray-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isMarking ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: "orange" }) {
  return (
    <div className="flex justify-between items-start gap-4 px-4 py-3">
      <span className="text-xs font-medium text-gray-400 shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-right ${accent === "orange" ? "text-orange-500" : "text-gray-800"}`}>{value}</span>
    </div>
  );
}

// ── CrewRow ───────────────────────────────────────────────────────────────────

function CrewRow({ label, members }: { label: string; members: string[] }) {
  const [open, setOpen] = useState(false);
  const collapsible = members.length >= 2;
  return (
    <div className="flex justify-between items-start gap-4 px-4 py-3">
      <span className="text-xs font-medium text-gray-400 shrink-0">{label}</span>
      <div className="text-right">
        {collapsible ? (
          <>
            <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-sm font-semibold text-gray-800 ml-auto">
              <Users size={12} className="text-gray-400" />
              {members.length} members
              <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
            {open && <ul className="mt-1 space-y-0.5">{members.map((name, i) => <li key={i} className="text-xs text-gray-500">{name}</li>)}</ul>}
          </>
        ) : (
          <span className="text-sm font-semibold text-gray-800">{members[0]}</span>
        )}
      </div>
    </div>
  );
}
