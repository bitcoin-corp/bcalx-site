// Small helpers every importer uses. Pure, browser + node.

/** Trim, drop control characters (keep newlines when `multiline`), cap the length. */
export const cleanText = (v, max = 300, multiline = false) => String(v ?? '')
  .replace(multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, multiline ? '' : ' ')
  .trim().slice(0, max);

/** Stable short id for an item's content (FNV-1a 64), so the same item has the same id on every import. */
export function stableId(kind, parts) {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(kind + '\u0000' + parts.join('\u0000'))) { h ^= BigInt(b); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return `${kind}-${h.toString(16).padStart(16, '0')}`;
}

/** Last path segment, lowercased. */
export const baseName = (name) => String(name || '').split(/[\\/]/).pop().toLowerCase();
