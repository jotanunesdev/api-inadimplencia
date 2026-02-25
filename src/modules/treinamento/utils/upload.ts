import fs from "fs"
import os from "os"
import path from "path"
import multer from "multer"
import { env } from "../config/env"

const tmpDir = path.join(os.tmpdir(), "gestao-treinamento-uploads")
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true })
}

const maxFileSizeBytes = env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024

export const upload = multer({
  dest: tmpDir,
  limits: {
    fileSize: maxFileSizeBytes,
  },
})
