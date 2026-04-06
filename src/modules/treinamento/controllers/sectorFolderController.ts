import { randomUUID } from "crypto"
import path from "path"
import type { Request, Response } from "express"
import {
  deleteSectorFolderMetadataByItemId,
  getSectorFolderMetadataByItemId,
  isSectorFolderMetadataSchemaMissingError,
  listSectorFolderMetadataBySector,
  type SectorFolderMetadata,
  updateSectorFolderItemReadingTime,
  updateSectorFolderMetadataPathsByPrefix,
  upsertSectorFolderMetadata,
} from "../models/sectorFolderModel"
import {
  deleteSectorFolderSharesByItemIds,
  getSectorFolderShareByTargetAndItem,
  isSectorFolderShareTableMissingError,
  listSectorFolderSharesByItemId,
  listSectorFolderSharesByTargetSector,
  syncSectorFolderShares,
  type SectorFolderShareRecord,
} from "../models/sectorFolderShareModel"
import {
  deleteSectorFolderTrashByItemIds,
  getSectorFolderTrashByItemId,
  isSectorFolderTrashTableMissingError,
  listSectorFolderTrashItems,
  upsertSectorFolderTrashItem,
  type SectorFolderTrashRecord,
} from "../models/sectorFolderTrashModel"
import {
  deleteSectorFolderUserItemsByItemIds,
  isSectorFolderUserItemTableMissingError,
  listFavoriteSectorFolderUserItems,
  listRecentSectorFolderUserItems,
  listSectorFolderUserItemRelationsByItemIds,
  registerSectorFolderAccess,
  setSectorFolderFavorite,
  type SectorFolderUserItemRecord,
} from "../models/sectorFolderUserItemModel"
import { listTrainingMaterialLinksByStoredPaths } from "../models/trainingMaterialLinkModel"
import { archiveTrainingProgressByTrilhaIds } from "../models/userTrainingModel"
import {
  replaceMaterialStoredPathExact,
  updateMaterialPathsByPrefix,
} from "../models/pathUpdateModel"
import {
  buildYouTubeStoredPathToken,
  createSectorFolderExternalItem,
  deleteSectorFolderExternalItemsByIds,
  getSectorFolderExternalItemById,
  isSectorFolderExternalItemTableMissingError,
  listSectorFolderExternalItemsByIds,
  listSectorFolderExternalItemsByParent,
  listSectorFolderExternalItemsByPathPrefix,
  type SectorFolderExternalItem,
  updateSectorFolderExternalItem,
  updateSectorFolderExternalItemPathsByPrefix,
  YOUTUBE_EXTERNAL_ITEM_TYPE,
} from "../models/sectorFolderExternalItemModel"
import {
  copySharePointItemToFolder,
  createSharePointUploadSession,
  createSharePointFolder,
  downloadSharePointFileContentByItemId,
  deleteSharePointItemById,
  ensureSharePointFolder,
  getSharePointFileByPath,
  getSharePointItemById,
  getSharePointItemByPath,
  isSharePointEnabled,
  listSharePointFolderChildren,
  listSharePointFolderChildrenByItemId,
  type SharePointDriveIdentitySet,
  type SharePointDriveItem,
  updateSharePointItemName,
  uploadFileToSharePoint,
} from "../services/sharePointService"
import { resolveSectorDefinition } from "../utils/sectorAccess"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  calculateReadingTimeSeconds,
  isDocumentExtensionForReadingTime,
} from "../utils/readingTimeUtils"

type SectorDefinition = {
  key: string
  label: string
  folderPath: string
  aliases: string[]
  fixedFolders?: SectorFixedFolderDefinition[]
}

type SectorFixedFolderDefinition = {
  key: string
  label: string
  requiresValidityForFiles?: boolean
}

type UserProfile = {
  displayName: string | null
  email: string | null
  username: string | null
}

type PendingSectorFolderUpload = {
  sectorKey: string
  actor: UserProfile
  currentFolderPath: string
  validityMonths: number | null
  validityYears: number | null
  fullPath: string
  createdAt: number
}

type BreadcrumbItem = {
  id: string | null
  label: string
  path: string
}

type SharedFolderSummary = {
  rootItemId: string
  sourceSectorKey: string
  sourceSectorLabel: string
  sharedByName: string | null
  sharedByEmail: string | null
  sharedByUsername: string | null
  sharedAt: string | null
}

type ResolvedFolderContext = {
  currentFolder: SharePointDriveItem | null
  currentFolderPath: string
  pathSector: SectorDefinition
  sharedFolder: SharedFolderSummary | null
}

type LinkedTrainingSummary = {
  trilhaId: string
  trilhaTitulo: string
  moduloId: string | null
  moduloNome: string | null
}

type DirectoryView =
  | "all"
  | "shared"
  | "recent"
  | "favorites"
  | "deleted"
  | "version-history"

const MAX_FOLDER_MEMBERS = 8
const VERSION_HISTORY_FOLDER_NAME = "Historico de Versoes"
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".ppt",
  ".pptx",
  ".pps",
  ".ppsx",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".wmv",
  ".m4v",
])
const pendingSectorFolderUploads = new Map<string, PendingSectorFolderUpload>()
const PENDING_SECTOR_FOLDER_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000

const SECTORS: SectorDefinition[] = [
  {
    key: "ti",
    label: "TI",
    folderPath: "TI",
    aliases: [
      "ti",
      "tecnologia",
      "tecnologia da informacao",
      "tecnologia da informacao corporativa",
    ],
  },
  {
    key: "sesmt",
    label: "SESMT",
    folderPath: "SESMT",
    aliases: [
      "sesmt",
      "seguranca do trabalho",
      "saude e seguranca",
      "saude e seguranca do trabalho",
    ],
    fixedFolders: [
      {
        key: "normas",
        label: "Normas",
        requiresValidityForFiles: true,
      },
    ],
  },
  {
    key: "qualidade",
    label: "Qualidade",
    folderPath: "Qualidade",
    aliases: [
      "qualidade",
      "gestao da qualidade",
      "qualidade e processos",
      "processos e qualidade",
    ],
    fixedFolders: [
      {
        key: "procedimentos",
        label: "Procedimentos",
      },
    ],
  },
  {
    key: "recursos-humanos",
    label: "Recursos Humanos",
    folderPath: "Recursos Humanos",
    aliases: [
      "recursos humanos",
      "rh",
      "gente e gestao",
      "departamento pessoal",
      "administracao de pessoal",
      "administração de pessoal",
      "adm pessoal",
      "adm. pessoal",
      "dp",
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    folderPath: "Financeiro",
    aliases: ["financeiro", "setor financeiro", "departamento financeiro"],
  },
  {
    key: "contabilidade",
    label: "Contabilidade",
    folderPath: "Contabilidade",
    aliases: ["contabilidade", "contabil", "setor contabil", "setor contabilidade"],
  },
  {
    key: "inovacao",
    label: "Inovacao",
    folderPath: "Inovacao",
    aliases: ["inovacao", "inovacao corporativa"],
  },
  {
    key: "diretoria",
    label: "Diretoria",
    folderPath: "Diretoria",
    aliases: ["diretoria", "diretoria executiva"],
  },
]

let metadataSchemaWarningDisplayed = false
let shareSchemaWarningDisplayed = false
let userItemSchemaWarningDisplayed = false
let trashSchemaWarningDisplayed = false
let externalItemSchemaWarningDisplayed = false

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function normalizePath(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/")
}

function normalizeComparablePath(value: unknown) {
  return normalizePath(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function joinPaths(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => normalizePath(part))
    .filter(Boolean)
    .join("/")
}

function resolveSector(value: unknown) {
  const resolvedSectorDefinition = resolveSectorDefinition(String(value ?? ""))

  if (!resolvedSectorDefinition) {
    return null
  }

  return (
    SECTORS.find((sector) => sector.key === resolvedSectorDefinition.key) ?? null
  )
}

function listSectorFixedFolders(sector: SectorDefinition) {
  return sector.fixedFolders ?? []
}

function buildSectorFixedFolderPath(
  sector: SectorDefinition,
  folder: SectorFixedFolderDefinition,
) {
  return joinPaths(sector.folderPath, folder.label)
}

function buildSectorVersionHistoryRootPath(sector: SectorDefinition) {
  return joinPaths(sector.folderPath, VERSION_HISTORY_FOLDER_NAME)
}

function findSectorFixedFolderByPath(
  sector: SectorDefinition,
  itemPath: string,
) {
  const normalizedItemPath = normalizeComparablePath(itemPath)

  return (
    listSectorFixedFolders(sector).find((folder) => {
      const fixedFolderPath = normalizeComparablePath(
        buildSectorFixedFolderPath(sector, folder),
      )
      return normalizedItemPath === fixedFolderPath
    }) ?? null
  )
}

function findSectorFixedFolderAncestor(
  sector: SectorDefinition,
  itemPath: string,
) {
  const normalizedItemPath = normalizeComparablePath(itemPath)

  return (
    listSectorFixedFolders(sector).find((folder) => {
      const fixedFolderPath = normalizeComparablePath(
        buildSectorFixedFolderPath(sector, folder),
      )
      return (
        normalizedItemPath === fixedFolderPath ||
        normalizedItemPath.startsWith(`${fixedFolderPath}/`)
      )
    }) ?? null
  )
}

function isSectorVersionHistoryPath(
  sector: SectorDefinition,
  itemPath: string,
) {
  const normalizedItemPath = normalizeComparablePath(itemPath)
  const normalizedHistoryRoot = normalizeComparablePath(
    buildSectorVersionHistoryRootPath(sector),
  )

  return (
    normalizedItemPath === normalizedHistoryRoot ||
    normalizedItemPath.startsWith(`${normalizedHistoryRoot}/`)
  )
}

function isSectorVersionHistoryRootItem(
  item: SharePointDriveItem,
  sector: SectorDefinition,
) {
  return normalizeComparablePath(buildItemPathFromSector(item, sector)) ===
    normalizeComparablePath(buildSectorVersionHistoryRootPath(sector))
}

function assertPathIsNotVersionHistory(
  sector: SectorDefinition,
  itemPath: string,
  actionMessage = "Itens do Historico de Versoes sao gerenciados automaticamente.",
) {
  if (!isSectorVersionHistoryPath(sector, itemPath)) {
    return
  }

  throw new HttpError(403, actionMessage)
}

function assertItemIsNotVersionHistory(
  item: SharePointDriveItem,
  sector: SectorDefinition,
  actionMessage = "Itens do Historico de Versoes sao gerenciados automaticamente.",
) {
  assertPathIsNotVersionHistory(
    sector,
    buildItemPathFromSector(item, sector),
    actionMessage,
  )
}

function buildVersionHistoryFolderPath(
  item: SharePointDriveItem,
  sector: SectorDefinition,
) {
  const itemPath = buildItemPathFromSector(item, sector)
  const itemSegments = normalizePath(itemPath).split("/").filter(Boolean)
  const sectorSegments = normalizePath(sector.folderPath).split("/").filter(Boolean)
  const relativeParentSegments = itemSegments.slice(sectorSegments.length, -1)

  return joinPaths(
    buildSectorVersionHistoryRootPath(sector),
    relativeParentSegments.join("/"),
  )
}

function buildVersionHistoryStamp(now: Date) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
    String(now.getMilliseconds()).padStart(3, "0"),
  ].join("")
}

function buildVersionHistoryFileName(itemName: string, now: Date) {
  const extension = path.extname(itemName ?? "")
  const baseName = extension
    ? itemName.slice(0, itemName.length - extension.length)
    : itemName
  const safeBaseName = String(baseName ?? "").trim() || "arquivo"
  const stamp = buildVersionHistoryStamp(now)

  return `${safeBaseName} - versao ${stamp}${extension}`
}

function buildVersionHistoryExternalItemName(itemName: string, now: Date) {
  const safeName = String(itemName ?? "").trim() || "item"
  return `${safeName} - versao ${buildVersionHistoryStamp(now)}`
}

function buildExternalItemVersionHistoryFolderPath(
  item: SectorFolderExternalItem,
  sector: SectorDefinition,
) {
  const itemSegments = normalizePath(item.path).split("/").filter(Boolean)
  const sectorSegments = normalizePath(sector.folderPath).split("/").filter(Boolean)
  const relativeParentSegments = itemSegments.slice(sectorSegments.length, -1)

  return joinPaths(
    buildSectorVersionHistoryRootPath(sector),
    relativeParentSegments.join("/"),
  )
}

async function ensureSectorStructure(sector: SectorDefinition) {
  await ensureSharePointFolder(sector.folderPath)
  await ensureSharePointFolder(buildSectorVersionHistoryRootPath(sector))

  for (const fixedFolder of listSectorFixedFolders(sector)) {
    // eslint-disable-next-line no-await-in-loop
    await ensureSharePointFolder(buildSectorFixedFolderPath(sector, fixedFolder))
  }
}

function ensureSharePointIsAvailable() {
  if (!isSharePointEnabled()) {
    throw new HttpError(
      503,
      "SharePoint nao esta habilitado no modulo treinamento.",
    )
  }
}

function cleanupPendingSectorFolderUploads() {
  const now = Date.now()
  for (const [key, pending] of pendingSectorFolderUploads.entries()) {
    if (now - pending.createdAt > PENDING_SECTOR_FOLDER_UPLOAD_TTL_MS) {
      pendingSectorFolderUploads.delete(key)
    }
  }
}

function parseSectorFromQuery(req: Request) {
  const sector = resolveSector(req.query.sector)
  if (!sector) {
    throw new HttpError(400, "Informe um setor valido.")
  }

  return sector
}

function parseSectorFromBody(body: Record<string, unknown>) {
  const sector = resolveSector(body.sector)
  if (!sector) {
    throw new HttpError(400, "Informe um setor valido.")
  }

  return sector
}

