import { format as formatDate, parse as parseDate } from '@formkit/tempo';
import { compact } from 'es-toolkit';
import { HIGHLIGHTS_SECTION_TITLE } from '~/types/constants';
import type { Book } from '~/types';

/**
 * Web Highlights（https://web-highlights.com/）の書き出しを parse する。
 *
 * Glasp と違い ASIN / 著者 / kindle リンクを一切持たないため、`Book` の識別子項目は
 * null で返る。取込先の決定と欠損項目の補完は preview UI 側の責務。
 */

export type PastedFormat = 'html' | 'markdown';

/**
 * ペースト解析の戻り値。`book` は parseMdContent と同じ `Book` 形で、
 * それ以外は preview に出す診断情報（黙って落とした項目を可視化するため）。
 */
export type WebHighlightsParseResult = {
  book: Book;
  format: PastedFormat;
  /** blockquote 以外の media-type-* ブロック数。無視した件数を preview に出すため。 */
  unsupportedBlockCount: number;
  /** タグ欄の生テキスト。書式が未検証なので、解釈できなくても preview で見えるようにする。 */
  rawTags: string | null;
};

/** Highlights & Notes 見出し（Markdown は `**...**`、Glasp は `### ...`）。 */
const MD_SECTION_MARKER = `**${HIGHLIGHTS_SECTION_TITLE}**`;

const MD_TITLE_RE = /^#\s+(.+)$/m;
const MD_IMAGE_RE = /!\[[^\]]*\]\(\s*(https?:\/\/[^)\s]+)/;
const MD_SOURCE_URL_RE = /^\s*🌐\s*(\S+)/m;
const MD_PAGE_URL_RE = /^\s*🔗\s*(\S+)/m;
const MD_TAGS_LINE_RE = /^\s*\*\*Tags\*\*\s*:?\s*(.*)$/m;
const MD_FENCE_RE = /^\s*(?:```|~~~)/;

const HTML_HEADER_RE = /<header\b[^>]*>([\s\S]*?)<\/header>/i;
const HTML_TITLE_RE = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i;
const HTML_IMG_SRC_RE = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i;
const HTML_DATE_RE = /<span\b[^>]*>\s*(\d{4}\s+[A-Za-z]{3,}\s+\d{1,2})\s*<\/span>/i;
const HTML_HREF_RE = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
const HTML_TAGS_CONTAINER_RE =
  /<div\b[^>]*class\s*=\s*["'][^"']*\btags-container\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;
const HTML_MARKS_CONTAINER_RE =
  /<section\b[^>]*class\s*=\s*["'][^"']*\bmarks-container\b[^"']*["'][^>]*>([\s\S]*)<\/section>/i;
/** blockquote（ハイライト本体）と直後の .notes（メモ）を出現順に拾う。 */
const HTML_MARK_RE =
  /<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>|<div\b[^>]*class\s*=\s*["'][^"']*\bnotes\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
const HTML_MEDIA_TYPE_RE = /\bmedia-type-([A-Za-z0-9]+)\b/g;

/** URL 単体が Web Highlights のものかの判定（先頭から見る）。 */
const WEB_HIGHLIGHTS_URL_RE = /^https?:\/\/[^/]*web-highlights\.com\//i;
/** 🔗 行が見つからない場合に、本文中からページ URL を拾う保険。 */
const WEB_HIGHLIGHTS_PAGE_IN_TEXT_RE = /https?:\/\/[^\s)"']*web-highlights\.com\/page\/\S+/i;

/** タグ欄が「無し」を表す既知の文言。これ以外は素直にタグとして割る。 */
const NO_TAGS_MARKERS = ['-', '—', 'ー', 'なし', 'no tags found.', 'no tags found'];

const NAMED_ENTITIES = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
]);

const MONTHS = new Map([
  ['jan', 1],
  ['feb', 2],
  ['mar', 3],
  ['apr', 4],
  ['may', 5],
  ['jun', 6],
  ['jul', 7],
  ['aug', 8],
  ['sep', 9],
  ['oct', 10],
  ['nov', 11],
  ['dec', 12],
]);

/**
 * ペーストされた文字列の書式を判定する。
 *
 * Copy Markdown は必ず表紙画像か見出しで始まり、HTML エクスポートは必ずタグで始まる。
 * `<!DOCTYPE` / `<html` / `<img` を個別に見る必要は無く、先頭が `<` かどうかで足りる。
 * 本文中のインライン `<br>` は先頭に来ないので markdown 判定になる。
 */
export function detectPastedFormat(input: string): PastedFormat {
  return input.trimStart().startsWith('<') ? 'html' : 'markdown';
}

/** ペーストされた Web Highlights の書き出しを Book へ写像する。書式は自動判定。 */
export function parseWebHighlights(input: string): WebHighlightsParseResult {
  return detectPastedFormat(input) === 'html' ? parseHtmlExport(input) : parseMarkdownExport(input);
}

// ---------------------------------------------------------------------------
// Markdown（Copy Markdown）
// ---------------------------------------------------------------------------

/**
 * 見出し行を境に header（メタ情報）と body（ハイライト）へ割る。
 * 見出しがローカライズ等で見つからない場合は Tags 行以降を body として扱い、
 * それも無ければ全体を両方に使う（0 件で返すより退化させる）。
 */
function splitMarkdown(content: string) {
  const markerIdx = content.indexOf(MD_SECTION_MARKER);

  if (markerIdx >= 0) {
    return {
      header: content.slice(0, markerIdx),
      body: content.slice(markerIdx + MD_SECTION_MARKER.length),
      anchored: true,
    };
  }

  const tagsMatch = content.match(MD_TAGS_LINE_RE);

  if (tagsMatch?.index !== undefined) {
    const end = tagsMatch.index + tagsMatch[0].length;
    return { header: content.slice(0, end), body: content.slice(end), anchored: true };
  }

  return { header: content, body: content, anchored: false };
}

function parseMarkdownExport(input: string): WebHighlightsParseResult {
  const content = input.replace(/\r\n?/g, '\n');
  const { header, body, anchored } = splitMarkdown(content);

  // 1 行目は表紙画像なので、タイトルは行頭 `# ` を header 内から探す
  const title = (header.match(MD_TITLE_RE)?.[1] ?? '').trim();
  const coverUrl = header.match(MD_IMAGE_RE)?.[1] ?? null;

  const pageUrl =
    header.match(MD_PAGE_URL_RE)?.[1] ?? header.match(WEB_HIGHLIGHTS_PAGE_IN_TEXT_RE)?.[0] ?? null;
  const sourceUrl = header.match(MD_SOURCE_URL_RE)?.[1] ?? null;
  const bookUrl = sourceUrl !== null && !isWebHighlightsUrl(sourceUrl) ? sourceUrl : null;

  const rawTags = header.match(MD_TAGS_LINE_RE)?.[1]?.trim() ?? null;

  const { highlights, strayLineCount } = parseMarkdownBody(body);

  return {
    book: {
      filePath: pageUrl ?? '',
      title,
      coverUrl,
      // Web Highlights は著者を書き出さない。preview で補完する
      authors: [],
      bookUrl,
      kindleLink: null,
      asin: asinFromUrl(bookUrl),
      // Copy Markdown には日付が無い（HTML エクスポートのみ持つ）
      lastUpdated: null,
      tags: parseTagList(rawTags),
      highlights,
    },
    format: 'markdown',
    // 見出しを見つけられなかった場合は body の切り出しが当てにならないので数えない
    unsupportedBlockCount: anchored ? strayLineCount : 0,
    rawTags,
  };
}

