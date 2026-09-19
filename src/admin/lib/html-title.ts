const MAX_TITLE = 300;

/** The title lives in <head>; read only the caller’s byte budget, then cancel the stream. */
export async function readResponsePrefix(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array> {
  if (body === null) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (totalBytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalBytes += value.byteLength;
  }
  void reader.cancel().catch(() => {});
  const prefix = new Uint8Array(Math.min(totalBytes, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= prefix.length) break;
    const slice = chunk.subarray(0, prefix.length - offset);
    prefix.set(slice, offset);
    offset += slice.byteLength;
  }
  return prefix;
}

/**
 * Older Korean sites still serve EUC-KR, so the charset cannot be assumed.
 * Charset labels are ASCII, which survives a wrong UTF-8 decode -- so decode
 * once to find the label, then decode again with it if it differs.
 */
export function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const label = (
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(utf8)?.[1] ??
    "utf-8"
  ).toLowerCase();
  if (label === "utf-8" || label === "utf8") return utf8;
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return utf8;
  }
}

/**
 * og:title first: it is the post's own name, where <title> tends to carry a
 * " — 사이트 이름" suffix that nobody wants in an alias.
 */
export function extractTitle(html: string): string | null {
  const openGraphTag = /<meta[^>]+(?:property|name)=["']og:title["'][^>]*>/i.exec(html)?.[0];
  if (openGraphTag !== undefined) {
    const contentMatch = /content\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(openGraphTag);
    const value = contentMatch?.[1] ?? contentMatch?.[2];
    if (value !== undefined && value.trim() !== "") return normalizeTitle(value);
  }
  const documentTitle = /<title[^>]*>([\s\S]*?)<\/title/i.exec(html)?.[1];
  if (documentTitle !== undefined && documentTitle.trim() !== "") return normalizeTitle(documentTitle);
  return null;
}

function normalizeTitle(raw: string): string {
  return decodeEntities(raw).replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi,
    (whole, hex: string | undefined, decimal: string | undefined, name: string | undefined) => {
      try {
        if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
        if (decimal !== undefined) return String.fromCodePoint(parseInt(decimal, 10));
      } catch {
        return whole;
      }
      return NAMED_ENTITIES[name!.toLowerCase()] ?? whole;
    },
  );
}