function parseFolderName(value: unknown) {
  const name = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()

  if (!name) {
    throw new HttpError(400, "Informe o nome da pasta.")
  }

  if (/[\\/:*?"<>|]/.test(name)) {
    throw new HttpError(
      400,
      "O nome da pasta contem caracteres nao permitidos.",
    )
  }

  if (name.endsWith(".") || name.endsWith(" ")) {
    throw new HttpError(
      400,
      "O nome da pasta nao pode terminar com ponto ou espaco.",
    )
  }

  return name
}

function parseExternalItemDisplayName(value: unknown) {
  const name = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()

  if (!name) {
    throw new HttpError(400, "Informe o nome exibido do link.")
  }

  if (/[\\/:*?"<>|]/.test(name)) {
    throw new HttpError(
      400,
      "O nome exibido do link contem caracteres nao permitidos.",
    )
  }

  if (name.endsWith(".") || name.endsWith(" ")) {
    throw new HttpError(
      400,
      "O nome exibido do link nao pode terminar com ponto ou espaco.",
    )
  }

  return name
}

function parseParentItemId(value: unknown) {
  const itemId = String(value ?? "").trim()
  return itemId || null
}

function parseOptionalUsername(value: unknown) {
  const username = String(value ?? "").trim()
  return username || null
}

function parseDirectoryView(value: unknown): DirectoryView {
  const normalizedValue = String(value ?? "").trim().toLowerCase()

  switch (normalizedValue) {
    case "shared":
    case "recent":
    case "favorites":
    case "deleted":
    case "version-history":
      return normalizedValue
    default:
      return "all"
  }
}

function parseOptionalSector(value: unknown) {
  const rawValue = String(value ?? "").trim()
  if (!rawValue) {
    return null
  }

  const sector = resolveSector(rawValue)
  if (!sector) {
    throw new HttpError(400, "Informe um setor valido.")
  }

  return sector
}

function parseTargetSectorKeys(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : []

  return Array.from(
    new Set(
      rawValues
        .map((item) => parseOptionalSector(item))
        .filter((item): item is SectorDefinition => Boolean(item))
        .map((item) => item.key),
    ),
  )
}

function parseActor(body: Record<string, unknown>) {
  const rawActor =
    typeof body.actor === "object" && body.actor !== null
      ? (body.actor as Record<string, unknown>)
      : body

  const displayName = String(rawActor.displayName ?? "").trim() || null
  const email = String(rawActor.email ?? "").trim() || null
  const username = String(rawActor.username ?? "").trim() || null

  return {
    displayName,
    email,
    username,
  }
}

function extractYouTubeVideoId(value: string) {
  try {
    const url = new URL(String(value ?? "").trim())
    const host = url.hostname.replace(/^www\./i, "").toLowerCase()
    const pathSegments = url.pathname.split("/").filter(Boolean)

    if (host === "youtu.be") {
      return pathSegments[0] ?? null
    }

    if (
      host !== "youtube.com" &&
      host !== "m.youtube.com" &&
      host !== "music.youtube.com" &&
      host !== "youtube-nocookie.com"
    ) {
      return null
    }

    if (pathSegments[0] === "watch") {
      return url.searchParams.get("v")
    }

    if (
      pathSegments[0] === "embed" ||
      pathSegments[0] === "shorts" ||
      pathSegments[0] === "live"
    ) {
      return pathSegments[1] ?? null
    }

    return url.searchParams.get("v")
  } catch {
    return null
  }
}

function parseCanonicalYouTubeUrl(value: unknown) {
  const videoId = extractYouTubeVideoId(String(value ?? "").trim())

  if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
    throw new HttpError(
      400,
      "Informe um link valido do YouTube para adicionar ao gerenciador.",
    )
  }

  return `https://www.youtube.com/watch?v=${videoId}`
}

function assertAllowedUploadFile(file: Express.Multer.File | undefined) {
  if (!file) {
    throw new HttpError(400, "Selecione um arquivo para upload.")
  }

  const extension = path.extname(file.originalname || "").toLowerCase()
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
    throw new HttpError(
      400,
      "Apenas arquivos PDF, PPTX ou de video sao permitidos.",
    )
  }
}

function assertAllowedUploadFileName(fileName: unknown) {
  const normalized = String(fileName ?? "").trim()
  if (!normalized) {
    throw new HttpError(400, "Informe o nome do arquivo para upload.")
  }

  const extension = path.extname(normalized).toLowerCase()
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
    throw new HttpError(
      400,
      "Apenas arquivos PDF, PPTX ou de video sao permitidos.",
    )
  }

  return normalized
}

function parseOptionalIntegerInRange(
  value: unknown,
  min: number,
  max: number,
  fieldLabel: string,
) {
  const rawValue = String(value ?? "").trim()
  if (!rawValue) {
    return null
  }

  const parsed = Number(rawValue)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `Informe ${fieldLabel} entre ${min} e ${max}.`)
  }

  return parsed
}

function parseNormasFileValidity(
  body: Record<string, unknown>,
  required: boolean,
) {
  const validityMonths = parseOptionalIntegerInRange(
    body.validadeMeses ?? body.validityMonths,
    1,
    11,
    "os meses de validade",
  )
  const validityYears = parseOptionalIntegerInRange(
    body.validadeAnos ?? body.validityYears,
    1,
    3,
    "os anos de validade",
  )

  if (required && !validityMonths && !validityYears) {
    throw new HttpError(
      400,
      "Arquivos enviados na pasta Normas exigem um prazo: meses (1-11), anos (1-3) ou ambos.",
    )
  }

  return {
    validityMonths,
    validityYears,
  }
}

function parseBooleanFlag(value: unknown) {
  const normalizedValue = normalizeText(value)

  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    normalizedValue === "true" ||
    normalizedValue === "sim" ||
    normalizedValue === "yes"
  )
}

function assertMatchingVersionedFileExtension(
  currentItem: SharePointDriveItem,
  file: Express.Multer.File | undefined,
) {
  if (!file) {
    return
  }

  const currentExtension = path.extname(currentItem.name ?? "").toLowerCase()
  const uploadedExtension = path.extname(file.originalname ?? "").toLowerCase()

  if (
    currentExtension &&
    uploadedExtension &&
    currentExtension !== uploadedExtension
  ) {
    throw new HttpError(
      400,
      `O arquivo versionado precisa manter a extensao ${currentExtension}.`,
    )
  }
}

function buildItemParentFolderPath(
  item: SharePointDriveItem,
  sector: SectorDefinition,
) {
  const itemPath = buildItemPathFromSector(item, sector)
  const segments = normalizePath(itemPath).split("/").filter(Boolean)

  if (segments.length <= 1) {
    return sector.folderPath
  }

  segments.pop()
  return segments.join("/")
}

