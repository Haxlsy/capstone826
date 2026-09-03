import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Compose class names with conditional support + Tailwind conflict resolution.
 * The single class helper for the whole UI system.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
