import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { normalizeCpf } from "../utils/normalizeCpf"
import { mapReadViewToUser } from "../utils/userMapping"
import { upsertUser } from "../models/userModel"
import {
  createUserFace,
  getLatestUserFaceByCpf,
  listFaceDescriptorsForMatch,
  listUserFaces,
} from "../models/userFaceModel"
import {
  deleteSharePointFileByUrl,
  ensureSharePointFolder,
  isSharePointEnabled,
  uploadBase64ToSharePoint,
} from "../services/sharePointService"

const DESCRIPTOR_SIZE = 128
const DEFAULT_MATCH_THRESHOLD = 0.5
const DEFAULT_TOP_CANDIDATES = 5

function parseDescriptor(raw: unknown) {
  if (!Array.isArray(raw)) {
    throw new HttpError(400, "descriptor deve ser um array")
  }

  if (raw.length !== DESCRIPTOR_SIZE) {
    throw new HttpError(400, `descriptor deve conter ${DESCRIPTOR_SIZE} posicoes`)
  }

  const descriptor = raw.map((value) => Number(value))
  if (descriptor.some((value) => !Number.isFinite(value))) {
    throw new HttpError(400, "descriptor contem valores invalidos")
  }

  return descriptor
}

function parseOptionalPhoto(raw: unknown) {
  if (raw === undefined || raw === null) return null
  const value = String(raw).trim()
  if (!value) return null
  return value
}

function parseOptionalUserRecord(raw: unknown) {
  if (!raw || typeof raw !== "object") return null
  const record: Record<string, string> = {}

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || value === undefined) continue
    if (typeof value === "object") continue
    const normalized = String(value).trim()
    if (!normalized) continue
    record[key] = normalized
  }

  return Object.keys(record).length ? record : null
}

function euclideanDistance(a: number[], b: number[]) {
  let sum = 0
  for (let index = 0; index < a.length; index += 1) {
    const delta = a[index] - b[index]
    sum += delta * delta
  }
  return Math.sqrt(sum)
}

export const listFaces = asyncHandler(async (req: Request, res: Response) => {
  const queryCpf = (req.query as { cpf?: string }).cpf
  const paramsCpf = (req.params as { cpf?: string }).cpf
  const rawCpf = queryCpf ?? paramsCpf
  const cpf = rawCpf ? normalizeCpf(rawCpf) : undefined

  if (rawCpf && (!cpf || cpf.length !== 11)) {
    throw new HttpError(400, "CPF invalido")
  }

  const faces = await listUserFaces(cpf)
  res.json({
    faces: faces.map((face) => ({
      ID: face.ID,
      USUARIO_CPF: face.USUARIO_CPF,
      USUARIO_NOME: face.USUARIO_NOME,
      FOTO_BASE64: face.FOTO_BASE64,
      FOTO_URL: face.FOTO_URL,
      ORIGEM: face.ORIGEM,
      CRIADO_POR: face.CRIADO_POR,
      CRIADO_EM: face.CRIADO_EM,
    })),
  })
})

