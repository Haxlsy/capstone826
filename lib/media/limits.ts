// Shared photo/video upload limits — kept in one place so the client-side
// checks (instant feedback) and the server-side enforcement (source of truth)
// can't drift apart.

export const MAX_PHOTO_MB = 5
export const MAX_VIDEO_MB = 20

export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024

/** Recording auto-stops at this length — enforced live by VideoRecorderModal. */
export const MAX_RECORDING_SECONDS = 60