function buildStoredPathCandidates(params: {
  item: SharePointDriveItem
  sector: SectorDefinition
  metadata: SectorFolderMetadata | null
}) {
  const candidates = Array.from(
    new Set(
      [
        params.item.webUrl,
        buildItemPathFromSector(params.item, params.sector),
        params.metadata?.path,
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  )

  return candidates
}

function buildVersionImpactResponse(
  linkedMaterials: Awaited<ReturnType<typeof listTrainingMaterialLinksByStoredPaths>>,
) {
  const linkedTrainingMap = new Map<string, LinkedTrainingSummary>()

  linkedMaterials.forEach((material) => {
    const trilhaId = String(material.TRILHA_ID ?? "").trim()
    if (!trilhaId || linkedTrainingMap.has(trilhaId)) {
      return
    }

    linkedTrainingMap.set(trilhaId, {
      trilhaId,
      trilhaTitulo:
        String(material.TRILHA_TITULO ?? "").trim() || "Treinamento sem titulo",
      moduloId: material.MODULO_ID ?? null,
      moduloNome: material.MODULO_NOME ?? null,
    })
  })

  const linkedTrainings = Array.from(linkedTrainingMap.values()).sort(
    (left, right) => {
      const moduloCompare = String(left.moduloNome ?? "").localeCompare(
        String(right.moduloNome ?? ""),
        "pt-BR",
      )
      if (moduloCompare !== 0) {
        return moduloCompare
      }

      return left.trilhaTitulo.localeCompare(right.trilhaTitulo, "pt-BR")
    },
  )

  return {
    linkedMaterialCount: linkedMaterials.length,
    linkedTrainings,
    linkedTrainingsCount: linkedTrainings.length,
  }
}

function extractProfileFromIdentity(
  identitySet: SharePointDriveIdentitySet | undefined,
  allowApplication = false,
) {
  const user = identitySet?.user
  if (user) {
    return {
      displayName: user.displayName?.trim() || null,
      email: user.email?.trim() || null,
      username:
        user.userPrincipalName?.trim() ||
        user.email?.trim() ||
        user.id?.trim() ||
        null,
    }
  }

  if (allowApplication && identitySet?.application?.displayName) {
    return {
      displayName: identitySet.application.displayName.trim(),
      email: null,
      username: null,
    }
  }

  return null
}

function toUserProfile(profile: UserProfile | null) {
  if (!profile) {
    return null
  }

  return {
    displayName: profile.displayName,
    email: profile.email,
    username: profile.username,
  }
}

function profileFromMetadata(metadata: SectorFolderMetadata | null) {
  if (!metadata) {
    return null
  }

  const displayName = metadata.createdByName?.trim() || null
  const email = metadata.createdByEmail?.trim() || null
  const username = metadata.createdByUsername?.trim() || null
  if (!displayName && !email && !username) {
    return null
  }

  return {
    displayName,
    email,
    username,
  }
}

function updatedProfileFromMetadata(metadata: SectorFolderMetadata | null) {
  if (!metadata) {
    return null
  }

  const displayName = metadata.updatedByName?.trim() || null
  const email = metadata.updatedByEmail?.trim() || null
  const username = metadata.updatedByUsername?.trim() || null
  if (!displayName && !email && !username) {
    return null
  }

  return {
    displayName,
    email,
    username,
  }
}

function extractRelativeParentPath(pathValue: string | undefined) {
  const rawPath = String(pathValue ?? "")
  const rootMarker = "root:/"
  const rootIndex = rawPath.indexOf(rootMarker)

  if (rootIndex < 0) {
    return normalizePath(rawPath)
  }

  return normalizePath(rawPath.slice(rootIndex + rootMarker.length))
}

function findPathIndex(
  haystackSegments: string[],
  needleSegments: string[],
) {
  if (needleSegments.length === 0) {
    return 0
  }

  const normalizedNeedle = needleSegments.map((segment) => normalizeText(segment))

  for (let index = 0; index <= haystackSegments.length - needleSegments.length; index += 1) {
    const candidate = haystackSegments
      .slice(index, index + needleSegments.length)
      .map((segment) => normalizeText(segment))

    if (
      candidate.length === normalizedNeedle.length &&
      candidate.every((segment, currentIndex) => segment === normalizedNeedle[currentIndex])
    ) {
      return index
    }
  }

  return -1
}

function buildItemPathFromSector(
  item: SharePointDriveItem,
  sector: SectorDefinition,
) {
  const parentPath = extractRelativeParentPath(item.parentReference?.path)
  const parentSegments = normalizePath(parentPath).split("/").filter(Boolean)
  const sectorSegments = normalizePath(sector.folderPath).split("/").filter(Boolean)
  const sectorIndex = findPathIndex(parentSegments, sectorSegments)
  const relativeParentSegments =
    sectorIndex >= 0 ? parentSegments.slice(sectorIndex) : parentSegments

  return joinPaths(relativeParentSegments.join("/"), item.name)
}

function itemBelongsToSector(
  item: SharePointDriveItem,
  sector: SectorDefinition,
) {
  const itemPath = buildItemPathFromSector(item, sector)
  const normalizedItemPath = normalizeComparablePath(itemPath)
  const normalizedSectorPath = normalizeComparablePath(sector.folderPath)

  return (
    normalizedItemPath === normalizedSectorPath ||
    normalizedItemPath.startsWith(`${normalizedSectorPath}/`)
  )
}

function assertItemBelongsToSector(
  item: SharePointDriveItem,
  sector: SectorDefinition,
) {
  const belongsToSector = itemBelongsToSector(item, sector)

  if (!belongsToSector) {
    throw new HttpError(404, "Item do setor nao encontrado.")
  }
}

function assertItemIsNotFixedSectorFolder(
  item: SharePointDriveItem,
  sector: SectorDefinition,
) {
  if (!item.folder) {
    return
  }

  const itemPath = buildItemPathFromSector(item, sector)
  const fixedFolder = findSectorFixedFolderByPath(sector, itemPath)

  if (!fixedFolder) {
    return
  }

  throw new HttpError(
    403,
    `A pasta ${fixedFolder.label} e fixa neste setor e nao pode ser renomeada ou excluida.`,
  )
}

function parseDateOrNull(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function pickLatestDate(
  left: string | Date | null | undefined,
  right: string | Date | null | undefined,
) {
  const leftDate = parseDateOrNull(left)
  const rightDate = parseDateOrNull(right)

  if (!leftDate) {
    return rightDate
  }

  if (!rightDate) {
    return leftDate
  }

  return leftDate.getTime() >= rightDate.getTime() ? leftDate : rightDate
}

function addUniqueProfile(
  profiles: Map<string, UserProfile>,
  profile: UserProfile | null,
) {
  if (!profile) {
    return
  }

  const key = normalizeText(
    profile.email ?? profile.username ?? profile.displayName ?? "",
  )
  if (!key || profiles.has(key)) {
    return
  }

  profiles.set(key, profile)
}

function buildSharedFolderSummary(
  sourceSector: SectorDefinition,
  share: SectorFolderShareRecord,
): SharedFolderSummary {
  return {
    rootItemId: share.SHAREPOINT_ITEM_ID,
    sourceSectorKey: sourceSector.key,
    sourceSectorLabel: sourceSector.label,
    sharedByName: share.COMPARTILHADO_POR_NOME ?? null,
    sharedByEmail: share.COMPARTILHADO_POR_EMAIL ?? null,
    sharedByUsername: share.COMPARTILHADO_POR_USUARIO ?? null,
    sharedAt: parseDateOrNull(share.COMPARTILHADO_EM)?.toISOString() ?? null,
  }
}

function buildUserRelationKey(itemId: string) {
  return String(itemId ?? "").trim()
}

function buildExternalLinkOpenUrl(item: SectorFolderExternalItem) {
  return String(item.url ?? "").trim() || null
}

function buildExternalLinkStoredPath(item: SectorFolderExternalItem) {
  if (item.linkType === YOUTUBE_EXTERNAL_ITEM_TYPE) {
    return buildYouTubeStoredPathToken(item.id)
  }

  return buildExternalLinkOpenUrl(item)
}

function buildExternalStoredPathCandidates(item: SectorFolderExternalItem) {
  return Array.from(
    new Set(
      [buildExternalLinkStoredPath(item), buildExternalLinkOpenUrl(item)]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  )
}

function buildExternalItemResponse(params: {
  item: SectorFolderExternalItem
  sector: SectorDefinition
  sharedFolder?: SharedFolderSummary | null
  readOnly?: boolean
  isDeleted?: boolean
  deletedAt?: string | null
  deletedBy?: {
    displayName: string | null
    email: string | null
    username: string | null
  } | null
}) {
  const createdBy =
    params.item.createdByName || params.item.createdByEmail || params.item.createdByUsername
      ? {
          displayName: params.item.createdByName ?? null,
          email: params.item.createdByEmail ?? null,
          username: params.item.createdByUsername ?? null,
        }
      : null

  return {
    id: params.item.id,
    name: params.item.name,
    path: params.item.path,
    webUrl: buildExternalLinkOpenUrl(params.item),
    contentUrl: buildExternalLinkOpenUrl(params.item),
    storedPath: buildExternalLinkStoredPath(params.item),
    itemType: "file",
    itemCount: 0,
    size: null,
    extension:
      params.item.linkType === YOUTUBE_EXTERNAL_ITEM_TYPE ? ".youtube" : null,
    contentType:
      params.item.linkType === YOUTUBE_EXTERNAL_ITEM_TYPE ? "youtube" : null,
    contentSource: params.item.linkType,
    linkType: params.item.linkType,
    itemSource: "external-link",
    createdAt: params.item.createdAt?.toISOString() ?? null,
    lastUpdatedAt: params.item.updatedAt?.toISOString() ?? null,
    createdBy: toUserProfile(createdBy),
    members: [],
    canDelete: !params.readOnly,
    canRename: false,
    canShare: false,
    canFavorite: false,
    canVersion:
      !params.readOnly &&
      !params.isDeleted &&
      !isSectorVersionHistoryPath(params.sector, params.item.path),
    isFavorite: false,
    fixedFolderKey: null,
    isFixedFolder: false,
    requiresValidityForFiles: false,
    validityMonths: null,
    validityYears: null,
    isShared: Boolean(params.sharedFolder),
    sharedFolder: params.sharedFolder ?? null,
    isDeleted: Boolean(params.isDeleted),
    deletedAt: params.deletedAt ?? null,
    deletedBy: params.deletedBy ?? null,
    sourceSectorKey: params.sector.key,
    sourceSectorLabel: params.sector.label,
  }
}

function buildDeletedItemResponse(params: {
  trash: SectorFolderTrashRecord
  metadata: SectorFolderMetadata | null
  externalItem?: SectorFolderExternalItem | null
  sourceSector: SectorDefinition
  sharedFolder?: SharedFolderSummary | null
  isFavorite?: boolean
}) {
  if (params.externalItem) {
    return buildExternalItemResponse({
      item: params.externalItem,
      sector: params.sourceSector,
      sharedFolder: params.sharedFolder,
      readOnly: true,
      isDeleted: true,
      deletedAt: parseDateOrNull(params.trash.EXCLUIDO_EM)?.toISOString() ?? null,
      deletedBy: {
        displayName: params.trash.EXCLUIDO_POR_NOME ?? null,
        email: params.trash.EXCLUIDO_POR_EMAIL ?? null,
        username: params.trash.EXCLUIDO_POR_USUARIO ?? null,
      },
    })
  }

  const createdBy = profileFromMetadata(params.metadata)
  return {
    id: params.trash.SHAREPOINT_ITEM_ID,
    name: params.trash.NOME,
    path: params.trash.CAMINHO,
    webUrl: params.trash.WEB_URL ?? null,
    itemType: params.trash.TIPO_ITEM === "folder" ? "folder" : "file",
    itemCount: 0,
    size:
      params.trash.TAMANHO == null ? null : Number(params.trash.TAMANHO),
    extension: params.trash.EXTENSAO ?? null,
    contentType: null,
    createdAt: params.metadata?.createdAt?.toISOString() ?? null,
    lastUpdatedAt: params.metadata?.updatedAt?.toISOString() ?? null,
    createdBy: toUserProfile(createdBy),
    members: [],
    canDelete: false,
    canRename: false,
    canShare: false,
    canFavorite: false,
    canVersion: false,
    isFavorite: Boolean(params.isFavorite),
    fixedFolderKey: null,
    isFixedFolder: false,
    requiresValidityForFiles: false,
    validityMonths: params.metadata?.validityMonths ?? null,
    validityYears: params.metadata?.validityYears ?? null,
    isShared: Boolean(params.sharedFolder),
    sharedFolder: params.sharedFolder ?? null,
    isDeleted: true,
    deletedAt: parseDateOrNull(params.trash.EXCLUIDO_EM)?.toISOString() ?? null,
    deletedBy: {
      displayName: params.trash.EXCLUIDO_POR_NOME ?? null,
      email: params.trash.EXCLUIDO_POR_EMAIL ?? null,
      username: params.trash.EXCLUIDO_POR_USUARIO ?? null,
    },
    sourceSectorKey: params.sourceSector.key,
    sourceSectorLabel: params.sourceSector.label,
  }
}

function buildItemResponse(params: {
  item: SharePointDriveItem
  sector: SectorDefinition
  metadata: SectorFolderMetadata | null
  members: UserProfile[]
  sharedFolder?: SharedFolderSummary | null
  readOnly?: boolean
  isFavorite?: boolean
}) {
  const itemPath = buildItemPathFromSector(params.item, params.sector)
  const fixedFolder = params.item.folder
    ? findSectorFixedFolderByPath(params.sector, itemPath)
    : null
  const fixedFolderAncestor = findSectorFixedFolderAncestor(
    params.sector,
    itemPath,
  )
  const createdBy =
    profileFromMetadata(params.metadata) ??
    extractProfileFromIdentity(params.item.createdBy, true)
  const createdAt =
    parseDateOrNull(params.metadata?.createdAt) ??
    parseDateOrNull(params.item.createdDateTime)
  const lastUpdatedAt = pickLatestDate(
    params.metadata?.updatedAt,
    params.item.lastModifiedDateTime,
  )

  return {
    id: params.item.id,
    name: params.item.name,
    path: itemPath,
    webUrl: params.item.webUrl ?? null,
    itemType: params.item.folder ? "folder" : "file",
    itemCount: Number(params.item.folder?.childCount ?? 0),
    size: params.item.folder ? null : Number(params.item.size ?? 0),
    extension: params.item.folder
      ? null
      : path.extname(params.item.name).toLowerCase() || null,
    contentType:
      typeof params.item.file?.mimeType === "string"
        ? params.item.file.mimeType
        : null,
    createdAt: createdAt?.toISOString() ?? null,
    lastUpdatedAt: lastUpdatedAt?.toISOString() ?? null,
    createdBy: toUserProfile(createdBy),
    members: params.members.map((member) => toUserProfile(member)),
    canDelete: !fixedFolder && !params.readOnly,
    canRename: !fixedFolder && !params.readOnly,
    canShare: Boolean(params.item.folder) && !params.readOnly,
    canFavorite: Boolean(params.item.folder),
    canVersion: !params.item.folder && !params.readOnly,
    isFavorite: Boolean(params.isFavorite),
    fixedFolderKey: fixedFolder?.key ?? null,
    isFixedFolder: Boolean(fixedFolder),
    requiresValidityForFiles: Boolean(
      fixedFolderAncestor?.requiresValidityForFiles,
    ),
    validityMonths: params.metadata?.validityMonths ?? null,
    validityYears: params.metadata?.validityYears ?? null,
    isShared: Boolean(params.sharedFolder),
    sharedFolder: params.sharedFolder ?? null,
    isDeleted: false,
  }
}

function buildCurrentFolderResponse(
  item: SharePointDriveItem | null,
  sector: SectorDefinition,
  sharedFolder: SharedFolderSummary | null = null,
  readOnly = false,
) {
  if (!item) {
    return null
  }

  const itemPath = buildItemPathFromSector(item, sector)
  const fixedFolder = findSectorFixedFolderByPath(sector, itemPath)
  const fixedFolderAncestor = findSectorFixedFolderAncestor(sector, itemPath)

  return {
    id: item.id,
    name: item.name,
    path: itemPath,
    webUrl: item.webUrl ?? null,
    canDelete: !fixedFolder && !sharedFolder && !readOnly,
    canRename: !fixedFolder && !sharedFolder && !readOnly,
    canShare: !sharedFolder && !readOnly,
    fixedFolderKey: fixedFolder?.key ?? null,
    isFixedFolder: Boolean(fixedFolder),
    requiresValidityForFiles: Boolean(
      fixedFolderAncestor?.requiresValidityForFiles,
    ),
    isShared: Boolean(sharedFolder),
    sharedFolder,
  }
}

function isSharePointNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("(404)")
}

function isSharePointConflictError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("(409)") ||
    message.includes("nameAlreadyExists") ||
    message.toLowerCase().includes("already exists")
  )
}

function warnMissingMetadataSchemaOnce() {
  if (metadataSchemaWarningDisplayed) {
    return
  }

  metadataSchemaWarningDisplayed = true
  console.warn(
    "[SetorPastas] Tabela T GESTAO_ARQUIVOS_SETOR_PASTAS nao encontrada. Metadados de criador real nao serao persistidos ate a migration ser aplicada.",
  )
}

function warnMissingShareSchemaOnce() {
  if (shareSchemaWarningDisplayed) {
    return
  }

  shareSchemaWarningDisplayed = true
  console.warn(
    "[SetorPastas] Tabela TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS nao encontrada. Pastas compartilhadas nao serao listadas ate a migration ser aplicada.",
  )
}

function warnMissingUserItemSchemaOnce() {
  if (userItemSchemaWarningDisplayed) {
    return
  }

  userItemSchemaWarningDisplayed = true
  console.warn(
    "[SetorPastas] Tabela TGESTAO_ARQUIVOS_SETOR_USUARIO_ITENS nao encontrada. Favoritos e recentes nao serao persistidos ate a migration ser aplicada.",
  )
}

function warnMissingTrashSchemaOnce() {
  if (trashSchemaWarningDisplayed) {
    return
  }

  trashSchemaWarningDisplayed = true
  console.warn(
    "[SetorPastas] Tabela TGESTAO_ARQUIVOS_SETOR_LIXEIRA nao encontrada. A lixeira do gerenciador nao funcionara ate a migration ser aplicada.",
  )
}

function warnMissingExternalItemSchemaOnce() {
  if (externalItemSchemaWarningDisplayed) {
    return
  }

  externalItemSchemaWarningDisplayed = true
  console.warn(
    "[SetorPastas] Tabela TGESTAO_ARQUIVOS_SETOR_LINKS_EXTERNOS nao encontrada. Links externos do gerenciador nao serao listados ate a migration ser aplicada.",
  )
}

async function listSectorMetadataSafely(sectorLabel: string) {
  try {
    return await listSectorFolderMetadataBySector(sectorLabel)
  } catch (error) {
    if (isSectorFolderMetadataSchemaMissingError(error)) {
      warnMissingMetadataSchemaOnce()
      return []
    }

    throw error
  }
}

async function getSectorMetadataSafely(itemId: string) {
  try {
    return await getSectorFolderMetadataByItemId(itemId)
  } catch (error) {
    if (isSectorFolderMetadataSchemaMissingError(error)) {
      warnMissingMetadataSchemaOnce()
      return null
    }

    throw error
  }
}

async function upsertSectorMetadataSafely(
  input: Parameters<typeof upsertSectorFolderMetadata>[0],
) {
  try {
    return await upsertSectorFolderMetadata(input)
  } catch (error) {
    if (isSectorFolderMetadataSchemaMissingError(error)) {
      warnMissingMetadataSchemaOnce()
      return null
    }

    throw error
  }
}

async function updateSectorMetadataPathsByPrefixSafely(params: {
  sector: string
  oldPathPrefix: string
  newPathPrefix: string
}) {
  try {
    await updateSectorFolderMetadataPathsByPrefix(params)
  } catch (error) {
    if (isSectorFolderMetadataSchemaMissingError(error)) {
      warnMissingSectorMetadataSchemaOnce()
      return
    }

    throw error
  }
}

async function deleteSectorMetadataSafely(itemId: string) {
  try {
    await deleteSectorFolderMetadataByItemId(itemId)
  } catch (error) {
    if (isSectorFolderMetadataSchemaMissingError(error)) {
      warnMissingMetadataSchemaOnce()
      return
    }

    throw error
  }
}

async function listSectorFolderSharesByItemSafely(itemId: string) {
  try {
    return await listSectorFolderSharesByItemId(itemId)
  } catch (error) {
    if (isSectorFolderShareTableMissingError(error)) {
      warnMissingShareSchemaOnce()
      return []
    }

    throw error
  }
}

async function listSectorFolderSharesByTargetSafely(targetSectorKey: string) {
  try {
    return await listSectorFolderSharesByTargetSector(targetSectorKey)
  } catch (error) {
    if (isSectorFolderShareTableMissingError(error)) {
      warnMissingShareSchemaOnce()
      return []
    }

    throw error
  }
}

async function deleteSectorFolderSharesSafely(itemIds: string[]) {
  try {
    await deleteSectorFolderSharesByItemIds(itemIds)
  } catch (error) {
    if (isSectorFolderShareTableMissingError(error)) {
      warnMissingShareSchemaOnce()
      return
    }

    throw error
  }
}

async function listSectorFolderTrashItemsSafely(sectorKey: string) {
  try {
    return await listSectorFolderTrashItems(sectorKey)
  } catch (error) {
    if (isSectorFolderTrashTableMissingError(error)) {
      warnMissingTrashSchemaOnce()
      return []
    }

    throw error
  }
}

async function getSectorFolderTrashByItemIdSafely(itemId: string) {
  try {
    return await getSectorFolderTrashByItemId(itemId)
  } catch (error) {
    if (isSectorFolderTrashTableMissingError(error)) {
      warnMissingTrashSchemaOnce()
      return null
    }

    throw error
  }
}

async function upsertSectorFolderTrashItemSafely(
  input: Parameters<typeof upsertSectorFolderTrashItem>[0],
) {
  try {
    return await upsertSectorFolderTrashItem(input)
  } catch (error) {
    if (isSectorFolderTrashTableMissingError(error)) {
      warnMissingTrashSchemaOnce()
      throw new HttpError(
        503,
        "Banco sem suporte a lixeira do gerenciador. Execute a migration de listas laterais.",
      )
    }

    throw error
  }
}

async function deleteSectorFolderTrashByItemIdsSafely(itemIds: string[]) {
  try {
    await deleteSectorFolderTrashByItemIds(itemIds)
  } catch (error) {
    if (isSectorFolderTrashTableMissingError(error)) {
      warnMissingTrashSchemaOnce()
      return
    }

    throw error
  }
}

async function listFavoriteSectorFolderUserItemsSafely(params: {
  viewerSectorKey: string
  username: string
}) {
  try {
    return await listFavoriteSectorFolderUserItems(params)
  } catch (error) {
    if (isSectorFolderUserItemTableMissingError(error)) {
      warnMissingUserItemSchemaOnce()
      return []
    }

    throw error
  }
}

async function listRecentSectorFolderUserItemsSafely(params: {
  viewerSectorKey: string
  username: string
}) {
  try {
    return await listRecentSectorFolderUserItems(params)
  } catch (error) {
    if (isSectorFolderUserItemTableMissingError(error)) {
      warnMissingUserItemSchemaOnce()
      return []
    }

    throw error
  }
}

async function listSectorFolderUserRelationsByItemIdsSafely(params: {
  viewerSectorKey: string
  username: string
  itemIds: string[]
}) {
  try {
    return await listSectorFolderUserItemRelationsByItemIds(params)
  } catch (error) {
    if (isSectorFolderUserItemTableMissingError(error)) {
      warnMissingUserItemSchemaOnce()
      return []
    }

    throw error
  }
}

async function registerSectorFolderAccessSafely(
  input: Parameters<typeof registerSectorFolderAccess>[0],
) {
  try {
    await registerSectorFolderAccess(input)
  } catch (error) {
    if (isSectorFolderUserItemTableMissingError(error)) {
      warnMissingUserItemSchemaOnce()
      return
    }

    throw error
  }
}

async function setSectorFolderFavoriteSafely(
  input: Parameters<typeof setSectorFolderFavorite>[0],
) {
  try {
    await setSectorFolderFavorite(input)
  } catch (error) {
    if (isSectorFolderUserItemTableMissingError(error)) {
      warnMissingUserItemSchemaOnce()
      throw new HttpError(
        503,
        "Banco sem suporte a favoritos e recentes do gerenciador. Execute a migration de listas laterais.",
      )
    }

    throw error
  }
}

async function deleteSectorFolderUserItemsByItemIdsSafely(itemIds: string[]) {
  try {
    await deleteSectorFolderUserItemsByItemIds(itemIds)
  } catch (error) {
    if (isSectorFolderUserItemTableMissingError(error)) {
      warnMissingUserItemSchemaOnce()
      return
    }

    throw error
  }
}

async function listSectorFolderExternalItemsByParentSafely(params: {
  sectorKey: string
  parentItemId?: string | null
}) {
  try {
    return await listSectorFolderExternalItemsByParent(params)
  } catch (error) {
    if (isSectorFolderExternalItemTableMissingError(error)) {
      warnMissingExternalItemSchemaOnce()
      return [] as SectorFolderExternalItem[]
    }

    throw error
  }
}

async function listSectorFolderExternalItemsByIdsSafely(itemIds: string[]) {
  try {
    return await listSectorFolderExternalItemsByIds(itemIds)
  } catch (error) {
    if (isSectorFolderExternalItemTableMissingError(error)) {
      warnMissingExternalItemSchemaOnce()
      return [] as SectorFolderExternalItem[]
    }

    throw error
  }
}

async function getSectorFolderExternalItemByIdSafely(itemId: string) {
  try {
    return await getSectorFolderExternalItemById(itemId)
  } catch (error) {
    if (isSectorFolderExternalItemTableMissingError(error)) {
      warnMissingExternalItemSchemaOnce()
      return null
    }

    throw error
  }
}

async function listSectorFolderExternalItemsByPathPrefixSafely(params: {
  sectorKey: string
  pathPrefix: string
}) {
  try {
    return await listSectorFolderExternalItemsByPathPrefix(params)
  } catch (error) {
    if (isSectorFolderExternalItemTableMissingError(error)) {
      warnMissingExternalItemSchemaOnce()
      return [] as SectorFolderExternalItem[]
    }

    throw error
  }
}

async function createSectorFolderExternalItemSafely(
  input: Parameters<typeof createSectorFolderExternalItem>[0],
) {
  try {
    return await createSectorFolderExternalItem(input)
  } catch (error) {
    if (isSectorFolderExternalItemTableMissingError(error)) {
      warnMissingExternalItemSchemaOnce()
      throw new HttpError(
        503,
        "Banco sem suporte a links externos do gerenciador. Execute a migration de links do YouTube.",
      )
    }

    throw error
  }
}

async function updateSectorFolderExternalItemSafely(
  input: Parameters<typeof updateSectorFolderExternalItem>[0],
) {
  try {
    return await updateSectorFolderExternalItem(input)
  } catch (error) {
    if (isSectorFolderExternalItemTableMissingError(error)) {
      warnMissingExternalItemSchemaOnce()
      throw new HttpError(
        503,
        "Banco sem suporte a links externos do gerenciador. Execute a migration de links do YouTube.",
      )
    }

    throw error
  }
}

async function deleteSectorFolderExternalItemsByIdsSafely(itemIds: string[]) {
  try {
    await deleteSectorFolderExternalItemsByIds(itemIds)
  } catch (error) {
    if (isSectorFolderExternalItemTableMissingError(error)) {
      warnMissingExternalItemSchemaOnce()
      return
    }

    throw error
  }
}

async function updateSectorFolderExternalItemPathsByPrefixSafely(params: {
  sectorKey: string
  oldPathPrefix: string
  newPathPrefix: string
}) {
  try {
    await updateSectorFolderExternalItemPathsByPrefix(params)
  } catch (error) {
    if (isSectorFolderExternalItemTableMissingError(error)) {
      warnMissingExternalItemSchemaOnce()
      return
    }

    throw error
  }
}

async function resolveParentContext(params: {
  requestedSector: SectorDefinition
  parentItemId: string | null
  sourceSector: SectorDefinition | null
  sharedRootItemId: string | null
}): Promise<ResolvedFolderContext> {
  if (!params.parentItemId) {
    return {
      currentFolder: null,
      currentFolderPath: params.requestedSector.folderPath,
      pathSector: params.requestedSector,
      sharedFolder: null,
    }
  }

  const currentFolder = await getSharePointItemById(params.parentItemId)
  if (!currentFolder.folder) {
    throw new HttpError(400, "Selecione uma pasta valida.")
  }

  if (!params.sourceSector || !params.sharedRootItemId) {
    assertItemBelongsToSector(currentFolder, params.requestedSector)

    return {
      currentFolder,
      currentFolderPath: buildItemPathFromSector(
        currentFolder,
        params.requestedSector,
      ),
      pathSector: params.requestedSector,
      sharedFolder: null,
    }
  }

  const share = await getSectorFolderShareByTargetAndItem({
    itemId: params.sharedRootItemId,
    targetSectorKey: params.requestedSector.key,
  })
  if (!share || share.SETOR_ORIGEM_CHAVE !== params.sourceSector.key) {
    throw new HttpError(404, "Pasta compartilhada nao encontrada para este setor.")
  }

  const sharedRootItem = await getSharePointItemById(params.sharedRootItemId)
  if (!sharedRootItem.folder) {
    throw new HttpError(404, "Pasta compartilhada nao encontrada para este setor.")
  }

  assertItemBelongsToSector(sharedRootItem, params.sourceSector)
  assertItemBelongsToSector(currentFolder, params.sourceSector)

  const sharedRootPath = buildItemPathFromSector(sharedRootItem, params.sourceSector)
  const currentFolderPath = buildItemPathFromSector(currentFolder, params.sourceSector)
  const normalizedSharedRootPath = normalizeComparablePath(sharedRootPath)
  const normalizedCurrentFolderPath = normalizeComparablePath(currentFolderPath)

  if (
    normalizedCurrentFolderPath !== normalizedSharedRootPath &&
    !normalizedCurrentFolderPath.startsWith(`${normalizedSharedRootPath}/`)
  ) {
    throw new HttpError(403, "A pasta selecionada nao pertence ao compartilhamento informado.")
  }

  return {
    currentFolder,
    currentFolderPath,
    pathSector: params.sourceSector,
    sharedFolder: buildSharedFolderSummary(params.sourceSector, share),
  }
}

async function resolveFilePreviewContext(params: {
  requestedSector: SectorDefinition
  itemId: string
  sourceSector: SectorDefinition | null
  sharedRootItemId: string | null
}) {
  const currentItem = await getSharePointItemById(params.itemId)
  if (currentItem.folder) {
    throw new HttpError(400, "Somente arquivos podem ser visualizados.")
  }

  if (!params.sourceSector || !params.sharedRootItemId) {
    assertItemBelongsToSector(currentItem, params.requestedSector)
    return {
      item: currentItem,
      sector: params.requestedSector,
    }
  }

  const share = await getSectorFolderShareByTargetAndItem({
    itemId: params.sharedRootItemId,
    targetSectorKey: params.requestedSector.key,
  })
  if (!share || share.SETOR_ORIGEM_CHAVE !== params.sourceSector.key) {
    throw new HttpError(404, "Pasta compartilhada nao encontrada para este setor.")
  }

  const sharedRootItem = await getSharePointItemById(params.sharedRootItemId)
  if (!sharedRootItem.folder) {
    throw new HttpError(404, "Pasta compartilhada nao encontrada para este setor.")
  }

  assertItemBelongsToSector(sharedRootItem, params.sourceSector)
  assertItemBelongsToSector(currentItem, params.sourceSector)

  const sharedRootPath = buildItemPathFromSector(sharedRootItem, params.sourceSector)
  const currentItemPath = buildItemPathFromSector(currentItem, params.sourceSector)
  const normalizedSharedRootPath = normalizeComparablePath(sharedRootPath)
  const normalizedCurrentItemPath = normalizeComparablePath(currentItemPath)

  if (
    normalizedCurrentItemPath !== normalizedSharedRootPath &&
    !normalizedCurrentItemPath.startsWith(`${normalizedSharedRootPath}/`)
  ) {
    throw new HttpError(
      403,
      "O arquivo selecionado nao pertence ao compartilhamento informado.",
    )
  }

  return {
    item: currentItem,
    sector: params.sourceSector,
  }
}

async function buildBreadcrumbs(params: {
  requestedSector: SectorDefinition
  pathSector: SectorDefinition
  currentFolderPath: string
  sharedFolder?: SharedFolderSummary | null
}) {
  const breadcrumbs: BreadcrumbItem[] = [
    {
      id: null,
      label: params.requestedSector.label,
      path: params.requestedSector.folderPath,
    },
  ]

  const normalizedCurrentFolderPath = normalizePath(params.currentFolderPath)
  if (!normalizedCurrentFolderPath) {
    return breadcrumbs
  }

  if (!params.sharedFolder) {
    const normalizedSectorPath = normalizePath(params.pathSector.folderPath)
    if (normalizedCurrentFolderPath === normalizedSectorPath) {
      return breadcrumbs
    }

    const sectorSegments = normalizedSectorPath.split("/").filter(Boolean)
    const currentSegments = normalizedCurrentFolderPath.split("/").filter(Boolean)
    const nestedSegments = currentSegments.slice(sectorSegments.length)
    let cumulativePath = normalizedSectorPath

    for (const segment of nestedSegments) {
      cumulativePath = joinPaths(cumulativePath, segment)

      try {
        // eslint-disable-next-line no-await-in-loop
        const item = await getSharePointItemByPath(cumulativePath)
        breadcrumbs.push({
          id: item.id,
          label: item.name,
          path: cumulativePath,
        })
      } catch {
        breadcrumbs.push({
          id: null,
          label: segment,
          path: cumulativePath,
        })
      }
    }

    return breadcrumbs
  }

  const sharedRootItem = await getSharePointItemById(params.sharedFolder.rootItemId)
  const sharedRootPath = buildItemPathFromSector(
    sharedRootItem,
    params.pathSector,
  )

  breadcrumbs.push({
    id: sharedRootItem.id,
    label: sharedRootItem.name,
    path: sharedRootPath,
  })

  if (normalizePath(params.currentFolderPath) === normalizePath(sharedRootPath)) {
    return breadcrumbs
  }

  const sharedRootSegments = normalizePath(sharedRootPath).split("/").filter(Boolean)
  const currentSegments = normalizePath(params.currentFolderPath).split("/").filter(Boolean)
  const nestedSegments = currentSegments.slice(sharedRootSegments.length)
  let cumulativePath = sharedRootPath

  for (const segment of nestedSegments) {
    cumulativePath = joinPaths(cumulativePath, segment)

    try {
      // eslint-disable-next-line no-await-in-loop
      const item = await getSharePointItemByPath(cumulativePath)
      breadcrumbs.push({
        id: item.id,
        label: item.name,
        path: cumulativePath,
      })
    } catch {
      breadcrumbs.push({
        id: null,
        label: segment,
        path: cumulativePath,
      })
    }
  }

  return breadcrumbs
}

async function collectFolderMembers(
  folderId: string,
  metadataByItemId: Map<string, SectorFolderMetadata>,
) {
  const members = new Map<string, UserProfile>()
  const visitedFolders = new Set<string>()

  const visitFolder = async (currentFolderId: string): Promise<void> => {
    if (visitedFolders.has(currentFolderId) || members.size >= MAX_FOLDER_MEMBERS) {
      return
    }

    visitedFolders.add(currentFolderId)
    const children = await listSharePointFolderChildrenByItemId(currentFolderId)

    for (const child of children) {
      const metadata = metadataByItemId.get(child.id) ?? null
      const childProfiles = [
        profileFromMetadata(metadata),
        updatedProfileFromMetadata(metadata),
        extractProfileFromIdentity(child.createdBy),
        extractProfileFromIdentity(child.lastModifiedBy),
      ]

      for (const profile of childProfiles) {
        addUniqueProfile(members, profile)
        if (members.size >= MAX_FOLDER_MEMBERS) {
          return
        }
      }

      if (child.folder) {
        // eslint-disable-next-line no-await-in-loop
        await visitFolder(child.id)
        if (members.size >= MAX_FOLDER_MEMBERS) {
          return
        }
      }
    }
  }

  await visitFolder(folderId)
  return Array.from(members.values())
}

async function collectItemMembers(
  item: SharePointDriveItem,
  metadataByItemId: Map<string, SectorFolderMetadata>,
) {
  if (item.folder) {
    return collectFolderMembers(item.id, metadataByItemId)
  }

  const members = new Map<string, UserProfile>()
  const metadata = metadataByItemId.get(item.id) ?? null

  addUniqueProfile(members, profileFromMetadata(metadata))
  addUniqueProfile(members, updatedProfileFromMetadata(metadata))
  addUniqueProfile(members, extractProfileFromIdentity(item.createdBy))
  addUniqueProfile(members, extractProfileFromIdentity(item.lastModifiedBy))

  return Array.from(members.values())
}

async function collectNestedItemIds(itemId: string) {
  const itemIds = new Set<string>([itemId])
  const visitedFolders = new Set<string>()

  const visit = async (currentFolderId: string): Promise<void> => {
    if (visitedFolders.has(currentFolderId)) {
      return
    }

    visitedFolders.add(currentFolderId)
    const children = await listSharePointFolderChildrenByItemId(currentFolderId)

    for (const child of children) {
      itemIds.add(child.id)

      if (child.folder) {
        // eslint-disable-next-line no-await-in-loop
        await visit(child.id)
      }
    }
  }

  await visit(itemId)
  return Array.from(itemIds)
}

async function permanentlyDeleteItemAndMetadata(params: {
  sector: SectorDefinition
  itemId: string
  requireFolder?: boolean
}) {
  const currentItem = await getSharePointItemById(params.itemId)
  assertItemBelongsToSector(currentItem, params.sector)
  assertItemIsNotFixedSectorFolder(currentItem, params.sector)
  assertItemIsNotVersionHistory(
    currentItem,
    params.sector,
    "Itens do Historico de Versoes nao podem ser excluidos manualmente.",
  )

  if (params.requireFolder && !currentItem.folder) {
    throw new HttpError(400, "Selecione uma pasta valida.")
  }

  const itemIdsToCleanup = currentItem.folder
    ? await collectNestedItemIds(params.itemId)
    : [params.itemId]
  const externalItemsToCleanup = currentItem.folder
    ? await listSectorFolderExternalItemsByPathPrefixSafely({
        sectorKey: params.sector.key,
        pathPrefix: buildItemPathFromSector(currentItem, params.sector),
      })
    : []
  const externalItemIdsToCleanup = externalItemsToCleanup.map((item) => item.id)

  await deleteSharePointItemById(params.itemId)
  await Promise.all([
    Promise.all(itemIdsToCleanup.map((itemId) => deleteSectorMetadataSafely(itemId))),
    deleteSectorFolderSharesSafely(itemIdsToCleanup),
    deleteSectorFolderTrashByItemIdsSafely(itemIdsToCleanup),
    deleteSectorFolderUserItemsByItemIdsSafely(itemIdsToCleanup),
    deleteSectorFolderExternalItemsByIdsSafely(externalItemIdsToCleanup),
    deleteSectorFolderTrashByItemIdsSafely(externalItemIdsToCleanup),
    deleteSectorFolderUserItemsByItemIdsSafely(externalItemIdsToCleanup),
  ])
}

async function permanentlyDeleteExternalItem(params: {
  sector: SectorDefinition
  itemId: string
}) {
  const externalItem = await getSectorFolderExternalItemByIdSafely(params.itemId)

  if (!externalItem || externalItem.sectorKey !== params.sector.key) {
    throw new HttpError(404, "Item do setor nao encontrado.")
  }

  await Promise.all([
    deleteSectorFolderExternalItemsByIdsSafely([externalItem.id]),
    deleteSectorFolderTrashByItemIdsSafely([externalItem.id]),
    deleteSectorFolderUserItemsByItemIdsSafely([externalItem.id]),
  ])
}

async function moveItemToTrash(params: {
  sector: SectorDefinition
  itemId: string
  actor: UserProfile
  requireFolder?: boolean
}) {
  const currentItem = await getSharePointItemById(params.itemId)
  assertItemBelongsToSector(currentItem, params.sector)
  assertItemIsNotFixedSectorFolder(currentItem, params.sector)
  assertItemIsNotVersionHistory(
    currentItem,
    params.sector,
    "Itens do Historico de Versoes nao podem ser enviados para a lixeira.",
  )

  if (params.requireFolder && !currentItem.folder) {
    throw new HttpError(400, "Selecione uma pasta valida.")
  }

  await upsertSectorFolderTrashItemSafely({
    itemId: currentItem.id,
    sectorKey: params.sector.key,
    name: currentItem.name,
    path: buildItemPathFromSector(currentItem, params.sector),
    itemType: currentItem.folder ? "folder" : "file",
    extension: currentItem.folder
      ? null
      : path.extname(currentItem.name).toLowerCase() || null,
    size: currentItem.folder ? null : Number(currentItem.size ?? 0),
    webUrl: currentItem.webUrl ?? null,
    deletedByName: params.actor.displayName,
    deletedByEmail: params.actor.email,
    deletedByUsername: params.actor.username,
    deletedAt: new Date(),
  })
}

async function moveExternalItemToTrash(params: {
  sector: SectorDefinition
  itemId: string
  actor: UserProfile
}) {
  const externalItem = await getSectorFolderExternalItemByIdSafely(params.itemId)

  if (!externalItem || externalItem.sectorKey !== params.sector.key) {
    throw new HttpError(404, "Item do setor nao encontrado.")
  }

  await upsertSectorFolderTrashItemSafely({
    itemId: externalItem.id,
    sectorKey: params.sector.key,
    name: externalItem.name,
    path: externalItem.path,
    itemType: "file",
    extension:
      externalItem.linkType === YOUTUBE_EXTERNAL_ITEM_TYPE ? ".youtube" : null,
    size: null,
    webUrl: buildExternalLinkOpenUrl(externalItem),
    deletedByName: params.actor.displayName,
    deletedByEmail: params.actor.email,
    deletedByUsername: params.actor.username,
    deletedAt: new Date(),
  })
}

function buildTrashPathIndex(trashRows: SectorFolderTrashRecord[]) {
  const pathIndex = new Map<string, string[]>()

  trashRows.forEach((trashRow) => {
    const sectorPaths = pathIndex.get(trashRow.SETOR_CHAVE) ?? []
    sectorPaths.push(normalizeComparablePath(trashRow.CAMINHO))
    pathIndex.set(trashRow.SETOR_CHAVE, sectorPaths)
  })

  return pathIndex
}

function isPathHiddenByTrash(
  sectorKey: string,
  itemPath: string,
  trashPathIndex: Map<string, string[]>,
) {
  const sectorTrashPaths = trashPathIndex.get(sectorKey) ?? []
  const normalizedItemPath = normalizeComparablePath(itemPath)

  return sectorTrashPaths.some(
    (trashPath) =>
      normalizedItemPath === trashPath ||
      normalizedItemPath.startsWith(`${trashPath}/`),
  )
}

export const listFolderContents = asyncHandler(
  async (req: Request, res: Response) => {
    ensureSharePointIsAvailable()

    const requestedSector = parseSectorFromQuery(req)
    const view = parseDirectoryView(req.query.view)
    const isVersionHistoryView = view === "version-history"
    const username = parseOptionalUsername(req.query.username)
    const parentItemId = parseParentItemId(req.query.parentItemId)
    const sourceSector = parseOptionalSector(req.query.sourceSector)
    const sharedRootItemId = parseParentItemId(req.query.sharedRootItemId)
    await ensureSectorStructure(requestedSector)
    const versionHistoryRootPath = buildSectorVersionHistoryRootPath(requestedSector)

    const parentContext =
      !parentItemId || view === "deleted"
        ? {
            currentFolder: null,
            currentFolderPath: isVersionHistoryView
              ? versionHistoryRootPath
              : requestedSector.folderPath,
            pathSector: requestedSector,
            sharedFolder: null,
          }
        : await resolveParentContext({
            requestedSector,
            parentItemId,
            sourceSector,
            sharedRootItemId,
          })

    if (isVersionHistoryView) {
      if (
        !isSectorVersionHistoryPath(
          requestedSector,
          parentContext.currentFolderPath,
        )
      ) {
        throw new HttpError(
          404,
          "A pasta selecionada nao pertence ao Historico de Versoes.",
        )
      }
    } else if (
      isSectorVersionHistoryPath(requestedSector, parentContext.currentFolderPath)
    ) {
      throw new HttpError(
        404,
        "O Historico de Versoes fica disponivel apenas no menu lateral dedicado.",
      )
    }

    const targetShares = await listSectorFolderSharesByTargetSafely(
      requestedSector.key,
    )
    const shareByRootItemId = new Map(
      targetShares.map((share) => [share.SHAREPOINT_ITEM_ID, share]),
    )

    const trashRowsBySector = new Map<string, SectorFolderTrashRecord[]>()
    const ensureSectorTrashRows = async (sectorKey: string) => {
      if (trashRowsBySector.has(sectorKey)) {
        return trashRowsBySector.get(sectorKey) ?? []
      }

      const rows = await listSectorFolderTrashItemsSafely(sectorKey)
      trashRowsBySector.set(sectorKey, rows)
      return rows
    }

    await ensureSectorTrashRows(requestedSector.key)
    if (parentContext.pathSector.key !== requestedSector.key) {
      await ensureSectorTrashRows(parentContext.pathSector.key)
    }

    const itemEntries: Array<{
      item: SharePointDriveItem
      sector: SectorDefinition
      sharedFolder: SharedFolderSummary | null
      readOnly: boolean
      isFavorite: boolean
    }> = []

    const deletedItemResponses: Array<Record<string, unknown>> = []
    const externalItemResponses: Array<Record<string, unknown>> = []

    if (parentContext.currentFolder) {
      const parentTrashRecord = await getSectorFolderTrashByItemIdSafely(
        parentContext.currentFolder.id,
      )
      if (parentTrashRecord) {
        throw new HttpError(404, "A pasta selecionada esta na lixeira.")
      }

      const items = await listSharePointFolderChildrenByItemId(
        parentContext.currentFolder.id,
      )
      const currentTrashRows =
        trashRowsBySector.get(parentContext.pathSector.key) ?? []
      const trashPathIndex = buildTrashPathIndex(currentTrashRows)
      const visibleItems = items.filter((item) => {
        const itemPath = buildItemPathFromSector(item, parentContext.pathSector)
        return !isPathHiddenByTrash(
          parentContext.pathSector.key,
          itemPath,
          trashPathIndex,
        )
      })
      const trashedItemIds = new Set(
        currentTrashRows.map((trashRow) => buildUserRelationKey(trashRow.SHAREPOINT_ITEM_ID)),
      )
      const externalItems =
        await listSectorFolderExternalItemsByParentSafely({
          sectorKey: parentContext.pathSector.key,
          parentItemId: parentContext.currentFolder.id,
        })
      externalItemResponses.push(
        ...externalItems
          .filter(
            (item) =>
              !trashedItemIds.has(buildUserRelationKey(item.id)) &&
              !isPathHiddenByTrash(
                parentContext.pathSector.key,
                item.path,
                trashPathIndex,
              ),
          )
          .map((item) =>
            buildExternalItemResponse({
              item,
              sector: parentContext.pathSector,
              sharedFolder: parentContext.sharedFolder,
              readOnly:
                Boolean(parentContext.sharedFolder) || isVersionHistoryView,
            }),
          ),
      )

      const favoriteRelations =
        username && visibleItems.length > 0
          ? await listSectorFolderUserRelationsByItemIdsSafely({
              viewerSectorKey: requestedSector.key,
              username,
              itemIds: visibleItems.map((item) => item.id),
            })
          : []
      const favoriteItemIds = new Set(
        favoriteRelations
          .filter((relation) => Boolean(relation.FAVORITO))
          .map((relation) => buildUserRelationKey(relation.SHAREPOINT_ITEM_ID)),
      )

      itemEntries.push(
        ...visibleItems.map((item) => ({
          item,
          sector: parentContext.pathSector,
          sharedFolder: parentContext.sharedFolder,
          readOnly: Boolean(parentContext.sharedFolder) || isVersionHistoryView,
          isFavorite: favoriteItemIds.has(buildUserRelationKey(item.id)),
        })),
      )

      if (username) {
        await registerSectorFolderAccessSafely({
          itemId: parentContext.currentFolder.id,
          viewerSectorKey: requestedSector.key,
          sourceSectorKey: parentContext.pathSector.key,
          sharedRootItemId: parentContext.sharedFolder?.rootItemId ?? null,
          username,
        })
      }
    } else if (view === "deleted") {
      const trashRows = trashRowsBySector.get(requestedSector.key) ?? []
      const metadataRows = await listSectorMetadataSafely(requestedSector.label)
      const metadataByItemId = new Map(
        metadataRows.map((metadata) => [metadata.itemId, metadata]),
      )
      const externalItems = await listSectorFolderExternalItemsByIdsSafely(
        trashRows.map((trashRow) => trashRow.SHAREPOINT_ITEM_ID),
      )
      const externalItemById = new Map(
        externalItems.map((item) => [item.id, item]),
      )

      deletedItemResponses.push(
        ...trashRows.map((trashRow) =>
          buildDeletedItemResponse({
            trash: trashRow,
            metadata: metadataByItemId.get(trashRow.SHAREPOINT_ITEM_ID) ?? null,
            externalItem:
              externalItemById.get(trashRow.SHAREPOINT_ITEM_ID) ?? null,
            sourceSector: requestedSector,
            isFavorite: false,
          }),
        ),
      )
    } else if (view === "version-history") {
      const historyItems = await listSharePointFolderChildren(versionHistoryRootPath)
      const historyTrashIndex = buildTrashPathIndex(
        trashRowsBySector.get(requestedSector.key) ?? [],
      )
      const historyTrashedItemIds = new Set(
        (trashRowsBySector.get(requestedSector.key) ?? []).map((trashRow) =>
          buildUserRelationKey(trashRow.SHAREPOINT_ITEM_ID),
        ),
      )
      const historyRootItem = await getSharePointItemByPath(versionHistoryRootPath)
      const historyExternalItems =
        await listSectorFolderExternalItemsByParentSafely({
          sectorKey: requestedSector.key,
          parentItemId: historyRootItem.id,
        })

      externalItemResponses.push(
        ...historyExternalItems
          .filter(
            (item) =>
              !historyTrashedItemIds.has(buildUserRelationKey(item.id)) &&
              !isPathHiddenByTrash(
                requestedSector.key,
                item.path,
                historyTrashIndex,
              ),
          )
          .map((item) =>
            buildExternalItemResponse({
              item,
              sector: requestedSector,
              readOnly: true,
            }),
          ),
      )

      itemEntries.push(
        ...historyItems
          .filter((item) => {
            const itemPath = buildItemPathFromSector(item, requestedSector)
            return !isPathHiddenByTrash(
              requestedSector.key,
              itemPath,
              historyTrashIndex,
            )
          })
          .map((item) => ({
            item,
            sector: requestedSector,
            sharedFolder: null,
            readOnly: true,
            isFavorite: false,
          })),
      )
    } else if (view === "recent" || view === "favorites") {
      const userRecords =
        username == null
          ? []
          : view === "recent"
            ? await listRecentSectorFolderUserItemsSafely({
                viewerSectorKey: requestedSector.key,
                username,
              })
            : await listFavoriteSectorFolderUserItemsSafely({
                viewerSectorKey: requestedSector.key,
                username,
              })

      for (const record of userRecords) {
        const recordSourceSector = resolveSector(record.SETOR_ORIGEM_CHAVE)
        if (!recordSourceSector) {
          continue
        }

        await ensureSectorTrashRows(recordSourceSector.key)
        const recordTrashIndex = buildTrashPathIndex(
          trashRowsBySector.get(recordSourceSector.key) ?? [],
        )

        try {
          // eslint-disable-next-line no-await-in-loop
          const item = await getSharePointItemById(record.SHAREPOINT_ITEM_ID)
          if (!item.folder || !itemBelongsToSector(item, recordSourceSector)) {
            continue
          }

          const itemPath = buildItemPathFromSector(item, recordSourceSector)
          if (isSectorVersionHistoryPath(recordSourceSector, itemPath)) {
            continue
          }
          if (
            isPathHiddenByTrash(
              recordSourceSector.key,
              itemPath,
              recordTrashIndex,
            )
          ) {
            continue
          }

          let sharedFolder: SharedFolderSummary | null = null
          let readOnly = false

          if (recordSourceSector.key !== requestedSector.key) {
            const shareRootId =
              record.RAIZ_COMPARTILHADA_ITEM_ID ?? record.SHAREPOINT_ITEM_ID
            const share = shareByRootItemId.get(shareRootId)
            if (!share) {
              continue
            }

            sharedFolder = buildSharedFolderSummary(recordSourceSector, share)
            readOnly = true
          }

          itemEntries.push({
            item,
            sector: recordSourceSector,
            sharedFolder,
            readOnly,
            isFavorite: Boolean(record.FAVORITO),
          })
        } catch (error) {
          if (isSharePointNotFoundError(error)) {
            continue
          }

          throw error
        }
      }
    } else {
      if (view === "all") {
        const ownItems = await listSharePointFolderChildren(
          requestedSector.folderPath,
        )
        const ownTrashIndex = buildTrashPathIndex(
          trashRowsBySector.get(requestedSector.key) ?? [],
        )
        const ownTrashedItemIds = new Set(
          (trashRowsBySector.get(requestedSector.key) ?? []).map((trashRow) =>
            buildUserRelationKey(trashRow.SHAREPOINT_ITEM_ID),
          ),
        )

        itemEntries.push(
          ...ownItems
            .filter((item) => {
              const itemPath = buildItemPathFromSector(item, requestedSector)
              return !isSectorVersionHistoryRootItem(item, requestedSector) &&
                !isPathHiddenByTrash(
                requestedSector.key,
                itemPath,
                ownTrashIndex,
              )
            })
            .map((item) => ({
              item,
              sector: requestedSector,
              sharedFolder: null,
              readOnly: false,
              isFavorite: false,
            })),
        )

        const rootExternalItems =
          await listSectorFolderExternalItemsByParentSafely({
            sectorKey: requestedSector.key,
            parentItemId: null,
          })
        externalItemResponses.push(
          ...rootExternalItems
            .filter(
              (item) =>
                !ownTrashedItemIds.has(buildUserRelationKey(item.id)) &&
                !isPathHiddenByTrash(
                  requestedSector.key,
                  item.path,
                  ownTrashIndex,
                ),
            )
            .map((item) =>
              buildExternalItemResponse({
                item,
                sector: requestedSector,
              }),
            ),
        )
      }

      if (view === "all" || view === "shared") {
        for (const share of targetShares) {
          const sharedSourceSector = resolveSector(share.SETOR_ORIGEM_CHAVE)
          if (!sharedSourceSector) {
            continue
          }

          await ensureSectorTrashRows(sharedSourceSector.key)

          try {
            // eslint-disable-next-line no-await-in-loop
            const sharedItem = await getSharePointItemById(
              share.SHAREPOINT_ITEM_ID,
            )
            if (
              !sharedItem.folder ||
              !itemBelongsToSector(sharedItem, sharedSourceSector)
            ) {
              // eslint-disable-next-line no-await-in-loop
              await deleteSectorFolderSharesSafely([share.SHAREPOINT_ITEM_ID])
              continue
            }

            const sharedItemPath = buildItemPathFromSector(
              sharedItem,
              sharedSourceSector,
            )
            const sharedTrashIndex = buildTrashPathIndex(
              trashRowsBySector.get(sharedSourceSector.key) ?? [],
            )
            if (
              isPathHiddenByTrash(
                sharedSourceSector.key,
                sharedItemPath,
                sharedTrashIndex,
              )
            ) {
              continue
            }

            itemEntries.push({
              item: sharedItem,
              sector: sharedSourceSector,
              sharedFolder: buildSharedFolderSummary(sharedSourceSector, share),
              readOnly: true,
              isFavorite: false,
            })
          } catch (error) {
            if (isSharePointNotFoundError(error)) {
              // eslint-disable-next-line no-await-in-loop
              await deleteSectorFolderSharesSafely([share.SHAREPOINT_ITEM_ID])
              continue
            }

            throw error
          }
        }
      }

      if (username && itemEntries.length > 0) {
        const favoriteRelations =
          await listSectorFolderUserRelationsByItemIdsSafely({
            viewerSectorKey: requestedSector.key,
            username,
            itemIds: itemEntries.map((entry) => entry.item.id),
          })
        const favoriteIds = new Set(
          favoriteRelations
            .filter((relation) => Boolean(relation.FAVORITO))
            .map((relation) => buildUserRelationKey(relation.SHAREPOINT_ITEM_ID)),
        )

        itemEntries.forEach((entry) => {
          entry.isFavorite = favoriteIds.has(buildUserRelationKey(entry.item.id))
        })
      }
    }

    const metadataSectorLabels = new Set<string>([
      requestedSector.label,
      parentContext.pathSector.label,
      ...itemEntries.map((entry) => entry.sector.label),
    ])

    const metadataRows =
      deletedItemResponses.length > 0 && itemEntries.length === 0
        ? await listSectorMetadataSafely(requestedSector.label)
        : (
            await Promise.all(
              Array.from(metadataSectorLabels).map((sectorLabel) =>
                listSectorMetadataSafely(sectorLabel),
              ),
            )
          ).flat()
    const metadataByItemId = new Map(
      metadataRows.map((metadata) => [metadata.itemId, metadata]),
    )

    const sortedItems = itemEntries.sort((left, right) => {
      if (Boolean(left.item.folder) !== Boolean(right.item.folder)) {
        return left.item.folder ? -1 : 1
      }

      return left.item.name.localeCompare(right.item.name, "pt-BR", {
        sensitivity: "base",
      })
    })

    const responseItems =
      deletedItemResponses.length > 0 && itemEntries.length === 0
        ? deletedItemResponses
        : [
            ...(
              await Promise.all(
            sortedItems.map(async (entry) => {
              const members = await collectItemMembers(entry.item, metadataByItemId)
              return buildItemResponse({
                item: entry.item,
                sector: entry.sector,
                metadata: metadataByItemId.get(entry.item.id) ?? null,
                members,
                sharedFolder: entry.sharedFolder,
                readOnly: entry.readOnly,
                isFavorite: entry.isFavorite,
              })
            }),
              )
            ),
            ...externalItemResponses,
          ].sort((left, right) => {
            if (String(left.itemType ?? "") !== String(right.itemType ?? "")) {
              return String(left.itemType ?? "") === "folder" ? -1 : 1
            }

            return String(left.name ?? "").localeCompare(String(right.name ?? ""), "pt-BR", {
              sensitivity: "base",
            })
          })

    const breadcrumbs =
      view === "deleted" && !parentContext.currentFolder
        ? [
            {
              id: null,
              label: requestedSector.label,
              path: requestedSector.folderPath,
            },
          ]
        : await buildBreadcrumbs({
            requestedSector,
            pathSector: parentContext.pathSector,
            currentFolderPath: parentContext.currentFolderPath,
            sharedFolder: parentContext.sharedFolder,
          })

    res.json({
      sector: {
        key: requestedSector.key,
        label: requestedSector.label,
        folderPath: requestedSector.folderPath,
      },
      view,
      currentFolder: buildCurrentFolderResponse(
        parentContext.currentFolder,
        parentContext.pathSector,
        parentContext.sharedFolder,
        Boolean(parentContext.sharedFolder) || isVersionHistoryView,
      ),
      currentFolderPath: parentContext.currentFolderPath,
      sharedContext: parentContext.sharedFolder,
      breadcrumbs,
      items: responseItems,
    })
  },
)

export const list = listFolderContents

export const create = asyncHandler(async (req: Request, res: Response) => {
  ensureSharePointIsAvailable()

  const body = req.body as Record<string, unknown>
  const sector = parseSectorFromBody(body)
  const actor = parseActor(body)
  const name = parseFolderName(body.name)
  const parentItemId = parseParentItemId(body.parentItemId)
  const now = new Date()
  await ensureSectorStructure(sector)
  const parentContext = await resolveParentContext({
    requestedSector: sector,
    parentItemId,
    sourceSector: null,
    sharedRootItemId: null,
  })

  if (parentContext.sharedFolder) {
    throw new HttpError(
      403,
      "Pastas compartilhadas ficam em modo somente leitura para o setor destinatario.",
    )
  }
  assertPathIsNotVersionHistory(
    parentContext.pathSector,
    parentContext.currentFolderPath,
    "Pastas do Historico de Versoes sao gerenciadas automaticamente e nao aceitam novas subpastas.",
  )

  try {
    const item = await createSharePointFolder({
      relativeParentFolderPath: parentContext.currentFolderPath,
      name,
    })

    const metadata = await upsertSectorMetadataSafely({
      itemId: item.id,
      sector: sector.label,
      name: item.name,
      path: buildItemPathFromSector(item, sector),
      createdByName: actor.displayName,
      createdByEmail: actor.email,
      createdByUsername: actor.username,
      updatedByName: actor.displayName,
      updatedByEmail: actor.email,
      updatedByUsername: actor.username,
      createdAt: now,
      updatedAt: now,
    })

    const responseItem = buildItemResponse({
      item,
      sector,
      metadata,
      members: [],
    })

    res.status(201).json({
      folder: responseItem,
      item: responseItem,
      currentFolderPath: parentContext.currentFolderPath,
    })
  } catch (error) {
    if (isSharePointConflictError(error)) {
      throw new HttpError(409, "Ja existe uma pasta com esse nome neste caminho.")
    }

    throw error
  }
})

export const createYouTubeLink = asyncHandler(
  async (req: Request, res: Response) => {
    ensureSharePointIsAvailable()

    const body = req.body as Record<string, unknown>
    const sector = parseSectorFromBody(body)
    const actor = parseActor(body)
    const parentItemId = parseParentItemId(body.parentItemId)
    const name = parseExternalItemDisplayName(body.name)
    const canonicalUrl = parseCanonicalYouTubeUrl(body.url)
    const now = new Date()
    await ensureSectorStructure(sector)

    const parentContext = await resolveParentContext({
      requestedSector: sector,
      parentItemId,
      sourceSector: null,
      sharedRootItemId: null,
    })

    if (parentContext.sharedFolder) {
      throw new HttpError(
        403,
        "Pastas compartilhadas ficam em modo somente leitura para o setor destinatario.",
      )
    }

    assertPathIsNotVersionHistory(
      parentContext.pathSector,
      parentContext.currentFolderPath,
      "O Historico de Versoes e gerenciado automaticamente e nao aceita links manuais.",
    )

    const sharePointSiblings = parentContext.currentFolder
      ? await listSharePointFolderChildrenByItemId(parentContext.currentFolder.id)
      : await listSharePointFolderChildren(parentContext.currentFolderPath)
    const externalSiblings = await listSectorFolderExternalItemsByParentSafely({
      sectorKey: parentContext.pathSector.key,
      parentItemId: parentContext.currentFolder?.id ?? null,
    })
    const normalizedName = normalizeText(name)
    const hasSharePointConflict = sharePointSiblings.some(
      (item) => normalizeText(item.name) === normalizedName,
    )
    const hasExternalConflict = externalSiblings.some(
      (item) => normalizeText(item.name) === normalizedName,
    )

    if (hasSharePointConflict || hasExternalConflict) {
      throw new HttpError(
        409,
        "Ja existe um item com esse nome neste caminho.",
      )
    }

    const itemPath = joinPaths(parentContext.currentFolderPath, name)
    const externalItem = await createSectorFolderExternalItemSafely({
      sectorKey: parentContext.pathSector.key,
      parentItemId: parentContext.currentFolder?.id ?? null,
      name,
      path: itemPath,
      linkType: YOUTUBE_EXTERNAL_ITEM_TYPE,
      url: canonicalUrl,
      createdByName: actor.displayName,
      createdByEmail: actor.email,
      createdByUsername: actor.username,
      updatedByName: actor.displayName,
      updatedByEmail: actor.email,
      updatedByUsername: actor.username,
      createdAt: now,
      updatedAt: now,
    })

    if (!externalItem) {
      throw new HttpError(
        500,
        "Nao foi possivel criar o link externo no gerenciador.",
      )
    }

    res.status(201).json({
      item: buildExternalItemResponse({
        item: externalItem,
        sector: parentContext.pathSector,
      }),
      currentFolderPath: parentContext.currentFolderPath,
    })
  },
)

export const update = asyncHandler(async (req: Request, res: Response) => {
  ensureSharePointIsAvailable()

  const body = req.body as Record<string, unknown>
  const sector = parseSectorFromBody(body)
  const actor = parseActor(body)
  const name = parseFolderName(body.name)
  const itemId = String(req.params.itemId ?? "").trim()
  await ensureSectorStructure(sector)

  if (!itemId) {
    throw new HttpError(400, "Informe a pasta a ser atualizada.")
  }

  try {
    const currentItem = await getSharePointItemById(itemId)
    if (!currentItem.folder) {
      throw new HttpError(400, "Somente pastas podem ser renomeadas.")
    }

    assertItemBelongsToSector(currentItem, sector)
    assertItemIsNotFixedSectorFolder(currentItem, sector)
    assertItemIsNotVersionHistory(
      currentItem,
      sector,
      "Pastas do Historico de Versoes nao podem ser renomeadas manualmente.",
    )
    const previousItemPath = buildItemPathFromSector(currentItem, sector)
    const previousItemWebUrl = String(currentItem.webUrl ?? "").trim()

    const updatedItem = await updateSharePointItemName({
      itemId,
      name,
    })
    const updatedItemPath = buildItemPathFromSector(updatedItem, sector)
    const updatedItemWebUrl = String(updatedItem.webUrl ?? "").trim()
    const existingMetadata = await getSectorMetadataSafely(itemId)
    const metadata = await upsertSectorMetadataSafely({
      itemId: updatedItem.id,
      sector: sector.label,
      name: updatedItem.name,
      path: updatedItemPath,
      createdByName: existingMetadata?.createdByName ?? actor.displayName,
      createdByEmail: existingMetadata?.createdByEmail ?? actor.email,
      createdByUsername: existingMetadata?.createdByUsername ?? actor.username,
      updatedByName: actor.displayName,
      updatedByEmail: actor.email,
      updatedByUsername: actor.username,
      createdAt:
        existingMetadata?.createdAt ??
        parseDateOrNull(updatedItem.createdDateTime),
      updatedAt: new Date(),
    })
    await updateSectorMetadataPathsByPrefixSafely({
      sector: sector.label,
      oldPathPrefix: previousItemPath,
      newPathPrefix: updatedItemPath,
    })
    await updateSectorFolderExternalItemPathsByPrefixSafely({
      sectorKey: sector.key,
      oldPathPrefix: previousItemPath,
      newPathPrefix: updatedItemPath,
    })
    await updateMaterialPathsByPrefix(previousItemWebUrl, updatedItemWebUrl)
    const metadataRows = await listSectorMetadataSafely(sector.label)
    const metadataByItemId = new Map(
      metadataRows.map((metadataRow) => [metadataRow.itemId, metadataRow]),
    )
    if (metadata) {
      metadataByItemId.set(metadata.itemId, metadata)
    }

    const members = await collectFolderMembers(updatedItem.id, metadataByItemId)

    res.json({
      folder: buildItemResponse({
        item: updatedItem,
        sector,
        metadata,
        members,
      }),
    })
  } catch (error) {
    if (isSharePointNotFoundError(error)) {
      throw new HttpError(404, "Pasta do setor nao encontrada.")
    }

    if (isSharePointConflictError(error)) {
      throw new HttpError(409, "Ja existe uma pasta com esse nome neste caminho.")
    }

    throw error
  }
})

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  ensureSharePointIsAvailable()

  const body = req.body as Record<string, unknown>
  const sector = parseSectorFromBody(body)
  const actor = parseActor(body)
  const parentItemId = parseParentItemId(body.parentItemId)
  const file = req.file

  assertAllowedUploadFile(file)
  await ensureSectorStructure(sector)

  const parentContext = await resolveParentContext({
    requestedSector: sector,
    parentItemId,
    sourceSector: null,
    sharedRootItemId: null,
  })
  if (parentContext.sharedFolder) {
    throw new HttpError(
      403,
      "Pastas compartilhadas ficam em modo somente leitura para o setor destinatario.",
    )
  }
  assertPathIsNotVersionHistory(
    parentContext.pathSector,
    parentContext.currentFolderPath,
    "O Historico de Versoes e gerenciado automaticamente e nao aceita uploads manuais.",
  )
  const requiresValidity =
    Boolean(
      findSectorFixedFolderAncestor(
        parentContext.pathSector,
        parentContext.currentFolderPath,
      )
        ?.requiresValidityForFiles,
    ) && sector.key === "sesmt"
  const fileValidity = parseNormasFileValidity(body, requiresValidity)

  const uploaded = await uploadFileToSharePoint({
    tempFilePath: file.path,
    relativeFolderPath: parentContext.currentFolderPath,
    fileName: file.originalname,
    contentType: file.mimetype,
  })

  const uploadedItem = await getSharePointItemById(uploaded.itemId)
  const now = new Date()
  const metadata = await upsertSectorMetadataSafely({
    itemId: uploadedItem.id,
    sector: sector.label,
    name: uploadedItem.name,
    path: buildItemPathFromSector(uploadedItem, parentContext.pathSector),
    createdByName: actor.displayName,
    createdByEmail: actor.email,
    createdByUsername: actor.username,
    updatedByName: actor.displayName,
    updatedByEmail: actor.email,
    updatedByUsername: actor.username,
    createdAt: parseDateOrNull(uploadedItem.createdDateTime) ?? now,
    updatedAt: now,
    validityMonths: fileValidity.validityMonths,
    validityYears: fileValidity.validityYears,
  })

  // Calcula tempo de leitura estimado para arquivos de documento (PDF, PPT, PPTX, PPS, PPSX)
  if (file && isDocumentExtensionForReadingTime(file.originalname)) {
    calculateReadingTimeSeconds(file.path, file.originalname)
      .then((segundos) => {
        if (segundos !== null) {
          return updateSectorFolderItemReadingTime(uploadedItem.id, segundos)
        }
      })
      .catch(() => {
        // não bloqueia a resposta se o cálculo falhar
      })
  }

  const metadataByItemId = new Map<string, SectorFolderMetadata>()
  if (metadata) {
    metadataByItemId.set(metadata.itemId, metadata)
  }

  const members = await collectItemMembers(uploadedItem, metadataByItemId)

  res.status(201).json({
    item: buildItemResponse({
      item: uploadedItem,
      sector,
      metadata,
      members,
    }),
    currentFolderPath: parentContext.currentFolderPath,
  })
})

