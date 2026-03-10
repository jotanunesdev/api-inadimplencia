export function buildGraphUrl(
  baseUrl: string,
  pathOrUrl: string,
  query?: Record<string, string | number | undefined>
): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
  const url = new URL(normalizedPath, normalizedBaseUrl);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}
