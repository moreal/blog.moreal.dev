const MAX_TITLE_LENGTH = 300;

export async function readResponsePrefix(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array> {
  if (body === null) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks = await readChunksUntil(reader, maxBytes);
  void reader.cancel().catch(() => {});
  return joinChunksUpTo(chunks, maxBytes);
}

async function readChunksUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (totalBytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalBytes += value.byteLength;
  }
  return chunks;
}

function joinChunksUpTo(chunks: Uint8Array[], maxBytes: number): Uint8Array {
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const joined = new Uint8Array(Math.min(totalBytes, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= joined.length) break;
    const slice = chunk.subarray(0, joined.length - offset);
    joined.set(slice, offset);
    offset += slice.byteLength;
  }
  return joined;
}

export function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const htmlReadAsUtf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const charset = declaredCharset(contentType, htmlReadAsUtf8);
  if (charset === "utf-8" || charset === "utf8") return htmlReadAsUtf8;
  return decodeWithCharset(bytes, charset) ?? htmlReadAsUtf8;
}

function declaredCharset(contentType: string, htmlReadAsUtf8: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const fromMetaTag = /<meta[^>]+charset=["']?([\w-]+)/i.exec(htmlReadAsUtf8)?.[1];
  return (fromHeader ?? fromMetaTag ?? "utf-8").toLowerCase();
}

function decodeWithCharset(bytes: Uint8Array, charset: string): string | null {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return null;
  }
}

export function extractTitle(html: string): string | null {
  const title = openGraphTitle(html) ?? documentTitle(html);
  return title === null ? null : normalizeTitle(title);
}

function openGraphTitle(html: string): string | null {
  const openGraphTag = /<meta[^>]+(?:property|name)=["']og:title["'][^>]*>/i.exec(html)?.[0];
  if (openGraphTag === undefined) return null;
  const contentMatch = /content\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(openGraphTag);
  return nonBlankOrNull(contentMatch?.[1] ?? contentMatch?.[2]);
}

function documentTitle(html: string): string | null {
  return nonBlankOrNull(/<title[^>]*>([\s\S]*?)<\/title/i.exec(html)?.[1]);
}

function nonBlankOrNull(text: string | undefined): string | null {
  return text === undefined || text.trim() === "" ? null : text;
}

function normalizeTitle(raw: string): string {
  return decodeEntities(raw).replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
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
    (entity, hex: string | undefined, decimal: string | undefined, name: string | undefined) => {
      if (hex !== undefined) return characterAt(parseInt(hex, 16)) ?? entity;
      if (decimal !== undefined) return characterAt(parseInt(decimal, 10)) ?? entity;
      return NAMED_ENTITIES[name!.toLowerCase()] ?? entity;
    },
  );
}

function characterAt(codePoint: number): string | null {
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return null;
  }
}
