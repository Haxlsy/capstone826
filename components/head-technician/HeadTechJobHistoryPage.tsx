"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, CheckCircle2, Circle, ImagePlus, Video,
  ThumbsUp, AlertTriangle, Loader2, Info, RefreshCw, Play, X, Users, ChevronDown, Clock, AlarmClock,
} from "lucide-react";
import { BottomNav } from "./components/BottomNav";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal, MediaPreviewModal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea, FieldLabel } from "@/components/ui/Field";
import { categorySwatch } from "@/lib/ui/category-colors";
import { fmtDateTime, fmtDateTimeShort } from "@/lib/time-display";
import { HeadTechJobDetailSkeleton } from "@/app/head-technician/[jobId]/loading";

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


// ── Component ────────────────────────────────────────────────────────────────

export default function HeadTechJobHistoryPage({ jobId }: { jobId: string }) {
  const router = useRouter();
  const toast = useToast();

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

    const groups = [...map.values()].map((g) => ({
    ...g,
    stages: [...g.stages].sort((a, b) => a.order - b.order),
  }));

    return groups.sort((a, b) => a.minOrder - b.minOrder);
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
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? "Failed to start job."); return; }
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
        const now = fmtDateTime(new Date().toISOString());
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
          if (json?.approved === false) {
            // AI-rejected video (e.g. non-automotive content) — same modal a
            // rejected photo gets, instead of the generic upload-error banner.
            setRejectionAlert({ message: json.message ?? json.error ?? "This video is not acceptable. Please retake it." });
          } else {
            setUploadError((prev) => ({ ...prev, [stage.id]: json?.error ?? "Upload failed." }));
          }
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
      toast.error(err instanceof Error ? err.message : "Failed to approve.");
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

  if (loading) return <HeadTechJobDetailSkeleton />;

  if (!job) return (
    <main className="px-4 py-6 max-w-md mx-auto text-center space-y-3 mt-20">
      <p className="text-sm text-status-delayed">{loadError ?? "Job not found."}</p>
      <button onClick={() => router.back()} className="text-xs text-muted underline">Go back</button>
    </main>
  );

  function isReadOnly(stage: StageDoc): boolean {
    if (stage.status === "for_rework") return false;
    if (job!.status === "Pending") return true;
    if (finishingAlreadyApproved) return true;
    if (!stage.is_unlocked) return true;
    return false;
  }

  // Find handoff notes left for my current category from the preceding other-role category.
  function getPrecedingHandoffNotes(group: CategoryGroup): string | null {
  const groupIdx = allCategoryGroups.findIndex((g) => g.id === group.id);
  if (groupIdx <= 0) return null;

  // Walk backwards to find the closest other-role group
  for (let i = groupIdx - 1; i >= 0; i--) {
    const preceding = allCategoryGroups[i];
    if (!(preceding.id in categoryHandoffs)) return null;
      const lastStage = [...preceding.stages].sort((a, b) => b.order - a.order)[0];
      return lastStage?.handoff_notes ?? null;
  }

  return null;
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
            className="flex items-center gap-1.5 text-sm font-semibold text-body hover:text-heading transition-colors"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
            Jobs
          </button>
          <span className="text-[11px] text-muted font-mono tracking-wide">{job.job_id}</span>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={job.status} className="px-3 py-1" />
          <Button
            variant="subtle"
            size="sm"
            className="ml-auto"
            onClick={() => router.push(`/head-technician/concerns?jobOrderId=${jobId}`)}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Report Concern
          </Button>
          {finishingAlreadyApproved && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-status-inspection/10 text-status-inspection border border-status-inspection/30">
              Passed to Operations
            </span>
          )}
          {job.status === "For Rework" && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-status-rework/10 text-status-rework border border-status-rework/30 flex items-center gap-1">
              <AlertTriangle size={11} />
              Rework Required
            </span>
          )}
        </div>

        {/* Delay summary */}
        {delayedStages.length > 0 && (
          <div className="bg-status-delayed/10 rounded-card p-4 flex gap-3 border border-status-delayed/30">
            <AlarmClock size={15} className="text-status-delayed mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-status-delayed mb-1.5">
                {delayedStages.length} Stage{delayedStages.length > 1 ? "s" : ""} Delayed
              </p>
              <ul className="space-y-1">
                {delayedStages.map((s) => (
                  <li key={s.id} className="text-xs text-status-delayed flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-status-delayed shrink-0" />
                    <span className="font-medium">{s.order}. {s.name}</span>
                    {s.expected_end_at && (
                      <span className="text-status-delayed truncate">
                        · was due {fmtDateTimeShort(s.expected_end_at)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Job info */}
        <div className="bg-surface rounded-card border border-border-subtle shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] divide-y divide-border-subtle">
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
              className={`w-full flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-card py-3.5 transition-all disabled:opacity-50 ${
                isInstaller ? "bg-border cursor-not-allowed" : "bg-primary hover:bg-primary-hover active:scale-[0.98]"
              }`}
            >
              {startingJob ? <Loader2 size={15} className="animate-spin" /> : isInstaller ? <Clock size={15} /> : <Play size={15} />}
              {startingJob ? "Starting…" : isInstaller ? "Waiting for Preparation" : "Start Job"}
            </button>
            {isInstaller && (
              <p className="text-[10px] text-muted text-center px-6">
                Only the Head Detailer can start the job. Please wait for preparation to begin.
              </p>
            )}
          </div>
        )}

        {/* Finishing passed notice */}
        {!isInstaller && finishingAlreadyApproved && (
          <div className="bg-status-inspection/10 rounded-card p-4 flex gap-3 border border-status-inspection/30">
            <ThumbsUp size={15} className="text-status-inspection mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-status-inspection mb-1">Passed to Operations</p>
              <p className="text-sm text-status-inspection leading-snug">All stages are complete and the job has been handed off to Operations.</p>
            </div>
          </div>
        )}

        {/* Locked stages notice */}
        {myGroups.some((g) => g.stages.some((s) => !s.is_unlocked)) && (
          <div className="bg-status-warning/10 rounded-card p-4 flex gap-3 border border-amber-100">
            <Clock size={15} className="text-status-warning mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-status-warning mb-1">Stages Pending</p>
              <p className="text-sm text-status-warning leading-snug">
                Some of your stages are locked until the other team completes and approves their preceding work.
              </p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {myUnlockedStages.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-body">
              <span>Progress</span>
              <span>{progressDone} / {myUnlockedStages.length} stages · {progress}%</span>
            </div>
            <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progress === 100 ? "bg-status-inspection" : progress >= 50 ? "bg-primary" : "bg-status-total"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Single unified section — renders all categories in correct sequence order */}
        {allCategoryGroups.map((g) => {
          const isMine        = g.role === myRole;
          const isApproved    = g.id in categoryHandoffs;
          const isLastOverall = g.id === lastGroup?.id;
          const allGroupDone  = g.stages.every((s) => s.status === "done");
          const precedingNotes = isMine ? getPrecedingHandoffNotes(g) : null;
          const doneStages    = g.stages.filter((s) => s.status === "done");

          // Other-role group: only show if it has done stages
          if (!isMine && doneStages.length === 0) return null;

          return (
            <div key={g.id} className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <CategoryBadge name={g.name} color={g.color} />
                {isMine && isLastOverall && isLastRole && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-status-concern/12 text-status-concern border border-status-concern/30">
                    Last stage before Operations Inspection
                  </span>
                )}
                {isMine && isApproved && !isLastOverall && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-status-inspection/12 text-status-inspection border border-emerald-200">
                    ✓ Handed off
                  </span>
                )}
                {!isMine && isApproved && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-status-inspection/12 text-status-inspection border border-emerald-200">
                    ✓ Handed off
                  </span>
                )}
              </div>

              {/* Handoff notes received from preceding other-role category (only for my groups) */}
              {isMine && precedingNotes && (
                <div className="bg-primary/10 rounded-card p-3 flex gap-2 border border-primary/20">
                  <Info size={13} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-primary mb-0.5">Handoff Notes</p>
                    <p className="text-xs text-primary leading-snug">{precedingNotes}</p>
                  </div>
                </div>
              )}

              {/* Stages — read-only for other role, interactive for mine */}
              {(isMine ? g.stages : doneStages).map((stage) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  readOnly={!isMine || isReadOnly(stage)}
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

              {/* Approve/rework panel — only for my groups */}
              {isMine && allGroupDone && !isApproved && !finishingAlreadyApproved && !isLastOverall && (
                <div className="pt-1">
                  {approvingCategoryId === g.id ? (
                    <div className="bg-surface rounded-card p-4 space-y-3 border border-status-inspection/30 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
                      <p className="text-sm font-semibold text-heading">Approve {g.name}</p>
                      <textarea
                        value={handoffNotes}
                        onChange={(e) => setHandoffNotes(e.target.value)}
                        placeholder="Optional handoff notes for the next team…"
                        rows={3}
                        className="w-full text-sm border border-border rounded-card px-3.5 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 bg-surface-subtle text-heading placeholder:text-muted transition"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setApprovingCategoryId(null); setHandoffNotes(""); }}
                          className="flex-1 text-sm font-semibold text-body border border-border rounded-card py-3 hover:bg-surface-muted transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleApprove(g.id)}
                          disabled={approving}
                          className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-status-inspection rounded-card py-3 hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-50"
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
                        className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-status-rework rounded-card py-3.5 hover:brightness-95 active:scale-[0.98] transition-all"
                      >
                        <AlertTriangle size={15} />
                        Flag for Rework
                      </button>
                      <button
                        onClick={() => { setApprovingCategoryId(g.id); setHandoffNotes(""); }}
                        className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-status-inspection rounded-card py-3.5 hover:brightness-95 active:scale-[0.98] transition-all"
                      >
                        <ThumbsUp size={15} />
                        Approve {g.name}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Approved banner */}
              {isMine && isApproved && !isLastOverall && (
                <div className="bg-status-inspection/10 border border-status-inspection/30 rounded-card p-3 flex items-start gap-2">
                  <ThumbsUp size={14} className="text-status-inspection mt-0.5 shrink-0" />
                  <p className="text-xs font-semibold text-status-inspection">
                    {g.name} approved — handed off to the next team.
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Pass to Operations — last category, all done */}
        {isLastRole && allJobStagesDone && !finishingAlreadyApproved && (
          <div className="pt-1">
            {approvingCategoryId === "__finishing__" ? (
              <div className="bg-surface rounded-card p-4 space-y-3 border border-status-inspection/30 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
                <p className="text-sm font-semibold text-heading">Pass to Operations</p>
                <p className="text-xs text-body">
                  All finishing stages are done. Passing to Operations will allow them to mark this job for release.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setApprovingCategoryId(null); setHandoffNotes(""); }}
                    className="flex-1 text-sm font-semibold text-body border border-border rounded-card py-3 hover:bg-surface-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApprove(lastGroup?.id ?? "__finishing__")}
                    disabled={approving}
                    className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-status-inspection rounded-card py-3 hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-50"
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
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-status-rework rounded-card py-3.5 hover:brightness-95 active:scale-[0.98] transition-all"
                >
                  <AlertTriangle size={15} />
                  Flag for Rework
                </button>
                <button
                  onClick={() => setApprovingCategoryId("__finishing__")}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-status-inspection rounded-card py-3.5 hover:brightness-95 active:scale-[0.98] transition-all"
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

      <MediaPreviewModal media={preview} onClose={() => setPreview(null)} />

      <Modal open={rejectionAlert !== null} onClose={() => setRejectionAlert(null)} size="sm" bare>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-status-delayed/12 text-status-delayed">
            <AlertTriangle size={20} />
          </span>
          <h2 className="text-base font-semibold text-heading">Image Not Accepted</h2>
          <p className="text-sm text-body">{rejectionAlert?.message ?? "Please retake your photo."}</p>
        </div>
        <div className="mt-4">
          <Button fullWidth onClick={() => setRejectionAlert(null)}>
            OK, Retake Photo
          </Button>
        </div>
      </Modal>

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
    <Modal
      open
      onClose={onClose}
      title={title}
      description="Select the stage that needs to be redone. It will be reverted to In Progress with your instructions."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onSubmit}
            disabled={submitting || !selected || !note.trim()}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            {submitting ? "Flagging…" : "Flag for Rework"}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex max-h-48 flex-col gap-1 overflow-y-auto">
        {stages.map((s) => (
          <label
            key={s.id}
            className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 hover:bg-surface-muted"
          >
            <input
              type="radio"
              name="rework-stage"
              checked={selected === s.id}
              onChange={() => onSelect(s.id)}
              className="h-4 w-4 accent-[var(--color-status-rework)]"
            />
            <span className="flex-1 text-sm text-body">
              {s.order}. {s.name}
            </span>
          </label>
        ))}
        {stages.length === 0 && (
          <p className="py-4 text-center text-xs text-muted">No completed stages to flag.</p>
        )}
      </div>

      <FieldLabel>
        Instructions <span className="text-status-delayed">*</span>
      </FieldLabel>
      <Textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Describe what needs to be redone…"
        rows={3}
      />
      {error && <p className="mt-2 text-xs text-status-delayed">{error}</p>}
    </Modal>
  );
}

// ── CategoryBadge ─────────────────────────────────────────────────────────────

function CategoryBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className={`inline-block rounded-pill px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${categorySwatch(color).badge}`}
    >
      {name}
    </span>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted uppercase tracking-widest px-0.5">
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
    <div className={`bg-surface rounded-card border transition-colors duration-150 ${
      done   ? "border-status-inspection/30" :
      rework ? "border-status-rework/30 bg-status-rework/10" :
               "border-border-subtle"
    } shadow-[0_1px_4px_-2px_rgba(0,0,0,0.04)]`}>

      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 shrink-0">
          {done   ? <CheckCircle2 size={18} className="text-status-inspection" /> :
           rework ? <RefreshCw    size={18} className="text-status-rework" /> :
                    <Circle       size={18} className="text-muted" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`text-sm font-semibold leading-snug ${
              done ? "text-muted line-through decoration-gray-300" :
              rework ? "text-status-rework" :
              "text-heading"
            }`}>
              {stage.order}. {stage.name}
            </p>
            {!done && stage.is_delayed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-status-delayed/12 text-status-delayed font-medium">Delayed</span>
            )}
          </div>
          {!done && (stage.expected_end_at || stage.stage_duration_mins > 0) && (
            <p className={`flex items-center gap-1 text-[11px] mt-0.5 ${stage.is_delayed ? "text-status-delayed" : "text-muted"}`}>
              <Clock size={10} />
              {stage.expected_end_at && (
                <span>Due by {fmtDateTimeShort(stage.expected_end_at)}</span>
              )}
              {stage.expected_end_at && stage.stage_duration_mins > 0 && <span className="text-muted">·</span>}
              {stage.stage_duration_mins > 0 && <span>{fmtDuration(stage.stage_duration_mins)}</span>}
            </p>
          )}
          {stage.completed_at && (
            <p className="text-[11px] text-status-inspection font-medium mt-0.5">✓ Done {stage.completed_at}</p>
          )}
          {done && stage.completion_notes && (
            <p className="text-[11px] text-body mt-1 leading-snug italic">{stage.completion_notes}</p>
          )}
          {readOnly && !done && (
            <p className="text-[11px] text-muted capitalize mt-0.5">{stage.status.replace("_", " ")}</p>
          )}
        </div>
      </div>

      {(rework || (!done && stage.rework_instructions)) && stage.rework_instructions && (
        <div className="mx-4 mb-3 flex gap-2 bg-status-rework/12 rounded-card px-3 py-2.5">
          <AlertTriangle size={13} className="text-status-rework mt-0.5 shrink-0" />
          <p className="text-xs text-status-rework leading-snug">
            <span className="font-semibold">Rework: </span>{stage.rework_instructions}
          </p>
        </div>
      )}

      {stage.media.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {stage.media.map((m) => (
            <div key={m.id} className="relative w-16 h-16">
              <button className="w-16 h-16 rounded-card overflow-hidden block focus:outline-none" onClick={() => !m.pending && onPreview(m.url, m.type)}>
                {m.type === "video" ? (
                  <div className="w-full h-full bg-surface-muted flex items-center justify-center text-body"><Play size={20} /></div>
                ) : (
                  <img src={m.url} alt="" className="w-full h-full object-cover bg-surface-muted" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                )}
              </button>
              {m.pending && (
                <div className="absolute inset-0 rounded-card bg-shell/50 flex items-center justify-center pointer-events-none">
                  <Loader2 size={16} className="text-white animate-spin" />
                </div>
              )}
              {!m.pending && !readOnly && !done && (
                <button onClick={() => onRemoveMedia(m.id)} disabled={removingId === m.id} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
                  {removingId === m.id ? <Loader2 size={9} className="text-white animate-spin" /> : <X size={9} className="text-white" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {uploadError && <p className="text-[11px] text-status-delayed px-4 pb-3">{uploadError}</p>}

      {!readOnly && (
        <div className="px-4 pb-4 space-y-2">
          {!done && !rework && stage.media.length === 0 && (
            <p className="text-[11px] text-muted">Upload a photo or video before marking done.</p>
          )}
          {rework && <p className="text-[11px] text-status-rework">Stage flagged for rework — mark done again to confirm.</p>}
          {!done && (
            <textarea
              value={notes}
              onChange={rework ? undefined : (e) => setNotes(e.target.value)}
              readOnly={rework}
              placeholder="Add completion notes… (required)"
              rows={2}
              className={`w-full text-xs border rounded-card px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 placeholder:text-muted transition ${
                rework
                  ? "opacity-40 cursor-not-allowed bg-surface-muted border-border text-body"
                  : "bg-surface-subtle border-border text-heading focus:ring-gray-200"
              }`}
            />
          )}
          <div className="flex items-center gap-2">
            <label className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border rounded-card py-2.5 transition-colors ${
              isUploading || photoFull || done || rework
                ? "opacity-40 pointer-events-none text-muted border-border bg-surface-subtle"
                : "text-body border-border hover:bg-surface-muted cursor-pointer bg-surface"
            }`}>
              <ImagePlus size={13} />
              Photo {photoCount > 0 && `(${photoCount}/5)`}
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={isUploading || photoFull || done || rework} onChange={(e) => onFileChange(e.target.files)} />
            </label>

            <label className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border rounded-card py-2.5 transition-colors ${
              isUploading || videoFull || done || rework
                ? "opacity-40 pointer-events-none text-muted border-border bg-surface-subtle"
                : "text-body border-border hover:bg-surface-muted cursor-pointer bg-surface"
            }`}>
              <Video size={13} />
              Video {videoFull ? "(1/1)" : ""}
              <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => onFileChange(e.target.files)} disabled={done || rework} />
            </label>

            {!done && (
              <button
                onClick={() => onMarkDone(rework ? (stage.completion_notes ?? "Rework confirmed") : notes)}
                disabled={isMarking || isUploading || (!rework && (stage.media.length === 0 || !notes.trim()))}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-primary rounded-card py-2.5 hover:bg-shell-alt active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
      <span className="text-xs font-medium text-muted shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-right ${accent === "orange" ? "text-status-rework" : "text-heading"}`}>{value}</span>
    </div>
  );
}

// ── CrewRow ───────────────────────────────────────────────────────────────────

function CrewRow({ label, members }: { label: string; members: string[] }) {
  const [open, setOpen] = useState(false);
  const collapsible = members.length >= 2;
  return (
    <div className="flex justify-between items-start gap-4 px-4 py-3">
      <span className="text-xs font-medium text-muted shrink-0">{label}</span>
      <div className="text-right">
        {collapsible ? (
          <>
            <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-sm font-semibold text-heading ml-auto">
              <Users size={12} className="text-muted" />
              {members.length} members
              <ChevronDown size={12} className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
            {open && <ul className="mt-1 space-y-0.5">{members.map((name, i) => <li key={i} className="text-xs text-body">{name}</li>)}</ul>}
          </>
        ) : (
          <span className="text-sm font-semibold text-heading">{members[0]}</span>
        )}
      </div>
    </div>
  );
}
