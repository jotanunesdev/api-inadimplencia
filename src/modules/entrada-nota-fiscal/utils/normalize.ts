export function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export function toNullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return roundDecimal(value);
  }

  const rawValue = String(value).trim();
  const normalized =
    rawValue.includes('.') && rawValue.includes(',')
      ? rawValue.replace(/\./g, '').replace(',', '.')
      : rawValue.replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return roundDecimal(parsed);
}

export function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  return ['true', '1', 'sim', 's', 'yes', 'y'].includes(normalized);
}

export function toDateOnly(value: unknown): string | null {
  const normalized = toNullableString(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function roundDecimal(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
}
