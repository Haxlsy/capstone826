import os from "os"
import path from "path"
import crypto from "crypto"
import fs from "fs/promises"
import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

async function withTempInput<T>(
  videoBuffer: Buffer,
  run: (inputPath: string, outputPath: string) => Promise<T>,
  outputExt: string
): Promise<T> {
  const base = path.join(os.tmpdir(), `vid-${crypto.randomUUID()}`)
  const inputPath = `${base}.mp4`
  const outputPath = `${base}-out.${outputExt}`
  try {
    await fs.writeFile(inputPath, videoBuffer)
    return await run(inputPath, outputPath)
  } finally {
    await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)])
  }
}

/**
 * Grabs one representative frame (~1s in, to avoid a black leading frame) from
 * a video buffer, returned as a JPEG buffer — used to run the existing
 * Gemini image-validation pipeline against a video upload without having to
 * analyze the whole clip.
 */
export async function extractVideoFrame(videoBuffer: Buffer): Promise<Buffer> {
  return withTempInput(
    videoBuffer,
    (inputPath, outputPath) =>
      new Promise<Buffer>((resolve, reject) => {
        // Seek + single-frame output rather than `.screenshots()` — the
        // latter shells out to ffprobe to read duration, and ffmpeg-static
        // only bundles the ffmpeg binary, not ffprobe.
        ffmpeg(inputPath)
          .seekInput(1)
          .outputOptions(["-frames:v 1"])
          .on("end", async () => {
            try {
              resolve(await fs.readFile(outputPath))
            } catch (err) {
              reject(err)
            }
          })
          .on("error", reject)
          .save(outputPath)
      }),
    "jpg"
  )
}

/**
 * Up to `n` items spread evenly from first to last (always includes both ends
 * when n >= 2). Returns everything when there are n or fewer items.
 */
export function pickEvenly<T>(items: readonly T[], n: number): T[] {
  if (n <= 0) return []
  if (items.length <= n) return [...items]
  if (n === 1) return [items[Math.floor(items.length / 2)]]
  const step = (items.length - 1) / (n - 1)
  return Array.from({ length: n }, (_, i) => items[Math.round(i * step)])
}

/**
 * Samples frames from across the WHOLE video (not just one moment), as small
 * JPEG buffers in playback order — so a clip that shows a car for a second and
 * then something else can't pass on that one second.
 *
 * Fast path: decode KEYFRAMES ONLY (`-skip_frame nokey`). Phone recordings
 * have one every second or two, so this still covers the whole clip while
 * skipping the expensive decoding of every in-between frame — the bulk of the
 * time on a small server, especially for iPhone (HEVC) video.
 *
 * Fallback: when a recording has too few keyframes (some in-browser
 * recordings have only the first), decode one frame per second instead
 * (`fps=1`). Neither path needs duration metadata, and both work for clips
 * under a second. Keeps up to `max` evenly spaced frames, in playback order.
 * Throws when no frame could be read.
 */
export async function extractVideoFrames(videoBuffer: Buffer, max = 4): Promise<Buffer[]> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vidframes-"))
  const inputPath = path.join(dir, "input.mp4")
  const started = Date.now()
  try {
    await fs.writeFile(inputPath, videoBuffer)

    const run = (prefix: string, inputOptions: string[], outputOptions: string[]) =>
      new Promise<string[]>((resolve, reject) => {
        ffmpeg(inputPath)
          .inputOptions(inputOptions)
          .outputOptions(outputOptions)
          .on("end", async () => {
            try {
              resolve((await fs.readdir(dir)).filter((f) => f.startsWith(prefix)).sort())
            } catch (err) {
              reject(err)
            }
          })
          .on("error", reject)
          .save(path.join(dir, `${prefix}%03d.jpg`))
      })

    let names = await run("key-", ["-skip_frame nokey"], ["-vf scale=480:-2", "-vsync vfr", "-frames:v 120"])
    let mode = "keyframes"
    if (names.length < Math.min(2, max)) {
      const perSecond = await run("sec-", [], ["-vf fps=1,scale=480:-2", "-frames:v 120"])
      if (perSecond.length > names.length) {
        names = perSecond
        mode = "1 per second"
      }
    }
    if (names.length === 0) throw new Error("No frames could be read from the video.")
    const frames = await Promise.all(pickEvenly(names, max).map((f) => fs.readFile(path.join(dir, f))))
    console.info(`[media-validation] read ${frames.length}/${names.length} video frames (${mode}) in ${Date.now() - started} ms`)
    return frames
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Strips the audio track from a video buffer, returning a muted video buffer.
 * The video stream is copied as-is (`-c:v copy -an`) — no re-encode, so this
 * is fast and lossless for the picture.
 */
export async function stripAudio(videoBuffer: Buffer): Promise<Buffer> {
  return withTempInput(
    videoBuffer,
    (inputPath, outputPath) =>
      new Promise<Buffer>((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions(["-c:v copy", "-an"])
          .on("end", async () => {
            try {
              resolve(await fs.readFile(outputPath))
            } catch (err) {
              reject(err)
            }
          })
          .on("error", reject)
          .save(outputPath)
      }),
    "mp4"
  )
}