export const initUploadFileSession = asyncHandler(
  async (req: Request, res: Response) => {
    ensureSharePointIsAvailable()
    cleanupPendingSectorFolderUploads()

    const body = (req.body ?? {}) as Record<string, unknown>
    const sector = parseSectorFromBody(body)
    const actor = parseActor(body)
    const parentItemId = parseParentItemId(body.parentItemId)
    const fileName = assertAllowedUploadFileName(body.fileName)

    await ensureSectorStructure(sector)

    const parentContext = await resolveParentContext({
      requestedSector: sector,
      parentItemId,
      sourceSector: null,
      sharedRootItemId: null,
    })
    if (parentContext.sharedFolder) {
      throw new HttpError(
        403,
        "Pastas compartilhadas ficam em modo somente leitura para o setor destinatario.",
      )
    }

    assertPathIsNotVersionHistory(
      parentContext.pathSector,
      parentContext.currentFolderPath,
      "O Historico de Versoes e gerenciado automaticamente e nao aceita uploads manuais.",
    )

    const requiresValidity =
      Boolean(
        findSectorFixedFolderAncestor(
          parentContext.pathSector,
          parentContext.currentFolderPath,
        )?.requiresValidityForFiles,
      ) && sector.key === "sesmt"
    const fileValidity = parseNormasFileValidity(body, requiresValidity)

    const session = await createSharePointUploadSession({
      relativeFolderPath: parentContext.currentFolderPath,
      fileName,
    })
    const sessionId = randomUUID()

    pendingSectorFolderUploads.set(sessionId, {
      sectorKey: sector.key,
      actor,
      currentFolderPath: parentContext.currentFolderPath,
      validityMonths: fileValidity.validityMonths,
      validityYears: fileValidity.validityYears,
      fullPath: session.fullPath,
      createdAt: Date.now(),
    })

    res.status(201).json({
      sessionId,
      uploadUrl: session.uploadUrl,
      fileName: session.fileName,
      currentFolderPath: parentContext.currentFolderPath,
      expiresAt: session.expiresAt,
    })
  },
)

