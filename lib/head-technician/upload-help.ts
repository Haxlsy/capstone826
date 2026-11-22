// What a good photo and video look like, shown as tips on the head
// technician's upload buttons (job stages and concerns) and in the "How to
// document this stage" guide. One place, so both pages say the same thing,
// and every number comes from lib/media/limits.ts.

import {
  MAX_PHOTOS_PER_ROUND,
  MAX_VIDEOS_PER_ROUND,
  MAX_RECORDING_SECONDS,
  MIN_VIDEO_SECONDS,
  MAX_UPLOAD_REQUEST_BYTES,
} from "@/lib/media/limits"

const UPLOAD_MB = MAX_UPLOAD_REQUEST_BYTES / (1024 * 1024)

export interface UploadTip {
  title: string
  points: string[]
}

export const PHOTO_TIP: UploadTip = {
  title: "Taking a good photo",
  points: [
    "Use good light: avoid dark corners and strong glare.",
    "Fit the whole work area in the frame, and show the car.",
    "Hold the phone steady so the photo isn't blurry.",
    `Up to ${MAX_PHOTOS_PER_ROUND} photos per stage, ${UPLOAD_MB} MB each (large photos are shrunk for you).`,
  ],
}

export const VIDEO_TIP: UploadTip = {
  title: "Recording a good video",
  points: [
    `Record ${MIN_VIDEO_SECONDS} to ${MAX_RECORDING_SECONDS} seconds. Stop unlocks after ${MIN_VIDEO_SECONDS} seconds.`,
    "Move slowly over the finished area so every part is seen.",
    "Keep the car in view the whole time.",
    `${MAX_VIDEOS_PER_ROUND} video per stage. Sound is removed automatically.`,
  ],
}

export const ATTACH_TIP: UploadTip = {
  title: "Attaching a file",
  points: [
    "Pick a photo or video already on your phone.",
    `Videos must be at least ${MIN_VIDEO_SECONDS} seconds long.`,
    `Each file can be up to ${UPLOAD_MB} MB.`,
  ],
}

/** The steps to finish a stage, in order. */
export const STAGE_GUIDE_STEPS: string[] = [
  "Finish the work for the stage first.",
  `Take photos of the finished work (at least 1, up to ${MAX_PHOTOS_PER_ROUND}).`,
  `Record one video, ${MIN_VIDEO_SECONDS} to ${MAX_RECORDING_SECONDS} seconds, slowly showing the finished area.`,
  "Write short completion notes, then tap Done.",
]

/** Each upload is checked automatically; this sets expectations. */
export const STAGE_GUIDE_NOTE =
  "Photos and videos are checked automatically. If one isn't accepted, the message tells you why: just retake it."
