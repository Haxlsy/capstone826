"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { startIdleTimer, type IdleTimer } from "@/lib/idle-timer"
import { useLogout } from "@/hooks/useLogout"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"

const IDLE_MS = 20 * 60_000
const WARNING_MS = 60_000
const WARNING_SECONDS = Math.round(WARNING_MS / 1000)

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "wheel"] as const

/**
 * Signs a still-open, unattended screen out after 20 minutes of no genuine
 * interaction, with a 60-second warning first. This is on top of — not a
 * replacement for — the 8-hour server-enforced session cap (app/api/auth/
 * login/route.ts): that caps how long a login can last at all, this is about
 * a screen nobody's actually in front of anymore.
 *
 * Only real interaction resets the clock (mouse/keyboard/touch/scroll) —
 * background fetches/realtime traffic never count, since the question is
 * "is anyone physically here," not "is the tab doing something."
 */
export function useIdleTimeout() {
  const [warning, setWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(WARNING_SECONDS)

  // Refs mirroring state that event listeners/callbacks (registered once,
  // outside React's render cycle) need to read without a stale closure.
  const warningRef = useRef(false)
  const timerRef = useRef<IdleTimer | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isOnline = useOnlineStatus()
  const isOnlineRef = useRef(isOnline)
  const pendingLogoutRef = useRef(false)

  const logout = useLogout({ hard: true, reason: "idle_timeout" })
  const logoutRef = useRef(logout)
  useEffect(() => {
    isOnlineRef.current = isOnline
    logoutRef.current = logout
  })

  const clearTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null
  }, [])

  const showWarning = useCallback(() => {
    warningRef.current = true
    setWarning(true)
    setRemainingSeconds(WARNING_SECONDS)
    clearTick()
    tickRef.current = setInterval(() => setRemainingSeconds((s) => Math.max(0, s - 1)), 1000)
  }, [clearTick])

  const doLogout = useCallback(() => {
    warningRef.current = false
    setWarning(false)
    clearTick()
    if (!isOnlineRef.current) {
      // A hard redirect while offline would strand an in-progress offline
      // flow (Operations' queued job orders/concerns) — defer until back
      // online instead of forcing it now.
      pendingLogoutRef.current = true
      return
    }
    logoutRef.current()
  }, [clearTick])

  useEffect(() => {
    const timer = startIdleTimer(
      { setTimeout, clearTimeout },
      { idleMs: IDLE_MS, warningMs: WARNING_MS, onWarn: showWarning, onTimeout: doLogout },
    )
    timerRef.current = timer

    const onActivity = () => {
      // Deliberate: once the warning is up, ambient activity is ignored —
      // only the explicit "Stay signed in" button (stayLoggedIn) extends it,
      // so a stray mouse jiggle can't silently cancel a warning meant for
      // someone who's actually away.
      if (warningRef.current) return
      timer.reset()
    }
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, onActivity, { passive: true })

    return () => {
      timer.stop()
      timerRef.current = null
      clearTick()
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity)
    }
  }, [showWarning, doLogout, clearTick])

  // Coming back online while a warning-triggered logout was deferred —
  // finish it now.
  useEffect(() => {
    if (isOnline && pendingLogoutRef.current) {
      pendingLogoutRef.current = false
      logoutRef.current()
    }
  }, [isOnline])

  const stayLoggedIn = useCallback(() => {
    warningRef.current = false
    setWarning(false)
    clearTick()
    timerRef.current?.reset()
  }, [clearTick])

  return { warning, remainingSeconds, stayLoggedIn }
}
