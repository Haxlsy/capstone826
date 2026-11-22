"use client";

import { useSyncExternalStore } from "react";
import { Info, ChevronDown, Lightbulb } from "lucide-react";
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

export function UploadGuide() {
  // Server render and first paint: open (the default for a first-time head).
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  return (
    <div className="rounded-card border border-primary/20 bg-primary/5">
      <button
        type="button"
        onClick={() => writeCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <Lightbulb size={14} className="shrink-0 text-primary" />
        <span className="flex-1 text-xs font-semibold text-primary">How to document this stage</span>
        <ChevronDown size={14} className={`text-primary transition-transform ${collapsed ? "" : "rotate-180"}`} />
      </button>
      {!collapsed && (
        <div className="space-y-2 px-3.5 pb-3">
          <ol className="space-y-1.5">
            {STAGE_GUIDE_STEPS.map((step, i) => (
              <li key={step} className="flex gap-2 text-xs leading-snug text-body">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="text-[11px] leading-snug text-muted">
            {STAGE_GUIDE_NOTE} Tap the <Info size={11} className="inline -mt-0.5" /> next to Photo or Video for tips.
          </p>
        </div>
      )}
    </div>
  );
}
