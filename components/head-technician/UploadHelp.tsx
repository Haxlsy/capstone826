"use client";

import { useSyncExternalStore } from "react";
import { Info, ChevronDown, BookOpen, Wrench, Camera, Video, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { STAGE_GUIDE_STEPS, STAGE_GUIDE_NOTE, type UploadTip as Tip } from "@/lib/head-technician/upload-help";

/**
 * A small (i) beside an upload button that opens a tip on TAP, not hover:
 * head technicians use phones, where a hover tooltip (`title`) never shows.
 * Sits outside the button so tapping it never opens the camera or picker.
 */
export function UploadTip({ tip, label }: { tip: Tip; label: string }) {
  return (
    <Popover
      align="end"
      panelClassName="w-72 p-3"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Tips: ${label}`}
          aria-expanded={open}
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
            open ? "bg-primary/15 text-primary" : "text-muted hover:text-body hover:bg-surface-muted"
          }`}
        >
          <Info size={14} />
        </button>
      )}
    >
      <p className="mb-1.5 text-xs font-semibold text-heading">{tip.title}</p>
      <ul className="space-y-1">
        {tip.points.map((p) => (
          <li key={p} className="flex gap-1.5 text-xs leading-snug text-body">
            <span aria-hidden="true" className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-muted" />
            {p}
          </li>
        ))}
      </ul>
    </Popover>
  );
}

// ── "How to document this stage" guide ──────────────────────────────────────
// Open until the head collapses it once; then it stays collapsed on this
// device. Kept in localStorage through a tiny external store (the same
// pattern as hooks/useMediaQuery), and every storage call is guarded: a
// private window or blocked storage just means it shows open.

const GUIDE_KEY = "826:upload-guide-collapsed";
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(GUIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    if (collapsed) window.localStorage.setItem(GUIDE_KEY, "1");
    else window.localStorage.removeItem(GUIDE_KEY);
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => { if (e.key === GUIDE_KEY) listener(); };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const STEP_ICONS = [Wrench, Camera, Video, ClipboardCheck];

export function UploadGuide() {
  // Server render and first paint: open (the default for a first-time head).
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  return (
    <section
      aria-label="How to document this stage"
      className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]"
    >
      <button
        type="button"
        onClick={() => writeCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls="upload-guide-steps"
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <BookOpen size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-heading">How to document this stage</span>
          <span className="block text-[11px] text-muted">
            {STAGE_GUIDE_STEPS.length} steps{collapsed ? " · tap to show" : " · photos, video and notes"}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
        />
      </button>

      {!collapsed && (
        <div id="upload-guide-steps" className="border-t border-border-subtle px-4 pb-4 pt-3">
          <ol className="relative">
            {STAGE_GUIDE_STEPS.map((step, i) => {
              const Icon = STEP_ICONS[i] ?? ClipboardCheck;
              const last = i === STAGE_GUIDE_STEPS.length - 1;
              return (
                <li key={step.title} className="relative flex gap-3 pb-3 last:pb-0">
                  {/* Connector between steps */}
                  {!last && <span aria-hidden="true" className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />}
                  <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-body">
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs font-semibold text-heading">
                      <span className="mr-1 text-muted">{i + 1}.</span>
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-muted">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-3 flex gap-2 rounded-sm bg-surface-subtle px-3 py-2.5">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-status-inspection" aria-hidden="true" />
            <p className="text-[11px] leading-snug text-body">
              {STAGE_GUIDE_NOTE} For tips, tap{" "}
              <Info size={11} className="inline -mt-0.5 text-muted" aria-label="the info icon" /> beside Photo or Video.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
