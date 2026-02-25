import fs from "fs/promises"
import os from "os"
import path from "path"
import { randomUUID } from "crypto"
import sharp from "sharp"
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from "docx"
import {
  buildSharePointFilePath,
  deleteSharePointFileByPath,
  downloadSharePointFileByUrl,
  downloadSharePointFileContentByItemId,
  downloadSharePointFileContentByPath,
  ensureSharePointFolder,
  isSharePointEnabled,
  listSharePointFolderChildren,
  uploadFileToSharePoint,
} from "./sharePointService"
import { getDossieDataByCpf, type DossieData, type DossieTreinamentoItem } from "../models/dossieModel"
import { HttpError } from "../utils/httpError"

const DOSSIE_OUTPUT_FOLDER = "dossies"
const DOSSIE_TEMP_FOLDER = "dossies/_tmp"
const DOSSIE_TEMPLATE_FOLDER = "dossie"

// Bibliotecas sem typings completos para o formato usado pelo template DOCX.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require("pizzip")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Docxtemplater = require("docxtemplater")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ImageModule = require("docxtemplater-image-module-free")

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sanitizeFileName(name: string) {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function formatDateTime(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(value)
}

function formatIssueDate(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(value)
}

function formatScore(value: number) {
  if (!Number.isFinite(value)) return "-"
  return value.toFixed(2)
}

function parseBase64Image(base64Data: string) {
  const trimmed = base64Data.trim()
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s)
  const payload = (match ? match[2] : trimmed).replace(/\s+/g, "")
  if (!payload) return null

  try {
    return Buffer.from(payload, "base64")
  } catch {
    return null
  }
}

