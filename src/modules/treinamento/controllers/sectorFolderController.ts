import path from "path"
import type { Request, Response } from "express"
import {
  deleteSectorFolderMetadataByItemId,
  getSectorFolderMetadataByItemId,
  isSectorFolderMetadataSchemaMissingError,
  listSectorFolderMetadataBySector,
  type SectorFolderMetadata,
  upsertSectorFolderMetadata,
} from "../models/sectorFolderModel"
import {
  createSharePointFolder,
  deleteSharePointItemById,
  ensureSharePointFolder,
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
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"

type SectorDefinition = {
  key: string
  label: string
  folderPath: string
  aliases: string[]
}

type UserProfile = {
  displayName: string | null
  email: string | null
  username: string | null
}

type BreadcrumbItem = {
  id: string | null
  label: string
  path: string
}

const MAX_FOLDER_MEMBERS = 8
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".wmv",
  ".m4v",
])

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
  },
  {
    key: "recursos-humanos",
    label: "Recursos Humanos",
    folderPath: "Recursos Humanos",
    aliases: ["recursos humanos", "rh", "gente e gestao"],
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
  const normalizedValue = normalizeText(value)
  if (!normalizedValue) {
    return null
  }

  return (
    SECTORS.find(
      (sector) =>
        sector.key === normalizedValue ||
        normalizeText(sector.label) === normalizedValue ||
        sector.aliases.some(
          (alias) =>
            normalizedValue === alias || normalizedValue.includes(alias),
        ),
    ) ?? null
  )
}

