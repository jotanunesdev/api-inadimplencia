import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { normalizeCpf } from "../utils/normalizeCpf"
import { comparePassword, hashPassword } from "../utils/password"
import { extractPFunc, readView } from "../services/readViewService"
import {
  getUserByCpf,
  upsertUser,
  updateUserPassword,
  type UserRecord,
} from "../models/userModel"
import { mapReadViewToUser } from "../utils/userMapping"

function sanitizeUser(user?: UserRecord | null) {
  if (!user) return null
  const { HASH_SENHA: _hashSenha, READVIEW_JSON: _readView, ...safe } = user
  return safe
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { cpf, password } = req.body as { cpf?: string; password?: string }

  if (!cpf) {
    throw new HttpError(400, "CPF e obrigatorio")
  }

  const cpfDigits = normalizeCpf(cpf)
  if (cpfDigits.length !== 11) {
    throw new HttpError(400, "CPF invalido")
  }

  const filter = `PPESSOA.CPF='${cpfDigits}' AND PFUNC.CODSITUACAO='A'`

  const readViewResult = await readView({
    dataServerName: "FopFuncData",
    filter,
    context: "CODCOLIGADA=1",
  })

  const pfunc = extractPFunc(readViewResult) as Record<string, string> | null
  if (!pfunc) {
    throw new HttpError(404, "Usuario nao encontrado no ReadView")
  }

  const mapped = mapReadViewToUser({ ...pfunc, CPF: cpfDigits })
  const user = await upsertUser(mapped)
  const safeUser = sanitizeUser(user)

  if (!user?.HASH_SENHA) {
    res.status(409).json({
      error: "PRIMEIRO_ACESSO",
      message: "Senha nao cadastrada. Use o endpoint de primeiro acesso.",
      user: safeUser,
    })
    return
  }

  if (!password) {
    throw new HttpError(400, "Senha e obrigatoria")
  }

  const valid = await comparePassword(password, user.HASH_SENHA)
  if (!valid) {
    throw new HttpError(401, "Senha invalida")
  }

  res.json({ user: safeUser })
})

export const firstAccess = asyncHandler(async (req: Request, res: Response) => {
  const { cpf, dtNascimento, password } = req.body as {
    cpf?: string
    dtNascimento?: string
    password?: string
  }

  if (!cpf || !dtNascimento || !password) {
    throw new HttpError(400, "CPF, data de nascimento e senha sao obrigatorios")
  }

  const cpfDigits = normalizeCpf(cpf)
  if (cpfDigits.length !== 11) {
    throw new HttpError(400, "CPF invalido")
  }

  const filter = `PPESSOA.DTNASCIMENTO='${dtNascimento} 00:00:00.000' AND PPESSOA.CPF='${cpfDigits}' AND PFUNC.CODSITUACAO='A'`

  const readViewResult = await readView({
    dataServerName: "FopFuncData",
    filter,
    context: "CODCOLIGADA=1",
  })

  const pfunc = extractPFunc(readViewResult) as Record<string, string> | null
  if (!pfunc) {
    throw new HttpError(404, "Usuario nao encontrado no ReadView")
  }

  const passwordHash = await hashPassword(password)
  const mapped = mapReadViewToUser({ ...pfunc, CPF: cpfDigits })
  const user = await upsertUser({ ...mapped, hashSenha: passwordHash })

  res.status(201).json({ user: sanitizeUser(user) })
})

export const updatePassword = asyncHandler(async (req: Request, res: Response) => {
  const { cpf } = req.params
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string
    newPassword?: string
  }

  if (!cpf || !currentPassword || !newPassword) {
    throw new HttpError(400, "CPF, senha atual e nova senha sao obrigatorios")
  }

  const cpfDigits = normalizeCpf(cpf)
  const user = await getUserByCpf(cpfDigits)
  if (!user?.HASH_SENHA) {
    throw new HttpError(404, "Usuario nao encontrado ou sem senha cadastrada")
  }

  const valid = await comparePassword(currentPassword, user.HASH_SENHA)
  if (!valid) {
    throw new HttpError(401, "Senha atual invalida")
  }

  const hash = await hashPassword(newPassword)
  const updated = await updateUserPassword(cpfDigits, hash)

  res.json({ user: sanitizeUser(updated) })
})