async function resolveNormalizedFaceImageBufferFromRefs(params: {
  fotoUrl?: string | null
  fotoBase64?: string | null
}) {
  const normalizeForWord = async (buffer: Buffer | null) => {
    if (!buffer || !buffer.length) return null

    try {
      return await sharp(buffer)
        .rotate()
        .resize(600, 600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
    } catch (error) {
      console.warn("[Dossie] Falha ao normalizar foto facial para JPEG:", error)
      return buffer
    }
  }

  const fotoUrl = params.fotoUrl?.trim()
  if (fotoUrl) {
    try {
      const downloaded = await downloadSharePointFileByUrl(fotoUrl)
      const normalized = await normalizeForWord(downloaded)
      if (normalized?.length) {
        return normalized
      }
    } catch (error) {
      console.warn("[Dossie] Falha ao baixar foto facial do SharePoint:", error)
    }
  }

  const fotoBase64 = params.fotoBase64?.trim()
  if (fotoBase64) {
    const parsed = parseBase64Image(fotoBase64)
    return normalizeForWord(parsed)
  }

  return null
}

async function resolveFaceImageBuffer(data: DossieData) {
  return resolveNormalizedFaceImageBufferFromRefs({
    fotoUrl: data.identificacao.fotoUrl,
    fotoBase64: data.identificacao.fotoBase64,
  })
}

async function resolveTrainingItemFaceImageBuffer(item: DossieTreinamentoItem) {
  return resolveNormalizedFaceImageBufferFromRefs({
    fotoUrl: item.fotoConfirmacaoUrl,
    fotoBase64: item.fotoConfirmacaoBase64,
  })
}

async function buildTemplateLoopItemsWithPhotos(
  items: DossieTreinamentoItem[],
  kind: "norma" | "procedimento",
  omitItemFaces: boolean,
) {
  const faceBuffers = omitItemFaces
    ? Array.from({ length: items.length }, () => null as Buffer | null)
    : await Promise.all(items.map((item) => resolveTrainingItemFaceImageBuffer(item)))

  return items.map((item, index) => {
    const faceBuffer = faceBuffers[index]
    const fotoConfirmacao = faceBuffer?.length
      ? `data:image/jpeg;base64,${faceBuffer.toString("base64")}`
      : null

    const baseItem = {
      DataHora: formatDateTime(item.dataHora),
      Treinamento: item.treinamento,
      NotaProva: formatScore(item.notaProva),
      FotoConfirmacao: fotoConfirmacao,
    }

    return kind === "norma"
      ? { ...baseItem, Norma: item.itemNome }
      : { ...baseItem, Procedimento: item.itemNome }
  })
}

async function buildTemplateContext(
  data: DossieData,
  faceImageBuffer: Buffer | null,
  meta?: {
    omitFace?: boolean
    dataEmissao?: Date
    usuarioEmissor?: string | null
    obra?: string | null
    setorObra?: string | null
  },
) {
  const fotoForTemplate = faceImageBuffer?.length
    ? `data:image/jpeg;base64,${faceImageBuffer.toString("base64")}`
    : null
  const emissor = (meta?.usuarioEmissor ?? "").trim() || "Sistema"
  const dataEmissao = meta?.dataEmissao ?? new Date()
  const obra = (meta?.obra ?? "").trim() || "-"
  const setorObra = (meta?.setorObra ?? "").trim() || "-"

  const [normasTreinadas, procedimentosTreinados] = await Promise.all([
    buildTemplateLoopItemsWithPhotos(data.normasTreinadas, "norma", Boolean(meta?.omitFace)),
    buildTemplateLoopItemsWithPhotos(
      data.procedimentosTreinados,
      "procedimento",
      Boolean(meta?.omitFace),
    ),
  ])

  return {
    NomeCompleto: data.identificacao.nomeCompleto || "-",
    Funcao: data.identificacao.funcao || "-",
    CPF: data.identificacao.cpf || "-",
    DataEmissao: formatIssueDate(dataEmissao),
    UsuarioEmissor: emissor,
    Obra: obra,
    SetorObra: setorObra,
    // Com delimitadores {{ }}, use `{{%Foto}}` no template.
    // Para foto dentro dos loops use `{{%FotoConfirmacao}}`.
    Foto: fotoForTemplate,
    NormasTreinadas: normasTreinadas,
    ProcedimentosTreinados: procedimentosTreinados,
  }
}

async function loadDossieTemplateDocxBuffer() {
  const items = await listSharePointFolderChildren(DOSSIE_TEMPLATE_FOLDER)
  const candidates = items
    .filter((item) => item.file)
    .filter((item) => item.name.toLowerCase().endsWith(".docx"))
    .filter((item) => !item.name.startsWith("~$"))
    .sort((a, b) => {
      const da = new Date(a.lastModifiedDateTime ?? 0).getTime()
      const db = new Date(b.lastModifiedDateTime ?? 0).getTime()
      return db - da
    })

  if (!candidates.length) {
    throw new Error(
      `Nenhum template .docx encontrado em SharePoint na pasta '${DOSSIE_TEMPLATE_FOLDER}'`,
    )
  }

  const preferred =
    candidates.find((item) => item.name.toLowerCase().includes("modelo")) ??
    candidates[0]

  const fullPath = buildSharePointFilePath({
    relativeFolderPath: DOSSIE_TEMPLATE_FOLDER,
    fileName: preferred.name,
  }).fullPath

  console.log("[Dossie] Template Word selecionado:", {
    nome: preferred.name,
    fullPath,
    alteradoEm: preferred.lastModifiedDateTime ?? null,
  })

  return downloadSharePointFileContentByPath({ fullPath })
}

async function buildDossieDocxBufferFromTemplate(
  data: DossieData,
  options?: {
    omitFace?: boolean
    dataEmissao?: Date
    usuarioEmissor?: string | null
    obra?: string | null
    setorObra?: string | null
  },
) {
  const [templateBuffer, faceImageBuffer] = await Promise.all([
    loadDossieTemplateDocxBuffer(),
    options?.omitFace ? Promise.resolve<Buffer | null>(null) : resolveFaceImageBuffer(data),
  ])

  const zip = new PizZip(templateBuffer)
  const imageModule = new ImageModule({
    centered: false,
    fileType: "docx",
    getImage(tagValue: unknown) {
      if (!tagValue) {
        // Transparente 1x1 PNG em base64 para placeholder opcional
        return Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZLZQAAAAASUVORK5CYII=",
          "base64",
        )
      }

      if (Buffer.isBuffer(tagValue)) {
        return tagValue
      }

      if (typeof tagValue === "string") {
        return parseBase64Image(tagValue) ?? Buffer.from(tagValue)
      }

      throw new Error("Formato de imagem invalido para placeholder Foto")
    },
    getSize() {
      return [120, 120]
    },
  })

  // O módulo open-source de imagem é antigo e é mais estável no fluxo legado
  // (attachModule/loadZip/setOptions) do que no construtor com modules:[...].
  const doc = new Docxtemplater()
  doc.attachModule(imageModule)
  doc.loadZip(zip)
  doc.setOptions({
    delimiters: {
      start: "{{",
      end: "}}",
    },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter() {
      return ""
    },
  })

  try {
    const templateContext = await buildTemplateContext(data, faceImageBuffer, {
      ...options,
      omitFace: Boolean(options?.omitFace),
    })
    doc.render(templateContext)
  } catch (error) {
    const details =
      error && typeof error === "object"
        ? JSON.stringify(
            {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              properties:
                "properties" in (error as Record<string, unknown>)
                  ? (error as { properties?: unknown }).properties
                  : undefined,
            },
            null,
            2,
          )
        : String(error)
    throw new Error(`[DossieTemplate] Falha ao renderizar template DOCX: ${details}`)
  }

  return doc.getZip().generate({ type: "nodebuffer" }) as Buffer
}