/**
 * `> 引用` の連続を 1 ハイライト、直後のフェンス（```）ブロックを直前ハイライトの
 * メモとして拾う。引用でもフェンスでもない非空行は未対応ブロックとして数える。
 */
function parseMarkdownBody(body: string) {
  const highlights: Book['highlights'] = [];
  let quoteLines: string[] = [];
  let fenceLines: string[] | null = null;
  let strayLineCount = 0;

  const flushQuote = () => {
    const text = quoteLines.join('\n').trim();
    quoteLines = [];

    if (text) {
      highlights.push({ text, notes: [] });
    }
  };

  const flushNote = () => {
    const note = (fenceLines ?? []).join('\n').trim();
    const last = highlights.at(-1);
    fenceLines = null;

    if (!note || !last) {
      return;
    }

    highlights[highlights.length - 1] = { ...last, notes: [...last.notes, note] };
  };

  for (const line of body.split('\n')) {
    if (fenceLines !== null) {
      if (MD_FENCE_RE.test(line)) {
        flushNote();
      } else {
        fenceLines.push(line);
      }

      continue;
    }

    if (MD_FENCE_RE.test(line)) {
      // メモは直前のハイライトに付くので、先に引用を確定させる
      flushQuote();
      fenceLines = [];
      continue;
    }

    if (line.startsWith('> ')) {
      quoteLines.push(line.slice(2));
      continue;
    }

    if (line.trimEnd() === '>') {
      quoteLines.push('');
      continue;
    }

    flushQuote();

    if (line.trim()) {
      strayLineCount += 1;
    }
  }

  // 未閉じフェンス / 末尾の引用も取りこぼさない
  if (fenceLines !== null) {
    flushNote();
  }

  flushQuote();

  return { highlights, strayLineCount };
}

// ---------------------------------------------------------------------------
// HTML（HTML export）
// ---------------------------------------------------------------------------

