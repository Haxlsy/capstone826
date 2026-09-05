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
