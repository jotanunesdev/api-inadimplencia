import { normalizeCpf } from "./normalizeCpf"
import type { UpsertUserInput } from "../models/userModel"

export function parseDate(value?: string | null) {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return new Date(`${trimmed.slice(0, 10)}T00:00:00`)
  }

  if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
    const [day, month, year] = trimmed.slice(0, 10).split("/")
    return new Date(`${year}-${month}-${day}T00:00:00`)
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function calculateAge(date: Date | null) {
  if (!date) return null

  const today = new Date()
  let age = today.getFullYear() - date.getFullYear()
  const hasBirthdayPassed =
    today.getMonth() > date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() >= date.getDate())

  if (!hasBirthdayPassed) {
    age -= 1
  }

  return age
}

export function mapReadViewToUser(pfunc: Record<string, string>): UpsertUserInput {
  const dtNascimento = parseDate(pfunc.DTNASCIMENTO)
  const idade = pfunc.IDADE ? Number(pfunc.IDADE) : calculateAge(dtNascimento)

  return {
    cpf: normalizeCpf(pfunc.CPF ?? ""),
    nome: pfunc.NOME ?? null,
    idade: Number.isNaN(idade ?? NaN) ? null : idade,
    sexo: pfunc.SEXO ?? null,
    nomeFilial: pfunc.NOMEFILIAL ?? null,
    dtNascimento,
    cargo: pfunc.NOME_FUNCAO ?? pfunc.CARGO ?? null,
    setor:
      pfunc.NOME_SECAO ??
      pfunc.NOMEDEPARTAMENTO ??
      pfunc.SETOR ??
      null,
    ativo: true,
    readViewJson: JSON.stringify(pfunc),
  }
}
