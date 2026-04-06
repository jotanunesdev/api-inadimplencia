import fs from "fs/promises"
import path from "path"

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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>

// eslint-disable-next-line @typescript-eslint/no-require-imports
const officeParser = require("officeparser") as {
  parseOfficeAsync: (filePathOrBuffer: string | Buffer, config?: Record<string, unknown>) => Promise<string>
}

async function extractText(filePath: string, filename: string): Promise<string> {
  const ext = path.extname(filename).toLowerCase().replace(".", "")

  if (ext === "pdf") {
    const buffer = await fs.readFile(filePath)
    const data = await pdfParse(buffer)
    return data.text ?? ""
  }

  if (["ppt", "pptx", "pps", "ppsx"].includes(ext)) {
    return officeParser.parseOfficeAsync(filePath, { outputErrorToConsole: false })
  }

  return ""
}

/**
 * Calcula o tempo estimado de leitura em segundos para um arquivo (PDF ou slide).
 * Usa 200 palavras por minuto como base.
 * Retorna null se não conseguir extrair texto ou o arquivo não for suportado.
 */
export async function calculateReadingTimeSeconds(
  filePath: string,
  filename: string,
): Promise<number | null> {
  if (!isDocumentExtensionForReadingTime(filename)) {
    return null
  }

  try {
    const text = await extractText(filePath, filename)
    const words = countWords(text)
    if (words === 0) return null
    return secondsFromWordCount(words)
  } catch {
    return null
  }
}
