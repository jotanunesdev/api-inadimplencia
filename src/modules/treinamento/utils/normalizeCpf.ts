export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "")
}