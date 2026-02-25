type TurmaFolderInput = {
  INICIADO_EM?: Date | string | null
}

function sanitizeFolderSegment(value: string, fallback: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|#%&{}~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return (normalized || fallback).slice(0, 120)
}

function formatFolderDatePtBrSafe(dateValue: Date | string | null | undefined) {
  const date = dateValue instanceof Date ? dateValue : dateValue ? new Date(dateValue) : new Date()
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date

  const dd = String(validDate.getDate()).padStart(2, "0")
  const mm = String(validDate.getMonth() + 1).padStart(2, "0")
  const yyyy = String(validDate.getFullYear())
  const hh = String(validDate.getHours()).padStart(2, "0")
  const min = String(validDate.getMinutes()).padStart(2, "0")

  // SharePoint nao aceita '/' e ':'
  return `${dd}-${mm}-${yyyy} ${hh}.${min}`
}

export function buildCollectiveTrainingSharePointFolder(params: {
  obraLocal: string
  turma: TurmaFolderInput
}) {
  const obraSegment = sanitizeFolderSegment(params.obraLocal || "Matriz", "Matriz")
  const turmaFolderName = sanitizeFolderSegment(
    `Treinamento Coletivo ${formatFolderDatePtBrSafe(params.turma.INICIADO_EM)}`,
    "Treinamento Coletivo",
  )

  return `Treinamentos Ministrados por Instrutores/${obraSegment}/${turmaFolderName}`
}