function isOfficeConversionTransientError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  return (
    normalized.includes("(406)") ||
    normalized.includes("cannotopenfile") ||
    normalized.includes("error from office service") ||
    normalized.includes("notsupported")
  )
}

function cellText(text: string, opts?: { bold?: boolean }) {
  return new TableCell({
    width: { size: 30, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: opts?.bold ?? false,
          }),
        ],
      }),
    ],
  })
}

function valueCell(text: string) {
  return new TableCell({
    width: { size: 70, type: WidthType.PERCENTAGE },
    children: [new Paragraph(text || "-")],
  })
}

function valueImageCell(buffer: Buffer | null) {
  return new TableCell({
    width: { size: 70, type: WidthType.PERCENTAGE },
    children: [
      buffer?.length
        ? new Paragraph({
            children: [
              new ImageRun({
                data: buffer,
                transformation: { width: 90, height: 90 },
              }),
            ],
          })
        : new Paragraph({
            children: [new TextRun({ text: "Sem foto de confirmacao", italics: true })],
          }),
    ],
  })
}

async function buildSectionRows(
  items: DossieTreinamentoItem[],
  labelKey: "Norma" | "Procedimento",
  options?: { omitFace?: boolean },
) {
  if (!items.length) {
    return [
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            children: [new Paragraph("Nenhum registro encontrado.")],
          }),
        ],
      }),
    ]
  }

  const rows: TableRow[] = []
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    const faceConfirmacaoBuffer = options?.omitFace
      ? null
      : await resolveTrainingItemFaceImageBuffer(item)
    rows.push(
      new TableRow({
        children: [cellText(`${labelKey}:`, { bold: true }), valueCell(item.itemNome)],
      }),
      new TableRow({
        children: [cellText("Data e Hora:", { bold: true }), valueCell(formatDateTime(item.dataHora))],
      }),
      new TableRow({
        children: [cellText("Nome Treinamento:", { bold: true }), valueCell(item.treinamento)],
      }),
      new TableRow({
        children: [cellText("Nota da Prova:", { bold: true }), valueCell(formatScore(item.notaProva))],
      }),
      new TableRow({
        children: [cellText("Foto Confirmacao:", { bold: true }), valueImageCell(faceConfirmacaoBuffer)],
      }),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            borders: {
              top: { style: BorderStyle.SINGLE, color: "D9D9D9", size: 4 },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            children: [new Paragraph("")],
          }),
        ],
      }),
    )
  }

  return rows
}

