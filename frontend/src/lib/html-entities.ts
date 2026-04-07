const NAMED_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeNumericEntity(entity: string, base: 10 | 16): string | null {
  const codePoint = Number.parseInt(entity, base);
  if (Number.isNaN(codePoint)) return null;

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return null;
  }
}

export const decodeHtmlEntities = (raw: string): string => {
  if (!raw) return '';

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    return doc.documentElement.textContent || '';
  }

  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_, entity: string) => decodeNumericEntity(entity, 16) ?? `&#x${entity};`)
    .replace(/&#(\d+);/g, (_, entity: string) => decodeNumericEntity(entity, 10) ?? `&#${entity};`)
    .replace(/&(amp|lt|gt|quot|apos);/g, (match, entity: string) => NAMED_ENTITY_MAP[entity] ?? match);
};

export const sanitizeCardText = (value: string): string => decodeHtmlEntities(value);

export const sanitizeCardFields = <T extends { front: string; back: string }>(card: T): T => ({
  ...card,
  front: sanitizeCardText(card.front),
  back: sanitizeCardText(card.back),
});