export const completeUploadFileSession = asyncHandler(
  async (req: Request, res: Response) => {
    ensureSharePointIsAvailable()
    cleanupPendingSectorFolderUploads()

    const pending = pendingSectorFolderUploads.get(req.params.sessionId)
    if (!pending) {
      throw new HttpError(404, "Sessao de upload nao encontrada ou expirada.")
    }

    if (Date.now() - pending.createdAt > PENDING_SECTOR_FOLDER_UPLOAD_TTL_MS) {
      pendingSectorFolderUploads.delete(req.params.sessionId)
      throw new HttpError(410, "Sessao de upload expirada.")
    }

    const sector = resolveSector(pending.sectorKey)
    if (!sector) {
      pendingSectorFolderUploads.delete(req.params.sessionId)
      throw new HttpError(400, "Informe um setor valido.")
    }

    const uploadedFile = await getSharePointFileByPath(pending.fullPath)
    const uploadedItem = await getSharePointItemById(uploadedFile.id)
    const now = new Date()
    const metadata = await upsertSectorMetadataSafely({
      itemId: uploadedItem.id,
      sector: sector.label,
      name: uploadedItem.name,
      path: buildItemPathFromSector(uploadedItem, sector),
      createdByName: pending.actor.displayName,
      createdByEmail: pending.actor.email,
      createdByUsername: pending.actor.username,
      updatedByName: pending.actor.displayName,
      updatedByEmail: pending.actor.email,
      updatedByUsername: pending.actor.username,
      createdAt: parseDateOrNull(uploadedItem.createdDateTime) ?? now,
      updatedAt: now,
      validityMonths: pending.validityMonths,
      validityYears: pending.validityYears,
    })

    const metadataByItemId = new Map<string, SectorFolderMetadata>()
    if (metadata) {
      metadataByItemId.set(metadata.itemId, metadata)
    }

    const members = await collectItemMembers(uploadedItem, metadataByItemId)
    pendingSectorFolderUploads.delete(req.params.sessionId)

    res.status(201).json({
      item: buildItemResponse({
        item: uploadedItem,
        sector,
        metadata,
        members,
      }),
      currentFolderPath: pending.currentFolderPath,
    })
  },
)

