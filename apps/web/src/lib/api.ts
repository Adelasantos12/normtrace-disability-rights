const publicApiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export function apiUrl(path: string) {
  if (publicApiBase) {
    return `${publicApiBase}${path}`;
  }
  return path;
}

