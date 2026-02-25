import { XMLParser } from "fast-xml-parser"
import { env } from "../config/env"
import { HttpError } from "../utils/httpError"

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
})

type ReadViewParams = {
  dataServerName: string
  filter?: string
  context?: string
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function buildEnvelope({ dataServerName, filter, context }: ReadViewParams) {
  const dataServer = escapeXml(dataServerName)
  const filterValue = filter ? escapeXml(filter) : ""
  const contextValue = context ? escapeXml(context) : ""

  return [
    "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
    `<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:tot=\"${env.READVIEW_NAMESPACE}\">`,
    "<soapenv:Header/>",
    "<soapenv:Body>",
    "<tot:ReadView>",
    `<tot:DataServerName>${dataServer}</tot:DataServerName>`,
    filterValue ? `<tot:Filtro>${filterValue}</tot:Filtro>` : "",
    contextValue ? `<tot:Contexto>${contextValue}</tot:Contexto>` : "",
    "</tot:ReadView>",
    "</soapenv:Body>",
    "</soapenv:Envelope>",
  ].join("")
}

function findByKey(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") {
    return null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findByKey(item, key)
      if (found) {
        return found
      }
    }
    return null
  }

  const record = value as Record<string, unknown>
  if (record[key] !== undefined) {
    return record[key]
  }

  for (const child of Object.values(record)) {
    const found = findByKey(child, key)
    if (found) {
      return found
    }
  }

  return null
}

function normalizeResult(result: unknown) {
  if (!result) {
    return null
  }

  if (typeof result === "string") {
    const trimmed = result.trim()
    if (trimmed.startsWith("<")) {
      return parser.parse(trimmed)
    }
    return trimmed
  }

  return result
}

export async function readView(params: ReadViewParams) {
  const body = buildEnvelope(params)
  const basicAuth = Buffer.from(
    `${env.READVIEW_USER}:${env.READVIEW_PASSWORD}`,
  ).toString("base64")

  const headers: Record<string, string> = {
    Authorization: `Basic ${basicAuth}`,
    "Content-Type": "text/xml; charset=utf-8",
    Accept: "text/xml, application/xml",
  }

  if (env.READVIEW_ACTION) {
    headers.SOAPAction = env.READVIEW_ACTION
  }

  const response = await fetch(env.READVIEW_URL, {
    method: "POST",
    headers,
    body,
  })

  const text = await response.text()
  if (!response.ok) {
    throw new HttpError(
      response.status,
      `ReadView falhou: ${response.status} ${response.statusText}`,
    )
  }

  const parsed = parser.parse(text)
  const fault = findByKey(parsed, "Fault")
  if (fault) {
    throw new HttpError(502, "ReadView retornou erro")
  }

  const resultNode = findByKey(parsed, "ReadViewResult")
  return normalizeResult(resultNode)
}

export function extractPFunc(result: unknown) {
  if (!result || typeof result !== "object") {
    return null
  }

  const pfunc = findByKey(result, "PFunc")
  if (!pfunc) {
    return null
  }

  if (Array.isArray(pfunc)) {
    return pfunc[0]
  }

  return pfunc
}

function toStringRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const record: Record<string, string> = {}

  for (const [key, raw] of Object.entries(source)) {
    if (raw === null || raw === undefined) continue
    if (typeof raw === "object") continue
    const text = String(raw).trim()
    if (!text) continue
    record[key] = text
  }

  return Object.keys(record).length > 0 ? record : null
}

export function extractPFuncRows(result: unknown) {
  if (!result || typeof result !== "object") {
    return [] as Record<string, string>[]
  }

  const pfunc = findByKey(result, "PFunc")
  if (!pfunc) {
    return [] as Record<string, string>[]
  }

  if (Array.isArray(pfunc)) {
    return pfunc
      .map((item) => toStringRecord(item))
      .filter((item): item is Record<string, string> => Boolean(item))
  }

  const single = toStringRecord(pfunc)
  return single ? [single] : []
}
