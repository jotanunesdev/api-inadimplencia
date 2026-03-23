import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createProfileMessage,
  listProfileMessages,
  setProfileMessageReaction,
  type ProfileMessageReactionType,
} from "../models/profileMessageModel"

const normalizeUsername = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.trim() ?? ""

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const profileUsername = normalizeUsername(String(req.query.profileUsername ?? ""))
  const viewerUsername = normalizeUsername(String(req.query.viewerUsername ?? ""))

  if (!profileUsername) {
    throw new HttpError(400, "profileUsername e obrigatorio")
  }

  const messages = await listProfileMessages({
    profileUsername,
    viewerUsername,
  })

  res.json({ messages })
})

export const postMessage = asyncHandler(async (req: Request, res: Response) => {
  const {
    authorJobTitle,
    authorName,
    authorUsername,
    content,
    parentId,
    profileUsername,
  } = (req.body ?? {}) as {
    authorJobTitle?: string | null
    authorName?: string | null
    authorUsername?: string | null
    content?: string | null
    parentId?: string | null
    profileUsername?: string | null
  }

  const normalizedProfileUsername = normalizeUsername(profileUsername)
  const normalizedAuthorUsername = normalizeUsername(authorUsername)
  const normalizedContent = String(content ?? "").trim()

  if (!normalizedProfileUsername) {
    throw new HttpError(400, "profileUsername e obrigatorio")
  }

  if (!normalizedAuthorUsername) {
    throw new HttpError(400, "authorUsername e obrigatorio")
  }

  if (!normalizedContent) {
    throw new HttpError(400, "content e obrigatorio")
  }

  if (normalizedContent.length > 4000) {
    throw new HttpError(400, "content excede o limite de 4000 caracteres")
  }

  try {
    const id = await createProfileMessage({
      authorJobTitle,
      authorName,
      authorUsername: normalizedAuthorUsername,
      content: normalizedContent,
      parentId,
      profileUsername: normalizedProfileUsername,
    })

    res.status(201).json({ id })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PROFILE_MESSAGE_PARENT_NOT_FOUND"
    ) {
      throw new HttpError(404, "Mensagem pai nao encontrada para este perfil")
    }

    throw error
  }
})

export const reactToMessage = asyncHandler(async (req: Request, res: Response) => {
  const messageId = String(req.params.id ?? "").trim()
  const username = normalizeUsername(String(req.body?.username ?? ""))
  const reactionValue = String(req.body?.reaction ?? "")
    .trim()
    .toLowerCase()

  if (!messageId) {
    throw new HttpError(400, "id da mensagem e obrigatorio")
  }

  if (!username) {
    throw new HttpError(400, "username e obrigatorio")
  }

  let reaction: ProfileMessageReactionType | null = null
  if (reactionValue) {
    if (reactionValue !== "like" && reactionValue !== "dislike") {
      throw new HttpError(400, "reaction invalida")
    }

    reaction = reactionValue
  }

  await setProfileMessageReaction({
    messageId,
    reaction,
    username,
  })

  res.status(204).send()
})