function buildIdentificacaoTable(params: {
  nomeCompleto: string
  funcao: string
  cpf: string
  obra?: string | null
  setorObra?: string | null
  faceImageBuffer: Buffer | null
  dataEmissao?: string
  usuarioEmissor?: string
}) {
  const textRows = [
    new Paragraph({
      children: [
        new TextRun({ text: "Nome do Colaborador: ", bold: true }),
        new TextRun(params.nomeCompleto || "-"),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Funcao: ", bold: true }),
        new TextRun(params.funcao || "-"),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "CPF: ", bold: true }),
        new TextRun(params.cpf || "-"),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Obra: ", bold: true }),
        new TextRun(params.obra?.trim() || "-"),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Setor da Obra: ", bold: true }),
        new TextRun(params.setorObra?.trim() || "-"),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Data Emissao: ", bold: true }),
        new TextRun(params.dataEmissao || "-"),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Usuario Emissor: ", bold: true }),
        new TextRun(params.usuarioEmissor || "Sistema"),
      ],
    }),
  ]

  const faceParagraph = params.faceImageBuffer
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: params.faceImageBuffer,
            transformation: { width: 120, height: 120 },
          }),
        ],
      })
    : new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Sem foto facial", italics: true })],
      })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
      left: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
      right: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 75, type: WidthType.PERCENTAGE },
            children: textRows,
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [faceParagraph],
          }),
        ],
      }),
    ],
  })
}

async function buildDossieDocxBuffer(
  data: DossieData,
  options?: {
    omitFace?: boolean
    dataEmissao?: Date
    usuarioEmissor?: string | null
    obra?: string | null
    setorObra?: string | null
  },
) {
  try {
    return await buildDossieDocxBufferFromTemplate(data, options)
  } catch (error) {
    console.warn(
      "[Dossie] Template Word do SharePoint nao utilizado. Aplicando layout programatico.",
      error,
    )
  }

  const faceImageBuffer = options?.omitFace ? null : await resolveFaceImageBuffer(data)

  const sectionChildren = [
    new Paragraph({
      text: "Dossie do Colaborador",
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
    }),
    new Paragraph({
      text: "Identificacao",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 120, after: 180 },
    }),
    buildIdentificacaoTable({
      nomeCompleto: data.identificacao.nomeCompleto,
      funcao: data.identificacao.funcao,
      cpf: data.identificacao.cpf,
      obra: options?.obra ?? null,
      setorObra: options?.setorObra ?? null,
      faceImageBuffer,
      dataEmissao: formatIssueDate(options?.dataEmissao ?? new Date()),
      usuarioEmissor: (options?.usuarioEmissor ?? "").trim() || "Sistema",
    }),
    new Paragraph({
      text: "Normas Treinadas",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 180 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
        bottom: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
        left: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
        right: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
        insideHorizontal: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
        insideVertical: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
      },
      rows: await buildSectionRows(data.normasTreinadas, "Norma", {
        omitFace: Boolean(options?.omitFace),
      }),
    }),
    new Paragraph({
      text: "Procedimentos Treinados",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 180 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
        bottom: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
        left: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
        right: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
        insideHorizontal: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
        insideVertical: { style: BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
      },
      rows: await buildSectionRows(data.procedimentosTreinados, "Procedimento", {
        omitFace: Boolean(options?.omitFace),
      }),
    }),
  ]

  const sections: ISectionOptions[] = [
    {
      properties: {},
      children: sectionChildren,
    },
  ]

  const document = new Document({ sections })
  return Packer.toBuffer(document)
}

