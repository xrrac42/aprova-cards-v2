import { decodeHtmlEntities } from '@/lib/html-entities';

export interface ParsedCard {
  front: string;
  back: string;
}

function cleanCardText(text: string): string {
  if (!text) return '';

  let decoded = decodeHtmlEntities(text);
  
  decoded = decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[sound:[^\]]+\]/g, '')
    .replace(/{{[^}]+}}/g, '')
    // Remove emojis e símbolos especiais
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '')
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '')
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
    
  return decoded;
}

export function validateCards(cards: ParsedCard[]): { valid: ParsedCard[]; invalidCount: number; invalidCards: ParsedCard[] } {
  const valid: ParsedCard[] = [];
  const invalidCards: ParsedCard[] = [];
  for (const card of cards) {
    if (card.front.trim() && card.back.trim()) {
      valid.push(card);
    } else {
      invalidCards.push(card);
    }
  }
  return { valid, invalidCount: invalidCards.length, invalidCards };
}

export function parseCSV(content: string): ParsedCard[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const cards: ParsedCard[] = [];

  const start =
    lines[0]?.toLowerCase().includes('frente') || lines[0]?.toLowerCase().includes('front') ? 1 : 0;

  for (let i = start; i < lines.length; i++) {
    const idx = lines[i].indexOf(';');
    if (idx === -1) continue;
    const front = cleanCardText(lines[i].substring(0, idx));
    const back = cleanCardText(lines[i].substring(idx + 1));
    if (front && back) cards.push({ front, back });
  }

  return cards;
}

export function parseJSON(content: string): ParsedCard[] {
  try {
    const data = JSON.parse(content);
    if (!Array.isArray(data)) throw new Error('JSON deve ser um array');

    return data
      .filter((item: any) => (item.frente || item.front) && (item.verso || item.back))
      .map((item: any) => ({
        front: cleanCardText(item.frente || item.front),
        back: cleanCardText(item.verso || item.back),
      }));
  } catch {
    throw new Error('JSON inválido. Use o formato: [{"frente": "...", "verso": "..."}]');
  }
}

export type DetectedFormat = 'GPT (separador |||)' | 'Anki TXT (separador tab)' | 'CSV (separador ;)' | 'TXT (blocos)' | 'CSV' | 'JSON' | 'APKG';

export function parseTXT(content: string): { cards: ParsedCard[]; format: DetectedFormat } {
  const lines = content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  const cards: ParsedCard[] = [];
  let format: DetectedFormat = 'TXT (blocos)';

  for (const line of lines) {
    // Detecta formato GPT (separador |||) — verificar ANTES dos outros
    if (line.includes('|||')) {
      const parts = line.split('|||').map(p => p.trim());
      const front = cleanCardText(parts[0]);
      const back = cleanCardText(parts[1] || '');
      // parts[2] em diante são tags — ignoradas
      if (front && back) cards.push({ front, back });
      format = 'GPT (separador |||)';
      continue;
    }

    if (line.includes('\t')) {
      const parts = line.split('\t');
      const front = cleanCardText(parts[0]);
      const back = cleanCardText(parts[1] || '');
      if (front && back) cards.push({ front, back });
      format = 'Anki TXT (separador tab)';
      continue;
    }

    if (line.includes(';')) {
      const idx = line.indexOf(';');
      const front = cleanCardText(line.substring(0, idx));
      const back = cleanCardText(line.substring(idx + 1));
      if (front && back) cards.push({ front, back });
      format = 'CSV (separador ;)';
    }
  }

  if (cards.length === 0) {
    const blocks = content
      .split(/\n\s*\n/)
      .filter(b => b.trim() && !b.trim().startsWith('#'));
    for (const block of blocks) {
      const blockLines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (blockLines.length >= 2) {
        cards.push({
          front: cleanCardText(blockLines[0]),
          back: cleanCardText(blockLines.slice(1).join(' ')),
        });
      }
    }
    format = 'TXT (blocos)';
  }

  return { cards, format };
}

export async function parseAPKG(file: File): Promise<ParsedCard[]> {
  const JSZip = (await import('jszip')).default;

  // Load sql.js via CDN as global script
  await new Promise<void>((resolve, reject) => {
    if ((window as any).initSqlJs) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/sql-wasm.js';
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const SQL = await (window as any).initSqlJs({
    locateFile: (f: string) =>
      `https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/${f}`,
  });

  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const dbFile = zip.file('collection.anki21') || zip.file('collection.anki2');
  if (!dbFile) throw new Error('Arquivo APKG inválido — banco de dados não encontrado.');

  const dbBuffer = await dbFile.async('arraybuffer');
  const db = new SQL.Database(new Uint8Array(dbBuffer));

  const result = db.exec('SELECT flds FROM notes');
  db.close();

  if (!result || result.length === 0) return [];

  return result[0].values
    .map((row: any) => {
      const fields = String(row[0]).split('\x1f');
      return {
        front: cleanCardText(fields[0] || ''),
        back: cleanCardText(fields[1] || ''),
      };
    })
    .filter((card: ParsedCard) => card.front.length > 0 && card.back.length > 0);
}

export interface ParseResult {
  cards: ParsedCard[];
  format: DetectedFormat;
}

export async function parseFile(file: File): Promise<ParsedCard[]> {
  const result = await parseFileWithFormat(file);
  return result.cards;
}

export async function parseFileWithFormat(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();

  try {
    if (name.endsWith('.apkg')) {
      const cards = await parseAPKG(file);
      return { cards, format: 'APKG' };
    }

    const content = await file.text();

    if (name.endsWith('.json')) return { cards: parseJSON(content), format: 'JSON' };
    if (name.endsWith('.txt')) {
      const result = parseTXT(content);
      return result;
    }
    if (name.endsWith('.csv')) return { cards: parseCSV(content), format: 'CSV' };

    // Auto-detect by content
    if (content.trimStart().startsWith('[') || content.trimStart().startsWith('{'))
      return { cards: parseJSON(content), format: 'JSON' };
    if (content.includes('|||') || content.includes('\t') || content.includes(';')) {
      const result = parseTXT(content);
      return result;
    }
    return { cards: parseCSV(content), format: 'CSV' };
  } catch (err: any) {
    console.error('Erro no parser:', err);
    throw new Error(err.message || 'Erro ao processar o arquivo.');
  }
}
