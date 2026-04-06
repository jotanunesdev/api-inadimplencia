import fs from "fs/promises"
import path from "path"
import os from "os"

const WORDS_PER_MINUTE = 200

const DOCUMENT_EXTENSIONS = new Set([".pdf", ".ppt", ".pptx", ".pps", ".ppsx"])

export function isDocumentExtensionForReadingTime(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return DOCUMENT_EXTENSIONS.has(ext)
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function secondsFromWordCount(words: number): number {
  return Math.ceil((words / WORDS_PER_MINUTE) * 60)
}

async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<string> {
  const ext = path.extname(filename).toLowerCase().replace(".", "")

  if (ext === "pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("pdf-parse")
    const pdfParse = typeof mod === "function" ? mod : mod.default
    const data = await pdfParse(buffer) as { text?: string }
    return data.text ?? ""
  }

  if (["ppt", "pptx", "pps", "ppsx"].includes(ext)) {
    // officeparser precisa de um arquivo em disco
    const tmpFile = path.join(os.tmpdir(), `rt-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`)
    try {
      await fs.writeFile(tmpFile, buffer)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const officeParser = require("officeparser") as {
        parseOfficeAsync: (filePath: string, config?: Record<string, unknown>) => Promise<string>
      }
      return await officeParser.parseOfficeAsync(tmpFile, { outputErrorToConsole: false })
    } finally {
      await fs.unlink(tmpFile).catch(() => {})
    }
  }

  return ""
}

/**
 * Calcula o tempo estimado de leitura em segundos a partir de um Buffer.
 * Usa 200 palavras por minuto. Retorna null se não suportado ou sem texto.
 */
export async function calculateReadingTimeSecondsFromBuffer(
  buffer: Buffer,
  filename: string,
): Promise<number | null> {
  if (!isDocumentExtensionForReadingTime(filename)) {
    return null
  }

  try {
    const text = await extractTextFromBuffer(buffer, filename)
    const words = countWords(text)
    if (words === 0) return null
    return secondsFromWordCount(words)
  } catch (err) {
    console.error("[readingTime] Erro ao calcular tempo de leitura:", err)
    return null
  }
}

/**
 * Calcula o tempo estimado de leitura em segundos a partir de um arquivo em disco.
 * Usa 200 palavras por minuto. Retorna null se não suportado ou sem texto.
 */
export async function calculateReadingTimeSeconds(
  filePath: string,
  filename: string,
): Promise<number | null> {
  if (!isDocumentExtensionForReadingTime(filename)) {
    return null
  }

  try {
    const buffer = await fs.readFile(filePath)
    return calculateReadingTimeSecondsFromBuffer(buffer, filename)
  } catch (err) {
    console.error("[readingTime] Erro ao ler arquivo:", err)
    return null
  }
}