function ensureSharePointIsAvailable() {
  if (!isSharePointEnabled()) {
    throw new HttpError(
      503,
      "SharePoint nao esta habilitado no modulo treinamento.",
    )
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

function parseParentItemId(value: unknown) {
  const itemId = String(value ?? "").trim()
  return itemId || null
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

function assertAllowedUploadFile(file: Express.Multer.File | undefined) {
  if (!file) {
    throw new HttpError(400, "Selecione um arquivo para upload.")
  }

  const extension = path.extname(file.originalname || "").toLowerCase()
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
    throw new HttpError(400, "Apenas arquivos PDF ou de video sao permitidos.")
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

function assertItemBelongsToSector(
  item: SharePointDriveItem,
  sector: SectorDefinition,
) {
  const itemPath = buildItemPathFromSector(item, sector)
  const normalizedItemPath = normalizeComparablePath(itemPath)
  const normalizedSectorPath = normalizeComparablePath(sector.folderPath)

  const belongsToSector =
    normalizedItemPath === normalizedSectorPath ||
    normalizedItemPath.startsWith(`${normalizedSectorPath}/`)

  if (!belongsToSector) {
    throw new HttpError(404, "Item do setor nao encontrado.")
  }
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

function buildItemResponse(params: {
  item: SharePointDriveItem
  sector: SectorDefinition
  metadata: SectorFolderMetadata | null
  members: UserProfile[]
}) {
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
    path: buildItemPathFromSector(params.item, params.sector),
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
  }
}

function buildCurrentFolderResponse(
  item: SharePointDriveItem | null,
  sector: SectorDefinition,
) {
  if (!item) {
    return null
  }

  return {
    id: item.id,
    name: item.name,
    path: buildItemPathFromSector(item, sector),
    webUrl: item.webUrl ?? null,
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

async function resolveParentContext(params: {
  sector: SectorDefinition
  parentItemId: string | null
}) {
  if (!params.parentItemId) {
    return {
      currentFolder: null,
      currentFolderPath: params.sector.folderPath,
    }
  }

  const currentFolder = await getSharePointItemById(params.parentItemId)
  if (!currentFolder.folder) {
    throw new HttpError(400, "Selecione uma pasta valida.")
  }

  assertItemBelongsToSector(currentFolder, params.sector)

  return {
    currentFolder,
    currentFolderPath: buildItemPathFromSector(currentFolder, params.sector),
  }
}

async function buildBreadcrumbs(
  sector: SectorDefinition,
  currentFolderPath: string,
) {
  const breadcrumbs: BreadcrumbItem[] = [
    {
      id: null,
      label: sector.label,
      path: sector.folderPath,
    },
  ]

  const normalizedCurrentFolderPath = normalizePath(currentFolderPath)
  const normalizedSectorPath = normalizePath(sector.folderPath)
  if (!normalizedCurrentFolderPath || normalizedCurrentFolderPath === normalizedSectorPath) {
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

async function deleteItemAndMetadata(params: {
  sector: SectorDefinition
  itemId: string
  requireFolder?: boolean
}) {
  const currentItem = await getSharePointItemById(params.itemId)
  assertItemBelongsToSector(currentItem, params.sector)

  if (params.requireFolder && !currentItem.folder) {
    throw new HttpError(400, "Selecione uma pasta valida.")
  }

  const itemIdsToCleanup = currentItem.folder
    ? await collectNestedItemIds(params.itemId)
    : [params.itemId]

  await deleteSharePointItemById(params.itemId)
  await Promise.all(
    itemIdsToCleanup.map((itemId) => deleteSectorMetadataSafely(itemId)),
  )
}

export const listFolderContents = asyncHandler(
  async (req: Request, res: Response) => {
    ensureSharePointIsAvailable()

    const sector = parseSectorFromQuery(req)
    const parentItemId = parseParentItemId(req.query.parentItemId)
    await ensureSharePointFolder(sector.folderPath)

    const [metadataRows, parentContext] = await Promise.all([
      listSectorMetadataSafely(sector.label),
      resolveParentContext({
        sector,
        parentItemId,
      }),
    ])
    const metadataByItemId = new Map(
      metadataRows.map((metadata) => [metadata.itemId, metadata]),
    )

    const items = parentContext.currentFolder
      ? await listSharePointFolderChildrenByItemId(parentContext.currentFolder.id)
      : await listSharePointFolderChildren(sector.folderPath)

    const sortedItems = items.sort((left, right) => {
      if (Boolean(left.folder) !== Boolean(right.folder)) {
        return left.folder ? -1 : 1
      }

      return left.name.localeCompare(right.name, "pt-BR", {
        sensitivity: "base",
      })
    })

    const responseItems = await Promise.all(
      sortedItems.map(async (item) => {
        const members = await collectItemMembers(item, metadataByItemId)
        return buildItemResponse({
          item,
          sector,
          metadata: metadataByItemId.get(item.id) ?? null,
          members,
        })
      }),
    )

    const breadcrumbs = await buildBreadcrumbs(
      sector,
      parentContext.currentFolderPath,
    )

    res.json({
      sector: {
        key: sector.key,
        label: sector.label,
        folderPath: sector.folderPath,
      },
      currentFolder: buildCurrentFolderResponse(parentContext.currentFolder, sector),
      currentFolderPath: parentContext.currentFolderPath,
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
  const parentContext = await resolveParentContext({
    sector,
    parentItemId,
  })

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

export const update = asyncHandler(async (req: Request, res: Response) => {
  ensureSharePointIsAvailable()

  const body = req.body as Record<string, unknown>
  const sector = parseSectorFromBody(body)
  const actor = parseActor(body)
  const name = parseFolderName(body.name)
  const itemId = String(req.params.itemId ?? "").trim()

  if (!itemId) {
    throw new HttpError(400, "Informe a pasta a ser atualizada.")
  }

  try {
    const currentItem = await getSharePointItemById(itemId)
    if (!currentItem.folder) {
      throw new HttpError(400, "Somente pastas podem ser renomeadas.")
    }

    assertItemBelongsToSector(currentItem, sector)

    const updatedItem = await updateSharePointItemName({
      itemId,
      name,
    })
    const existingMetadata = await getSectorMetadataSafely(itemId)
    const metadata = await upsertSectorMetadataSafely({
      itemId: updatedItem.id,
      sector: sector.label,
      name: updatedItem.name,
      path: buildItemPathFromSector(updatedItem, sector),
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

  const parentContext = await resolveParentContext({
    sector,
    parentItemId,
  })

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
    path: buildItemPathFromSector(uploadedItem, sector),
    createdByName: actor.displayName,
    createdByEmail: actor.email,
    createdByUsername: actor.username,
    updatedByName: actor.displayName,
    updatedByEmail: actor.email,
    updatedByUsername: actor.username,
    createdAt: parseDateOrNull(uploadedItem.createdDateTime) ?? now,
    updatedAt: now,
  })
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

export const remove = asyncHandler(async (req: Request, res: Response) => {
  ensureSharePointIsAvailable()

  const sector = parseSectorFromQuery(req)
  const itemId = String(req.params.itemId ?? "").trim()

  if (!itemId) {
    throw new HttpError(400, "Informe a pasta a ser removida.")
  }

  try {
    await deleteItemAndMetadata({
      sector,
      itemId,
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
  const itemId = String(req.params.itemId ?? "").trim()

  if (!itemId) {
    throw new HttpError(400, "Informe o item a ser removido.")
  }

  try {
    await deleteItemAndMetadata({
      sector,
      itemId,
    })

    res.status(204).send()
  } catch (error) {
    if (isSharePointNotFoundError(error)) {
      throw new HttpError(404, "Item do setor nao encontrado.")
    }

    throw error
  }
})
