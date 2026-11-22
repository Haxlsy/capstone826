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

/**
 * The shortest video accepted as work evidence (panel recommendation): a clip
 * of a second or two shows nothing and gives the AI check too little footage.
 * The recorder can't stop before this, the file picker refuses shorter clips,
 * and the upload routes check it again on the server.
 */
export const MIN_VIDEO_SECONDS = 5

/** Allowance for the recorder starting a moment after its timer, so a clip
 *  stopped right at 0:05 is never refused for measuring 4.9 seconds. */
const MIN_VIDEO_TOLERANCE_SECONDS = 0.5

/**
 * Why a video is too short, as a message for the person, or null when it is
 * long enough. An unknown length (null, NaN, Infinity: some browser
 * recordings carry no duration) is NOT a problem here; the server measures
 * those itself.
 */
export function videoDurationProblem(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null
  if (seconds >= MIN_VIDEO_SECONDS - MIN_VIDEO_TOLERANCE_SECONDS) return null
  return `This video is only ${Math.max(0, Math.round(seconds))} second${Math.round(seconds) === 1 ? "" : "s"} long. Please record at least ${MIN_VIDEO_SECONDS} seconds.`
}

/**
 * The largest file the browser may send to an upload route. Uploads pass
 * through a server function, and the host (Vercel) rejects any request over
 * 4.5 MB before our code runs, with a reply that is not JSON. 4 MB leaves
 * room for the rest of the multipart request.
 */
export const MAX_UPLOAD_REQUEST_BYTES = 4 * 1024 * 1024

/**
 * Why a file cannot be uploaded, as a message for the person, or null when
 * it is fine. Checked when the file is picked, so an oversize file is refused
 * at once instead of failing after the form is submitted.
 */
export function uploadSizeProblem(file: { size: number; type: string }): string | null {
  if (file.size <= MAX_UPLOAD_REQUEST_BYTES) return null
  const mb = (file.size / (1024 * 1024)).toFixed(1)
  const limit = MAX_UPLOAD_REQUEST_BYTES / (1024 * 1024)
  return file.type.startsWith("video/")
    ? `This video is ${mb} MB, over the ${limit} MB upload limit. Record a shorter clip with the Video button.`
    : `This photo is ${mb} MB, over the ${limit} MB upload limit. Please retake it.`
}