async function writeTempFile(buffer: Buffer, extension: string) {
  const tempFilePath = path.join(
    os.tmpdir(),
    `dossie-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`,
  )
  await fs.writeFile(tempFilePath, buffer)
  return tempFilePath
}

export type GeneratedDossieResult = {
  cpf: string
  nomeColaborador: string
  fileName: string
  webUrl: string
}

export type DossieCourseType = "norma" | "procedimento"

export type DossieCourseSelection = {
  tipo: DossieCourseType
  itemId: string
  trilhaId: string
}

export type DossieSelectableCourse = {
  selectionKey: string
  tipo: DossieCourseType
  itemId: string
  itemNome: string
  trilhaId: string
  treinamento: string
  dataHora: string
  notaProva: number
}

function buildCourseSelectionKey(selection: DossieCourseSelection) {
  return `${selection.tipo}:${selection.itemId}:${selection.trilhaId}`
}

function filterDossieItemsBySelection(
  items: DossieTreinamentoItem[],
  tipo: DossieCourseType,
  allowedKeys: Set<string>,
) {
  if (!allowedKeys.size) return items
  return items.filter((item) =>
    allowedKeys.has(
      buildCourseSelectionKey({
        tipo,
        itemId: item.itemId,
        trilhaId: item.trilhaId,
      }),
    ),
  )
}

function filterDossieDataBySelectedCourses(
  data: DossieData,
  selectedCourses?: DossieCourseSelection[] | null,
): DossieData {
  if (!selectedCourses?.length) return data

  const normalizedSelections = selectedCourses
    .filter((item) => item && (item.tipo === "norma" || item.tipo === "procedimento"))
    .map((item) => ({
      tipo: item.tipo,
      itemId: String(item.itemId ?? "").trim(),
      trilhaId: String(item.trilhaId ?? "").trim(),
    }))
    .filter((item) => item.itemId && item.trilhaId)

  if (!normalizedSelections.length) return data

  const allowedKeys = new Set(normalizedSelections.map(buildCourseSelectionKey))

  return {
    ...data,
    normasTreinadas: filterDossieItemsBySelection(data.normasTreinadas, "norma", allowedKeys),
    procedimentosTreinados: filterDossieItemsBySelection(
      data.procedimentosTreinados,
      "procedimento",
      allowedKeys,
    ),
  }
}

export async function listDossieSelectableCoursesByCpf(cpf: string): Promise<DossieSelectableCourse[]> {
  const data = await getDossieDataByCpf(cpf)
  if (!data) {
    throw new HttpError(404, "Colaborador nao encontrado")
  }

  const mapItems = (tipo: DossieCourseType, items: DossieTreinamentoItem[]): DossieSelectableCourse[] =>
    items.map((item) => ({
      selectionKey: buildCourseSelectionKey({
        tipo,
        itemId: item.itemId,
        trilhaId: item.trilhaId,
      }),
      tipo,
      itemId: item.itemId,
      itemNome: item.itemNome,
      trilhaId: item.trilhaId,
      treinamento: item.treinamento,
      dataHora: item.dataHora.toISOString(),
      notaProva: item.notaProva,
    }))

  return [...mapItems("norma", data.normasTreinadas), ...mapItems("procedimento", data.procedimentosTreinados)]
    .sort((a, b) => {
      const da = new Date(a.dataHora).getTime()
      const db = new Date(b.dataHora).getTime()
      if (da !== db) return db - da
      return a.treinamento.localeCompare(b.treinamento, "pt-BR")
    })
}

