import { createHmac, timingSafeEqual } from "crypto"
import { env } from "../config/env"

export type CollectiveProofTokenPayload = {
  v: 1
  cpfs: string[]
  trilhaIds: string[]
  turmaId: string | null
  iat: number
  exp: number
}

function toBase64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const pad = normalized.length % 4
  const padded = pad ? `${normalized}${"=".repeat(4 - pad)}` : normalized
  return Buffer.from(padded, "base64")
}

function sign(payloadBase64Url: string) {
  return toBase64Url(
    createHmac("sha256", env.COLLECTIVE_PROVA_TOKEN_SECRET).update(payloadBase64Url).digest(),
  )
}

export function createCollectiveProofToken(input: {
  cpfs: string[]
  trilhaIds: string[]
  turmaId?: string | null
  ttlMinutes?: number
}) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const ttlMinutes = input.ttlMinutes ?? env.COLLECTIVE_PROVA_TOKEN_TTL_MINUTES
  const payload: CollectiveProofTokenPayload = {
    v: 1,
    cpfs: Array.from(new Set(input.cpfs)),
    trilhaIds: Array.from(new Set(input.trilhaIds)),
    turmaId: input.turmaId ?? null,
    iat: issuedAt,
    exp: issuedAt + Math.max(1, Math.floor(ttlMinutes)) * 60,
  }

  const payloadBase64 = toBase64Url(JSON.stringify(payload))
  const signature = sign(payloadBase64)
  return {
    token: `${payloadBase64}.${signature}`,
    payload,
  }
}

export function parseCollectiveProofToken(token: string) {
  const [payloadBase64, signature] = token.split(".")
  if (!payloadBase64 || !signature) {
    throw new Error("Token invalido")
  }

  const expected = sign(payloadBase64)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Assinatura do token invalida")
  }

  const decoded = fromBase64Url(payloadBase64).toString("utf8")
  const parsed = JSON.parse(decoded) as Partial<CollectiveProofTokenPayload>
  if (parsed.v !== 1 || !Array.isArray(parsed.cpfs) || !Array.isArray(parsed.trilhaIds)) {
    throw new Error("Payload do token invalido")
  }

  const payload: CollectiveProofTokenPayload = {
    v: 1,
    cpfs: parsed.cpfs.map((item) => String(item)),
    trilhaIds: parsed.trilhaIds.map((item) => String(item)),
    turmaId: parsed.turmaId ? String(parsed.turmaId) : null,
    iat: Number(parsed.iat ?? 0),
    exp: Number(parsed.exp ?? 0),
  }

  if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp) || payload.exp <= payload.iat) {
    throw new Error("Validade do token invalida")
  }

  return payload
}

export function assertCollectiveProofTokenActive(payload: CollectiveProofTokenPayload) {
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) {
    throw new Error("Token expirado")
  }
}