export const getItemVersionImpact = asyncHandler(
  async (req: Request, res: Response) => {
    ensureSharePointIsAvailable()

    const sector = parseSectorFromQuery(req)
    const itemId = String(req.params.itemId ?? "").trim()

    if (!itemId) {
      throw new HttpError(400, "Informe o arquivo a ser versionado.")
    }

    const externalItem = await getSectorFolderExternalItemByIdSafely(itemId)
    if (externalItem && externalItem.sectorKey === sector.key) {
      assertPathIsNotVersionHistory(
        sector,
        externalItem.path,
        "Itens do Historico de Versoes nao podem receber nova versao.",
      )

      const linkedMaterials = await listTrainingMaterialLinksByStoredPaths(
        buildExternalStoredPathCandidates(externalItem),
      )
      const impact = buildVersionImpactResponse(linkedMaterials)

      res.json({
        impact,
        item: {
          id: externalItem.id,
          name: externalItem.name,
          path: externalItem.path,
          webUrl: buildExternalLinkOpenUrl(externalItem),
        },
      })
      return
    }

    const currentItem = await getSharePointItemById(itemId)
    if (currentItem.folder) {
      throw new HttpError(400, "Somente arquivos podem ser versionados.")
    }

    assertItemBelongsToSector(currentItem, sector)
    assertItemIsNotVersionHistory(
      currentItem,
      sector,
      "Arquivos do Historico de Versoes nao podem receber nova versao.",
    )

    const metadata = await getSectorMetadataSafely(itemId)
    const linkedMaterials = await listTrainingMaterialLinksByStoredPaths(
      buildStoredPathCandidates({
        item: currentItem,
        sector,
        metadata,
      }),
    )
    const impact = buildVersionImpactResponse(linkedMaterials)

    res.json({
      impact,
      item: {
        id: currentItem.id,
        name: currentItem.name,
        path: buildItemPathFromSector(currentItem, sector),
        webUrl: currentItem.webUrl ?? null,
      },
    })
  },
)

