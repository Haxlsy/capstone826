// Browser-only: how long a picked or recorded video is, read from its
// metadata, so a clip under MIN_VIDEO_SECONDS can be refused the moment it's
// picked instead of after the upload. Null when the browser can't tell
// (some in-browser WebM recordings report Infinity) or the file won't load;
// the upload routes measure those on the server.

export function readVideoDuration(file: Blob, timeoutMs = 5000): Promise<number | null> {
  if (typeof document === "undefined") return Promise.resolve(null)
  return new Promise((resolve) => {
    const video = document.createElement("video")
    const url = URL.createObjectURL(file)
    let settled = false
    const finish = (value: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.removeAttribute("src")
      video.load()
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    video.preload = "metadata"
    video.muted = true
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? video.duration : null)
    video.onerror = () => finish(null)
    video.src = url
  })
}