export async function generateDossiePdfForCpf(
  cpf: string,
  options?: {
    usuarioEmissor?: string | null
    dataEmissao?: Date
    obra?: string | null
    setorObra?: string | null
    cursosSelecionados?: DossieCourseSelection[] | null
  },
): Promise<GeneratedDossieResult> {
  if (!isSharePointEnabled()) {
    throw new HttpError(400, "SharePoint nao habilitado para gerar dossie")
  }

  const rawData = await getDossieDataByCpf(cpf)
  if (!rawData) {
    throw new HttpError(404, "Colaborador nao encontrado")
  }

  const data = filterDossieDataBySelectedCourses(rawData, options?.cursosSelecionados)

  if (!data.normasTreinadas.length && !data.procedimentosTreinados.length) {
    throw new HttpError(400, "Colaborador nao possui treinamentos validos para o dossie")
  }

  const baseName = sanitizeFileName(data.identificacao.nomeCompleto || cpf) || cpf
  const pdfFileName = `${baseName}.pdf`

  const generatePdfBufferFromDocx = async (docxBuffer: Buffer) => {
    const docxTempFileName = `${baseName}-${randomUUID()}.docx`
    const tempDocxLocalPath = await writeTempFile(docxBuffer, ".docx")
    let tempDocxRemoteFullPath: string | null = null

    try {
      await ensureSharePointFolder(DOSSIE_TEMP_FOLDER)
      const docxRemote = buildSharePointFilePath({
        relativeFolderPath: DOSSIE_TEMP_FOLDER,
        fileName: docxTempFileName,
      })
      tempDocxRemoteFullPath = docxRemote.fullPath

      const uploadedDocx = await uploadFileToSharePoint({
        tempFilePath: tempDocxLocalPath,
        relativeFolderPath: DOSSIE_TEMP_FOLDER,
        fileName: docxTempFileName,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })

      let lastError: unknown = null
      for (const delayMs of [1000, 2500, 5000]) {
        try {
          return await downloadSharePointFileContentByItemId({
            itemId: uploadedDocx.itemId,
            format: "pdf",
          })
        } catch (error) {
          lastError = error
          if (!isOfficeConversionTransientError(error)) {
            throw error
          }
          await sleep(delayMs)
        }
      }

      // Fallback por path (alguns tenants respondem melhor por path apos indexacao)
      try {
        return await downloadSharePointFileContentByPath({
          fullPath: tempDocxRemoteFullPath,
          format: "pdf",
        })
      } catch (error) {
        if (lastError) {
          throw lastError
        }
        throw error
      }
    } finally {
      if (tempDocxRemoteFullPath) {
        await deleteSharePointFileByPath(tempDocxRemoteFullPath).catch(() => undefined)
      }
      await fs.unlink(tempDocxLocalPath).catch(() => undefined)
    }
  }

  let pdfBuffer: Buffer
  try {
    const docxBuffer = await buildDossieDocxBuffer(data, options)
    pdfBuffer = await generatePdfBufferFromDocx(docxBuffer)
  } catch (error) {
    if (!isOfficeConversionTransientError(error)) {
      throw error
    }

    // Fallback: alguns formatos de imagem facial podem quebrar a conversao do Office.
    console.warn("[Dossie] Conversao DOCX->PDF falhou. Tentando novamente sem foto facial.", error)
    const docxWithoutFace = await buildDossieDocxBuffer(data, {
      ...options,
      omitFace: true,
    })
    pdfBuffer = await generatePdfBufferFromDocx(docxWithoutFace)
  }

  await ensureSharePointFolder(DOSSIE_OUTPUT_FOLDER)
  const tempPdfLocalPath = await writeTempFile(pdfBuffer, ".pdf")
  try {
    const uploadedPdf = await uploadFileToSharePoint({
      tempFilePath: tempPdfLocalPath,
      relativeFolderPath: DOSSIE_OUTPUT_FOLDER,
      fileName: pdfFileName,
      contentType: "application/pdf",
    })

    return {
      cpf: data.identificacao.cpf,
      nomeColaborador: data.identificacao.nomeCompleto,
      fileName: pdfFileName,
      webUrl: uploadedPdf.webUrl,
    }
  } finally {
    await fs.unlink(tempPdfLocalPath).catch(() => undefined)
  }
}
