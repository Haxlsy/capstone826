// Shared photo/video upload limits — kept in one place so the client-side
// checks (instant feedback) and the server-side enforcement (source of truth)
// can't drift apart.

export const MAX_PHOTO_MB = 5
export const MAX_VIDEO_MB = 20

export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024

/** Per stage-media "round" — round 0 is the initial upload, each rework flag
 *  starts a fresh round with its own allowance. See stage_media.rework_round. */
export const MAX_PHOTOS_PER_ROUND = 5
export const MAX_VIDEOS_PER_ROUND = 1

/** Recording auto-stops at this length — enforced live by VideoRecorderModal. */
export const MAX_RECORDING_SECONDS = 60
