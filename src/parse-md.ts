import { readFileSync } from 'node:fs';
import { compact } from 'es-toolkit';
import { parseGlaspLastUpdated } from '~/lib/glasp-date';
import { HIGHLIGHTS_SECTION_TITLE } from '~/types/constants';

export function parseMd(filePath: string) {
  return parseMdContent(readFileSync(filePath, 'utf-8'), filePath);
}

export function parseMdContent(content: string, filePath = '') {
  const lines = content.split('\n');

  const title = (lines[0] ?? '').replace(/^# /, '').trim();

  const coverMatch = content.match(/^!\[\]\((https?:\/\/[^)]+)\)/m);
  const coverUrl = coverMatch?.[1] ?? null;

  const authorMatch = content.match(/^- Author: (.+)$/m);
  const rawAuthor = authorMatch?.[1]?.trim() ?? '';
  const authors = compact(rawAuthor.split(/ and |、|,|&/).map((a) => a.trim()));

  const bookUrlMatch = content.match(/^- Book URL: (https?:\/\/\S+)/m);
  const bookUrl = bookUrlMatch?.[1] ?? null;

  const kindleLinkMatch = content.match(/\(kindle:\/\/[^)]+\)/);
  const kindleLink = kindleLinkMatch ? kindleLinkMatch[0].slice(1, -1) : null;

  let asin: string | null = null;
  if (kindleLink) {
    asin = kindleLink.match(/[?&]asin=([A-Z0-9]+)/i)?.[1] ?? null;
  }
  if (!asin && bookUrl) {
    asin = bookUrl.match(/\/dp\/([A-Z0-9]+)/i)?.[1] ?? null;
  }

  const lastUpdated = parseGlaspLastUpdated(content);

  const sectionHeading = `### ${HIGHLIGHTS_SECTION_TITLE}`;
  const highlightsSectionIdx = content.indexOf(sectionHeading);
  const highlightsSection =
    highlightsSectionIdx >= 0 ? content.slice(highlightsSectionIdx + sectionHeading.length) : '';

  const highlights = parseHighlights(highlightsSection);

  return {
    filePath,
    title,
    coverUrl,
    authors,
    bookUrl,
    kindleLink,
    asin,
    lastUpdated,
    highlights,
  };
}

function parseHighlights(section: string) {
  const highlights: Array<{ text: string; notes: string[] }> = [];
  const paragraphs = section
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const para of paragraphs) {
    const lines = para.split('\n');
    const textLines: string[] = [];
    const notes: string[] = [];

    for (const line of lines) {
      if (line.startsWith('> ')) {
        textLines.push(line.slice(2));
      } else if (line === '>') {
        textLines.push('');
      } else if (line.startsWith('- ')) {
        notes.push(line.slice(2).trim());
      }
    }

    if (textLines.length > 0) {
      const text = textLines.join('\n').trim();
      if (text) highlights.push({ text, notes });
    } else if (notes.length > 0 && highlights.length > 0) {
      highlights[highlights.length - 1]!.notes.push(...notes);
    }
  }

  return highlights;
}