function parseHtmlExport(input: string): WebHighlightsParseResult {
  const header = input.match(HTML_HEADER_RE)?.[1] ?? input;

  const title = htmlToText(input.match(HTML_TITLE_RE)?.[1] ?? '');
  const coverUrl = attrUrl(input.match(HTML_IMG_SRC_RE)?.[1]);

  const hrefs = collectHrefs(header);
  const pageUrl = hrefs.find(isWebHighlightsUrl) ?? null;
  const bookUrl = hrefs.find((href) => !isWebHighlightsUrl(href)) ?? null;

  const rawTags = htmlToText(input.match(HTML_TAGS_CONTAINER_RE)?.[1] ?? '') || null;

  const marks = input.match(HTML_MARKS_CONTAINER_RE)?.[1] ?? input;

  return {
    book: {
      filePath: pageUrl ?? '',
      title,
      coverUrl,
      authors: [],
      bookUrl,
      kindleLink: null,
      asin: asinFromUrl(bookUrl),
      lastUpdated: parseHtmlDate(header) ?? parseHtmlDate(input),
      tags: parseTagList(rawTags),
      highlights: parseHtmlMarks(marks),
    },
    format: 'html',
    unsupportedBlockCount: countUnsupportedBlocks(marks),
    rawTags,
  };
}

function collectHrefs(header: string) {
  const hrefs: string[] = [];

  for (const match of header.matchAll(HTML_HREF_RE)) {
    const href = attrUrl(match[1]);

    if (href !== null) {
      hrefs.push(href);
    }
  }

  return hrefs;
}

/**
 * blockquote と .notes を出現順に走査する。
 * .notes は直前の blockquote に対するメモ（Glasp の `> 引用` → `- メモ` と同じ関係）。
 */
function parseHtmlMarks(marks: string) {
  const highlights: Book['highlights'] = [];

  for (const match of marks.matchAll(HTML_MARK_RE)) {
    const [, quoteHtml, notesHtml] = match;

    if (quoteHtml !== undefined) {
      const text = htmlToText(quoteHtml);

      if (text) {
        highlights.push({ text, notes: [] });
      }

      continue;
    }

    const note = htmlToText(notesHtml ?? '');
    const last = highlights.at(-1);

    if (note && last) {
      highlights[highlights.length - 1] = { ...last, notes: [...last.notes, note] };
    }
  }

  return highlights;
}

/**
 * blockquote 以外の media-type-*（heading / paragraph / image 等）を数える。
 * 対応していないブロックを黙って捨てると「全部取れた」と読めてしまうため、件数を preview に出す。
 */
function countUnsupportedBlocks(marks: string) {
  let count = 0;

  for (const match of marks.matchAll(HTML_MEDIA_TYPE_RE)) {
    if (match[1]?.toLowerCase() !== 'blockquote') {
      count += 1;
    }
  }

  return count;
}

/** `2026 July 26` → `2026-07-26`。月名は 3 文字で引くので略記も通る。 */
function parseHtmlDate(html: string) {
  const raw = html.match(HTML_DATE_RE)?.[1];

  if (!raw) {
    return null;
  }

  const [year, monthName, day] = raw.split(/\s+/);
  const month = MONTHS.get((monthName ?? '').toLowerCase().slice(0, 3));

  if (!year || !month || !day) {
    return null;
  }

  return formatDate(parseDate(`${year}-${month}-${Number(day)}`, 'YYYY-M-D'), 'YYYY-MM-DD');
}

/**
 * HTML 断片を素のテキストへ。
 * ソース整形由来の改行は空白へ潰し、`<br>` とブロック終了タグだけを改行として残す
 * （HTML の空白処理と同じ扱い）。
 */
function htmlToText(html: string) {
  const withBreaks = html
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  const lines = decodeEntities(withBreaks)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim());

  return compact(lines).join('\n');
}

function decodeEntities(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (matched, body: string) => {
    const lower = body.toLowerCase();

    if (lower.startsWith('#')) {
      const isHex = lower.startsWith('#x');
      const code = Number.parseInt(isHex ? lower.slice(2) : lower.slice(1), isHex ? 16 : 10);

      return Number.isNaN(code) || code < 0 || code > 0x10ffff
        ? matched
        : String.fromCodePoint(code);
    }

    return NAMED_ENTITIES.get(lower) ?? matched;
  });
}

// ---------------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------------

/** 属性値の URL。HTML では `&` が `&amp;` になっているため復号する。 */
function attrUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  const url = decodeEntities(value).trim();

  return url || null;
}

function isWebHighlightsUrl(url: string) {
  return WEB_HIGHLIGHTS_URL_RE.test(url);
}

/**
 * タグ欄のテキストをタグ配列へ。
 * 実サンプルは「タグ無し」のみで、埋まっている場合の書式は未検証。
 * 解釈できない形でも throw せず空配列に倒し、生テキストは preview 側で見せる。
 */
function parseTagList(raw: string | null) {
  const value = (raw ?? '').trim();

  if (!value || NO_TAGS_MARKERS.includes(value.toLowerCase())) {
    return [];
  }

  return compact(value.split(/[,、]|\s+/).map((tag) => tag.replace(/^#/, '').trim()));
}

/**
 * Web Highlights は ASIN を書き出さないが、ソース URL が単一書籍のもの
 * （`?asin=` / `/dp/`）なら拾える。ライブラリ一覧 URL の場合は null。
 */
function asinFromUrl(url: string | null) {
  if (!url) {
    return null;
  }

  return (
    url.match(/[?&]asin=([A-Z0-9]{10})/i)?.[1] ?? url.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] ?? null
  );
}
