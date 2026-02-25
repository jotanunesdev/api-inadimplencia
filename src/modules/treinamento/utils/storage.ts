import fs from "fs/promises"
import path from "path"
import { env } from "../config/env"

const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1F]/g
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export function sanitizeSegment(value: string) {
  let clean = value.replace(INVALID_CHARS, "_").replace(/\s+/g, " ").trim()
  clean = clean.replace(/[. ]+$/, "")

  if (!clean) {
    clean = "sem-nome"
  }

  if (RESERVED_NAMES.test(clean)) {
    clean = `${clean}_`
  }

  return clean
}

export function buildModuleRelativePath(nome: string) {
  return sanitizeSegment(nome)
}

export function buildTrilhaRelativePath(modulePath: string, titulo: string) {
  return [modulePath, sanitizeSegment(titulo)].filter(Boolean).join("/")
}

export function buildChannelRelativePath(nome: string) {
  return ["canais", sanitizeSegment(nome)].filter(Boolean).join("/")
}

export function buildProcedureRelativePath() {
  return ["procedimentos"].join("/")
}

export function buildNormaRelativePath() {
  return ["normas"].join("/")
}

export function toFsPath(relativePath: string) {
  if (!relativePath) {
    return env.PUBLIC_ASSETS_ROOT
  }
  const normalized = relativePath.replace(/\\/g, "/")
  return path.join(env.PUBLIC_ASSETS_ROOT, ...normalized.split("/"))
}

export async function ensurePublicDir(relativePath: string) {
  const fsPath = toFsPath(relativePath)
  await fs.mkdir(fsPath, { recursive: true })
  return fsPath
}

async function pathExists(fsPath: string) {
  try {
    await fs.stat(fsPath)
    return true
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === "ENOENT") {
      return false
    }
    throw err
  }
}

export function buildStoredFileName(originalName: string, prefix: string) {
  const safeOriginal = originalName.trim() || prefix
  const ext = path.extname(safeOriginal)
  const base = path.basename(safeOriginal, ext)
  const safeBase = sanitizeSegment(base).replace(/\s+/g, "-") || prefix
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  return `${safeBase}-${stamp}${ext.toLowerCase()}`
}

export async function moveFile(srcPath: string, destPath: string) {
  await fs.mkdir(path.dirname(destPath), { recursive: true })
  try {
    await fs.rename(srcPath, destPath)
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== "EXDEV") {
      throw err
    }
    await fs.copyFile(srcPath, destPath)
    await fs.unlink(srcPath)
  }
}

export async function renameDirectory(
  oldRelativePath: string,
  newRelativePath: string,
) {
  if (!oldRelativePath || !newRelativePath) {
    return
  }

  const oldFsPath = toFsPath(oldRelativePath)
  const newFsPath = toFsPath(newRelativePath)
  if (oldFsPath === newFsPath) {
    return
  }

  const oldExists = await pathExists(oldFsPath)
  const newExists = await pathExists(newFsPath)

  if (newExists && oldExists) {
    throw new Error("Destino ja existe para a pasta renomeada")
  }

  if (!oldExists) {
    await fs.mkdir(newFsPath, { recursive: true })
    return
  }

  await fs.mkdir(path.dirname(newFsPath), { recursive: true })
  try {
    await fs.rename(oldFsPath, newFsPath)
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== "EXDEV") {
      throw err
    }
    await fs.cp(oldFsPath, newFsPath, { recursive: true })
    await fs.rm(oldFsPath, { recursive: true, force: true })
  }
}
