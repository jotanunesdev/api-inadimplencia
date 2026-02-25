import { spawn } from "child_process"
import ffprobeStatic from "ffprobe-static"

export async function getVideoDurationSeconds(
  filePath: string,
): Promise<number | null> {
  const ffprobePath = ffprobeStatic.path

  return new Promise((resolve) => {
    const args = [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nokey=1:noprint_wrappers=1",
      filePath,
    ]

    const proc = spawn(ffprobePath, args, { windowsHide: true })
    let stdout = ""

    proc.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    proc.on("error", () => resolve(null))

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve(null)
        return
      }

      const value = Number.parseFloat(stdout.trim())
      if (!Number.isFinite(value) || value <= 0) {
        resolve(null)
        return
      }

      resolve(Math.round(value))
    })
  })
}