export const getItemContent = asyncHandler(async (req: Request, res: Response) => {
  ensureSharePointIsAvailable()

  const requestedSector = parseSectorFromQuery(req)
  const sourceSector = parseOptionalSector(req.query.sourceSector)
  const sharedRootItemId = parseParentItemId(req.query.sharedRootItemId)
  const itemId = String(req.params.itemId ?? "").trim()

  if (!itemId) {
    throw new HttpError(400, "Informe o arquivo a ser visualizado.")
  }

  const { item } = await resolveFilePreviewContext({
    requestedSector,
    itemId,
    sourceSector,
    sharedRootItemId,
  })
  const buffer = await downloadSharePointFileContentByItemId({
    itemId: item.id,
  })
  const contentType =
    typeof item.file?.mimeType === "string" && item.file.mimeType.trim()
      ? item.file.mimeType
      : "application/octet-stream"

  res.setHeader("Content-Type", contentType)
  res.setHeader("Content-Length", String(buffer.length))
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(item.name)}`,
  )
  res.setHeader("Cache-Control", "private, max-age=300")
  res.send(buffer)
})

export const versionItem = asyncHandler(async (req: Request, res: Response) => {
  ensureSharePointIsAvailable()

  const body = req.body as Record<string, unknown>
  const sector = parseSectorFromBody(body)
  const actor = parseActor(body)
  const itemId = String(req.params.itemId ?? "").trim()
  const file = req.file
  await ensureSectorStructure(sector)

  if (!itemId) {
    throw new HttpError(400, "Informe o arquivo a ser versionado.")
  }

  const shouldRequireRetraining = parseBooleanFlag(
    body.redoCompletedTrainings ??
      body.refazerTreinamento ??
      body.requireRetraining,
  )
  const now = new Date()

  const externalItem = await getSectorFolderExternalItemByIdSafely(itemId)
  if (externalItem && externalItem.sectorKey === sector.key) {
    if (externalItem.linkType !== YOUTUBE_EXTERNAL_ITEM_TYPE) {
      throw new HttpError(
        400,
        "Este tipo de link externo ainda nao suporta versionamento.",
      )
    }

    assertPathIsNotVersionHistory(
      sector,
      externalItem.path,
      "Itens do Historico de Versoes nao podem receber nova versao.",
    )

    const canonicalUrl = parseCanonicalYouTubeUrl(body.url)
    const linkedMaterials = await listTrainingMaterialLinksByStoredPaths(
      buildExternalStoredPathCandidates(externalItem),
    )
    const impact = buildVersionImpactResponse(linkedMaterials)
    const historyFolderPath = buildExternalItemVersionHistoryFolderPath(
      externalItem,
      sector,
    )
    await ensureSharePointFolder(historyFolderPath)
    const historyFolder = await getSharePointItemByPath(historyFolderPath)
    const versionHistoryItemName = buildVersionHistoryExternalItemName(
      externalItem.name,
      now,
    )
    const historyItem = await createSectorFolderExternalItemSafely({
      sectorKey: sector.key,
      parentItemId: historyFolder.id,
      name: versionHistoryItemName,
      path: joinPaths(historyFolderPath, versionHistoryItemName),
      linkType: externalItem.linkType,
      url: externalItem.url,
      createdByName: actor.displayName,
      createdByEmail: actor.email,
      createdByUsername: actor.username,
      updatedByName: actor.displayName,
      updatedByEmail: actor.email,
      updatedByUsername: actor.username,
      createdAt: now,
      updatedAt: now,
    })

    if (!historyItem) {
      throw new HttpError(
        500,
        "Nao foi possivel arquivar a versao anterior do link do YouTube.",
      )
    }

    const updatedExternalItem = await updateSectorFolderExternalItemSafely({
      itemId: externalItem.id,
      url: canonicalUrl,
      updatedByName: actor.displayName,
      updatedByEmail: actor.email,
      updatedByUsername: actor.username,
      updatedAt: now,
    })

    if (!updatedExternalItem) {
      throw new HttpError(
        500,
        "Nao foi possivel publicar a nova versao do link do YouTube.",
      )
    }

    const archived =
      shouldRequireRetraining && impact.linkedTrainingsCount > 0
        ? await archiveTrainingProgressByTrilhaIds(
            impact.linkedTrainings.map((training) => training.trilhaId),
            now,
          )
        : {
            materiaisArquivados: 0,
            provasArquivadas: 0,
          }

    res.json({
      item: buildExternalItemResponse({
        item: updatedExternalItem,
        sector,
      }),
      impact: {
        ...impact,
        archivedMaterialsCount: archived.materiaisArquivados,
        archivedProofsCount: archived.provasArquivadas,
        retrainingRequested: shouldRequireRetraining,
      },
    })
    return
  }

  assertAllowedUploadFile(file)

  const currentItem = await getSharePointItemById(itemId)
  if (currentItem.folder) {
    throw new HttpError(400, "Somente arquivos podem ser versionados.")
  }

  assertItemBelongsToSector(currentItem, sector)
  assertItemIsNotVersionHistory(
    currentItem,
    sector,
    "Arquivos do Historico de Versoes nao podem receber nova versao.",
  )
  assertMatchingVersionedFileExtension(currentItem, file)

  const existingMetadata = await getSectorMetadataSafely(itemId)
  const currentItemPath = buildItemPathFromSector(currentItem, sector)
  const requiresValidity =
    Boolean(
      findSectorFixedFolderAncestor(sector, currentItemPath)
        ?.requiresValidityForFiles,
    ) && sector.key === "sesmt"
  const hasExplicitValidity =
    body.validadeMeses !== undefined ||
    body.validityMonths !== undefined ||
    body.validadeAnos !== undefined ||
    body.validityYears !== undefined
  const fileValidity = hasExplicitValidity
    ? parseNormasFileValidity(body, requiresValidity)
    : {
        validityMonths: existingMetadata?.validityMonths ?? null,
        validityYears: existingMetadata?.validityYears ?? null,
      }
  const linkedMaterials = await listTrainingMaterialLinksByStoredPaths(
    buildStoredPathCandidates({
      item: currentItem,
      sector,
      metadata: existingMetadata,
    }),
  )
  const impact = buildVersionImpactResponse(linkedMaterials)

  const versionHistoryUpload = await copySharePointItemToFolder({
    itemId: currentItem.id,
    relativeFolderPath: buildVersionHistoryFolderPath(currentItem, sector),
    fileName: buildVersionHistoryFileName(currentItem.name, now),
    contentType:
      typeof currentItem.file?.mimeType === "string"
        ? currentItem.file.mimeType
        : undefined,
  })
  const versionHistoryItem = await getSharePointItemById(versionHistoryUpload.itemId)
  await upsertSectorMetadataSafely({
    itemId: versionHistoryItem.id,
    sector: sector.label,
    name: versionHistoryItem.name,
    path: buildItemPathFromSector(versionHistoryItem, sector),
    createdByName: actor.displayName,
    createdByEmail: actor.email,
    createdByUsername: actor.username,
    updatedByName: actor.displayName,
    updatedByEmail: actor.email,
    updatedByUsername: actor.username,
    createdAt: parseDateOrNull(versionHistoryItem.createdDateTime) ?? now,
    updatedAt: now,
    validityMonths: existingMetadata?.validityMonths ?? null,
    validityYears: existingMetadata?.validityYears ?? null,
  })

  const uploaded = await uploadFileToSharePoint({
    tempFilePath: file.path,
    relativeFolderPath: buildItemParentFolderPath(currentItem, sector),
    fileName: currentItem.name,
    contentType: file.mimetype,
  })

  const updatedItem = await getSharePointItemById(uploaded.itemId)

  if (
    currentItem.webUrl &&
    updatedItem.webUrl &&
    currentItem.webUrl !== updatedItem.webUrl
  ) {
    await replaceMaterialStoredPathExact(currentItem.webUrl, updatedItem.webUrl)
  }

  const metadata = await upsertSectorMetadataSafely({
    itemId: updatedItem.id,
    sector: sector.label,
    name: updatedItem.name,
    path: buildItemPathFromSector(updatedItem, sector),
    createdByName:
      existingMetadata?.createdByName ??
      extractProfileFromIdentity(currentItem.createdBy, true)?.displayName ??
      actor.displayName,
    createdByEmail:
      existingMetadata?.createdByEmail ??
      extractProfileFromIdentity(currentItem.createdBy, true)?.email ??
      actor.email,
    createdByUsername:
      existingMetadata?.createdByUsername ??
      extractProfileFromIdentity(currentItem.createdBy, true)?.username ??
      actor.username,
    updatedByName: actor.displayName,
    updatedByEmail: actor.email,
    updatedByUsername: actor.username,
    createdAt:
      existingMetadata?.createdAt ??
      parseDateOrNull(updatedItem.createdDateTime) ??
      now,
    updatedAt: now,
    validityMonths: fileValidity.validityMonths,
    validityYears: fileValidity.validityYears,
  })

  if (updatedItem.id !== currentItem.id) {
    await Promise.all([
      deleteSectorMetadataSafely(currentItem.id),
      deleteSectorFolderUserItemsByItemIdsSafely([currentItem.id]),
    ])
  }

  const archived =
    shouldRequireRetraining && impact.linkedTrainingsCount > 0
      ? await archiveTrainingProgressByTrilhaIds(
          impact.linkedTrainings.map((training) => training.trilhaId),
          now,
        )
      : {
          materiaisArquivados: 0,
          provasArquivadas: 0,
        }

  const metadataByItemId = new Map<string, SectorFolderMetadata>()
  if (metadata) {
    metadataByItemId.set(metadata.itemId, metadata)
  }

  const members = await collectItemMembers(updatedItem, metadataByItemId)

  res.json({
    item: buildItemResponse({
      item: updatedItem,
      sector,
      metadata,
      members,
    }),
    impact: {
      ...impact,
      archivedMaterialsCount: archived.materiaisArquivados,
      archivedProofsCount: archived.provasArquivadas,
      retrainingRequested: shouldRequireRetraining,
    },
  })
})

export const listFolderShares = asyncHandler(
  async (req: Request, res: Response) => {
    ensureSharePointIsAvailable()

    const sector = parseSectorFromQuery(req)
    const itemId = String(req.params.itemId ?? "").trim()

    if (!itemId) {
      throw new HttpError(400, "Informe a pasta a ser compartilhada.")
    }

    const currentItem = await getSharePointItemById(itemId)
    if (!currentItem.folder) {
      throw new HttpError(400, "Somente pastas podem ser compartilhadas.")
    }

    assertItemBelongsToSector(currentItem, sector)
    assertItemIsNotVersionHistory(
      currentItem,
      sector,
      "Pastas do Historico de Versoes nao podem ser compartilhadas.",
    )

    try {
      const shares = await listSectorFolderSharesByItemId(itemId)
      const responseShares = shares
        .filter((share) => share.SETOR_ORIGEM_CHAVE === sector.key)
        .map((share) => {
          const targetSector = resolveSector(share.SETOR_DESTINO_CHAVE)
          if (!targetSector) {
            return null
          }

          return {
            id: share.ID,
            targetSectorKey: targetSector.key,
            targetSectorLabel: targetSector.label,
            sharedAt: parseDateOrNull(share.COMPARTILHADO_EM)?.toISOString() ?? null,
            sharedBy: {
              displayName: share.COMPARTILHADO_POR_NOME ?? null,
              email: share.COMPARTILHADO_POR_EMAIL ?? null,
              username: share.COMPARTILHADO_POR_USUARIO ?? null,
            },
          }
        })
        .filter(Boolean)

      res.json({
        itemId,
        shares: responseShares,
      })
    } catch (error) {
      if (isSectorFolderShareTableMissingError(error)) {
        throw new HttpError(
          503,
          "Banco sem suporte a compartilhamento de pastas entre setores. Execute a migration de compartilhamento.",
        )
      }

      throw error
    }
  },
)

export const shareFolder = asyncHandler(async (req: Request, res: Response) => {
  ensureSharePointIsAvailable()

  const body = req.body as Record<string, unknown>
  const sector = parseSectorFromBody(body)
  const actor = parseActor(body)
  const itemId = String(req.params.itemId ?? "").trim()
  const targetSectorKeys = parseTargetSectorKeys(body.targetSectorKeys)

  if (!itemId) {
    throw new HttpError(400, "Informe a pasta a ser compartilhada.")
  }

  const currentItem = await getSharePointItemById(itemId)
  if (!currentItem.folder) {
    throw new HttpError(400, "Somente pastas podem ser compartilhadas.")
  }

  assertItemBelongsToSector(currentItem, sector)
  assertItemIsNotVersionHistory(
    currentItem,
    sector,
    "Pastas do Historico de Versoes nao podem ser compartilhadas.",
  )

  try {
    const shares = await syncSectorFolderShares({
      itemId,
      sourceSectorKey: sector.key,
      targetSectorKeys,
      sharedByName: actor.displayName,
      sharedByEmail: actor.email,
      sharedByUsername: actor.username,
    })

    res.json({
      itemId,
      shares: shares
        .map((share) => {
          const targetSector = resolveSector(share.SETOR_DESTINO_CHAVE)
          if (!targetSector) {
            return null
          }

          return {
            id: share.ID,
            targetSectorKey: targetSector.key,
            targetSectorLabel: targetSector.label,
            sharedAt: parseDateOrNull(share.COMPARTILHADO_EM)?.toISOString() ?? null,
          }
        })
        .filter(Boolean),
    })
  } catch (error) {
    if (isSectorFolderShareTableMissingError(error)) {
      throw new HttpError(
        503,
        "Banco sem suporte a compartilhamento de pastas entre setores. Execute a migration de compartilhamento.",
      )
    }

    throw error
  }
})

export const toggleFavoriteFolder = asyncHandler(
  async (req: Request, res: Response) => {
    ensureSharePointIsAvailable()

    const body = req.body as Record<string, unknown>
    const requestedSector = parseSectorFromBody(body)
    const username = parseOptionalUsername(body.username)
    const sourceSector = parseOptionalSector(body.sourceSector) ?? requestedSector
    const sharedRootItemId = parseParentItemId(body.sharedRootItemId)
    const itemId = String(req.params.itemId ?? "").trim()
    const favorite = Boolean(body.favorite)

    if (!itemId) {
      throw new HttpError(400, "Informe a pasta a ser favoritada.")
    }

    if (!username) {
      throw new HttpError(400, "Informe o usuario responsavel pelos favoritos.")
    }

    const context = await resolveParentContext({
      requestedSector,
      parentItemId: itemId,
      sourceSector: sourceSector.key === requestedSector.key ? null : sourceSector,
      sharedRootItemId:
        sourceSector.key === requestedSector.key
          ? null
          : sharedRootItemId ?? itemId,
    })

    if (!context.currentFolder?.folder) {
      throw new HttpError(400, "Somente pastas podem ser marcadas como favoritas.")
    }

    assertItemIsNotVersionHistory(
      context.currentFolder,
      context.pathSector,
      "Pastas do Historico de Versoes nao podem ser marcadas como favoritas.",
    )

    await setSectorFolderFavoriteSafely({
      itemId: context.currentFolder.id,
      viewerSectorKey: requestedSector.key,
      sourceSectorKey: context.pathSector.key,
      sharedRootItemId: context.sharedFolder?.rootItemId ?? null,
      username,
      favorite,
    })

    res.json({
      itemId: context.currentFolder.id,
      favorite,
    })
  },
)

export const restoreTrashedItem = asyncHandler(
  async (req: Request, res: Response) => {
    ensureSharePointIsAvailable()

    const sector = parseSectorFromQuery(req)
    const itemId = String(req.params.itemId ?? "").trim()

    if (!itemId) {
      throw new HttpError(400, "Informe o item a ser restaurado.")
    }

    const trashRecord = await getSectorFolderTrashByItemIdSafely(itemId)
    if (!trashRecord || trashRecord.SETOR_CHAVE !== sector.key) {
      throw new HttpError(404, "Item da lixeira nao encontrado para este setor.")
    }

    await deleteSectorFolderTrashByItemIdsSafely([itemId])
    res.status(204).send()
  },
)

export const permanentlyDeleteTrashedItem = asyncHandler(
  async (req: Request, res: Response) => {
    ensureSharePointIsAvailable()

    const sector = parseSectorFromQuery(req)
    const itemId = String(req.params.itemId ?? "").trim()

    if (!itemId) {
      throw new HttpError(400, "Informe o item a ser excluido permanentemente.")
    }

    const trashRecord = await getSectorFolderTrashByItemIdSafely(itemId)
    if (!trashRecord || trashRecord.SETOR_CHAVE !== sector.key) {
      throw new HttpError(404, "Item da lixeira nao encontrado para este setor.")
    }

    const externalItem = await getSectorFolderExternalItemByIdSafely(itemId)

    try {
      if (externalItem && externalItem.sectorKey === sector.key) {
        await permanentlyDeleteExternalItem({
          sector,
          itemId,
        })
      } else {
        await permanentlyDeleteItemAndMetadata({
          sector,
          itemId,
          requireFolder: trashRecord.TIPO_ITEM === "folder",
        })
      }
    } catch (error) {
      if (isSharePointNotFoundError(error)) {
        await Promise.all([
          deleteSectorMetadataSafely(itemId),
          deleteSectorFolderSharesSafely([itemId]),
          deleteSectorFolderTrashByItemIdsSafely([itemId]),
          deleteSectorFolderUserItemsByItemIdsSafely([itemId]),
          deleteSectorFolderExternalItemsByIdsSafely([itemId]),
        ])
        res.status(204).send()
        return
      }

      throw error
    }

    res.status(204).send()
  },
)

export const remove = asyncHandler(async (req: Request, res: Response) => {
  ensureSharePointIsAvailable()

  const sector = parseSectorFromQuery(req)
  const actor = parseActor((req.body as Record<string, unknown>) ?? {})
  const itemId = String(req.params.itemId ?? "").trim()

  if (!itemId) {
    throw new HttpError(400, "Informe a pasta a ser removida.")
  }

  try {
    await moveItemToTrash({
      sector,
      itemId,
      actor,
      requireFolder: true,
    })

    res.status(204).send()
  } catch (error) {
    if (isSharePointNotFoundError(error)) {
      throw new HttpError(404, "Pasta do setor nao encontrada.")
    }

    throw error
  }
})

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  ensureSharePointIsAvailable()

  const sector = parseSectorFromQuery(req)
  const actor = parseActor((req.body as Record<string, unknown>) ?? {})
  const itemId = String(req.params.itemId ?? "").trim()

  if (!itemId) {
    throw new HttpError(400, "Informe o item a ser removido.")
  }

  const externalItem = await getSectorFolderExternalItemByIdSafely(itemId)

  try {
    if (externalItem && externalItem.sectorKey === sector.key) {
      await moveExternalItemToTrash({
        sector,
        itemId,
        actor,
      })
    } else {
      await moveItemToTrash({
        sector,
        itemId,
        actor,
      })
    }

    res.status(204).send()
  } catch (error) {
    if (isSharePointNotFoundError(error)) {
      throw new HttpError(404, "Item do setor nao encontrado.")
    }

    throw error
  }
})