export const enrollFace = asyncHandler(async (req: Request, res: Response) => {
  const {
    cpf,
    descriptor,
    fotoBase64,
    origem,
    criadoPor,
    user,
  } = req.body as {
    cpf?: string
    descriptor?: unknown
    fotoBase64?: unknown
    origem?: unknown
    criadoPor?: unknown
    user?: unknown
  }

  const cpfDigits = normalizeCpf(cpf ?? "")
  if (cpfDigits.length !== 11) {
    throw new HttpError(400, "CPF invalido")
  }

  const parsedDescriptor = parseDescriptor(descriptor)
  const parsedPhoto = parseOptionalPhoto(fotoBase64)
  const parsedOrigin = origem !== undefined ? String(origem).trim() : undefined
  const parsedCreatedBy =
    criadoPor !== undefined ? String(criadoPor).trim() : undefined

  const rawUser = parseOptionalUserRecord(user)
  if (rawUser) {
    rawUser.CPF = cpfDigits
    const mapped = mapReadViewToUser(rawUser)
    await upsertUser(mapped)
  } else {
    await upsertUser({ cpf: cpfDigits, ativo: true })
  }

  const previousFace = await getLatestUserFaceByCpf(cpfDigits)
  let uploadedPhotoUrl: string | null = null

  if (parsedPhoto) {
    if (!isSharePointEnabled()) {
      throw new HttpError(
        500,
        "SharePoint nao habilitado para salvar faciais. Configure TREIN_SHAREPOINT_ENABLED=true.",
      )
    }

    await ensureSharePointFolder("faciais")
    const uploaded = await uploadBase64ToSharePoint({
      base64Data: parsedPhoto,
      relativeFolderPath: "faciais",
      fileNamePrefix: `face-${cpfDigits}`,
      contentType: "image/jpeg",
    })
    uploadedPhotoUrl = uploaded.webUrl
  }

  const created = await createUserFace({
    cpf: cpfDigits,
    descriptorJson: JSON.stringify(parsedDescriptor),
    fotoBase64: null,
    fotoUrl: uploadedPhotoUrl ?? previousFace?.FOTO_URL ?? null,
    origem: parsedOrigin || "treinamento-coletivo",
    criadoPor: parsedCreatedBy || null,
  })

  if (
    uploadedPhotoUrl &&
    previousFace?.FOTO_URL &&
    previousFace.FOTO_URL !== uploadedPhotoUrl
  ) {
    await deleteSharePointFileByUrl(previousFace.FOTO_URL).catch(() => undefined)
  }

  res.status(201).json({
    face: created
      ? {
          ID: created.ID,
          USUARIO_CPF: created.USUARIO_CPF,
          USUARIO_NOME: created.USUARIO_NOME,
          FOTO_BASE64: created.FOTO_BASE64,
          FOTO_URL: created.FOTO_URL,
          ORIGEM: created.ORIGEM,
          CRIADO_POR: created.CRIADO_POR,
          CRIADO_EM: created.CRIADO_EM,
        }
      : null,
  })
})

export const matchFace = asyncHandler(async (req: Request, res: Response) => {
  const { descriptor, threshold } = req.body as {
    descriptor?: unknown
    threshold?: unknown
  }

  const parsedDescriptor = parseDescriptor(descriptor)
  const parsedThreshold = Number(threshold)
  const matchThreshold =
    Number.isFinite(parsedThreshold) && parsedThreshold > 0
      ? parsedThreshold
      : DEFAULT_MATCH_THRESHOLD

  const descriptorRows = await listFaceDescriptorsForMatch(3)
  const candidates = descriptorRows
    .map((row) => {
      try {
        const rowDescriptor = JSON.parse(row.DESCRIPTOR_JSON) as unknown
        if (!Array.isArray(rowDescriptor) || rowDescriptor.length !== DESCRIPTOR_SIZE) {
          return null
        }

        const numericDescriptor = rowDescriptor.map((value) => Number(value))
        if (numericDescriptor.some((value) => !Number.isFinite(value))) {
          return null
        }

        const distance = euclideanDistance(parsedDescriptor, numericDescriptor)
        return {
          faceId: row.ID,
          cpf: row.USUARIO_CPF,
          nome: row.USUARIO_NOME,
          distance,
          createdAt: row.CRIADO_EM,
        }
      } catch {
        return null
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => left.distance - right.distance)

  const best = candidates[0]
  const match = best && best.distance <= matchThreshold ? best : null

  res.json({
    threshold: matchThreshold,
    match: match
      ? {
          ...match,
          confidence: Number((1 - match.distance).toFixed(6)),
        }
      : null,
    candidates: candidates.slice(0, DEFAULT_TOP_CANDIDATES).map((candidate) => ({
      ...candidate,
      confidence: Number((1 - candidate.distance).toFixed(6)),
    })),
  })
})
