import { describe, expect, test } from 'vite-plus/test';
import { detectPastedFormat, parseWebHighlights } from '~/parse-web-highlights';

const COVER_URL =
  'https://m.media-amazon.com/images/I/71oE-TQupLL._SY160.jpg?auto=format&w=600&fm=auto';
const SOURCE_URL = 'https://read.amazon.co.jp/notebook?ref_=kcr_notebook_lib&language=ja-JP';
const PAGE_URL = 'https://app.web-highlights.com/page/6a65c0f83a7dceccd2caf319';
const TITLE = 'アート・オブ・スペンディングマネー: １度きりの人生で「お金」をどう使うべきか？';

const QUOTE_1 = '本書では、お金を使うことは、数字や計算とはほとんど関係がない。';
const QUOTE_2 = '重要なのは、どれだけお金を持っているかではない。';
const QUOTE_3 = 'だが、お金の使い方に関して言えば、重要でありながら見落とされがちな点がある。';

/** Web Highlights の「Copy Markdown」出力。メモは引用直後のフェンスブロックで来る。 */
const WEB_HIGHLIGHTS_MD = `![Cover Image of ${SOURCE_URL}](${COVER_URL})

# ${TITLE}


🌐 ${SOURCE_URL}
🔗 ${PAGE_URL}

**Tags**: -



**Highlights & Notes**

> ${QUOTE_1}

> ${QUOTE_2}
\`\`\`
chapter 9
\`\`\`

> ${QUOTE_3}
`;

/** Web Highlights の HTML エクスポート。メモは blockquote 直後の .notes で来る。 */
const WEB_HIGHLIGHTS_HTML = `<img style="width: 100px" src="${COVER_URL.replace('&', '&amp;')}" alt="Tumbnail">
<header>
  <span style="color: #757575; font-size: 12px">2026 July 26</span>
  <h1 style="font-size: 24px">${TITLE}</h1>
  <div class="link-wrapper">
    <a target="_blank" href="${SOURCE_URL.replace('&', '&amp;')}">${SOURCE_URL}</a>
  </div>
  <div class="link-wrapper">
    <a target="_blank" href="${PAGE_URL}">${PAGE_URL}</a>
  </div>
</header>
<div class="tags-container"><span style="font-size: 12px">No Tags found.</span></div>
<section class="marks-container">
  <blockquote class="media-type-blockquote" style="border-color: rgb(255, 255, 0);">${QUOTE_1}</blockquote>
  <blockquote class="media-type-blockquote" style="border-color: rgb(255, 255, 0);">${QUOTE_2}</blockquote>
  <div class="notes"><p>chapter 9</p></div>
  <blockquote class="media-type-blockquote" style="border-color: rgb(255, 255, 0);">${QUOTE_3}</blockquote>
</section>
`;

describe('detectPastedFormat', () => {
  test('Copy Markdown は markdown 判定', () => {
    expect(detectPastedFormat(WEB_HIGHLIGHTS_MD)).toBe('markdown');
  });

  test('HTML エクスポートは html 判定', () => {
    expect(detectPastedFormat(WEB_HIGHLIGHTS_HTML)).toBe('html');
  });

  test('先頭の空白を挟んだ <!DOCTYPE html> も html 判定', () => {
    expect(detectPastedFormat('\n  <!DOCTYPE html>\n<html><body></body></html>')).toBe('html');
  });

  test('本文にインライン <br> を含む markdown は markdown 判定', () => {
    expect(detectPastedFormat('# t\n\n> 引用<br>の続き\n')).toBe('markdown');
  });
});

describe('parseWebHighlights (Copy Markdown)', () => {
  test('メタ情報を全項目パースする', () => {
    const { book, format, unsupportedBlockCount, rawTags } = parseWebHighlights(WEB_HIGHLIGHTS_MD);

    expect(format).toBe('markdown');
    expect(book.title).toBe(TITLE);
    expect(book.coverUrl).toBe(COVER_URL);
    expect(book.bookUrl).toBe(SOURCE_URL);
    // ページ URL は書き出し中で唯一の書籍単位の識別子なので filePath に置く
    expect(book.filePath).toBe(PAGE_URL);
    // Web Highlights は著者 / ASIN / kindle リンクを書き出さない
    expect(book.authors).toEqual([]);
    expect(book.asin).toBeNull();
    expect(book.kindleLink).toBeNull();
    // Copy Markdown は日付を持たない（HTML エクスポートのみ）
    expect(book.lastUpdated).toBeNull();
    expect(book.tags).toEqual([]);
    expect(rawTags).toBe('-');
    expect(unsupportedBlockCount).toBe(0);
  });

  test('引用直後のフェンスブロックを直前ハイライトのメモにする', () => {
    const { book } = parseWebHighlights(WEB_HIGHLIGHTS_MD);

    expect(book.highlights).toEqual([
      { text: QUOTE_1, notes: [] },
      { text: QUOTE_2, notes: ['chapter 9'] },
      { text: QUOTE_3, notes: [] },
    ]);
  });

  test('引用とフェンスの間に空行があってもメモの帰属は変わらない', () => {
    const md = `**Highlights & Notes**

> ${QUOTE_1}

\`\`\`
chapter20
\`\`\`
`;

    expect(parseWebHighlights(md).book.highlights).toEqual([
      { text: QUOTE_1, notes: ['chapter20'] },
    ]);
  });

  test('複数行の引用は 1 ハイライトにまとめる', () => {
    const md = '**Highlights & Notes**\n\n> 一行目\n> 二行目\n';

    expect(parseWebHighlights(md).book.highlights).toEqual([{ text: '一行目\n二行目', notes: [] }]);
  });

  test('見出しが無い書き出しは Tags 行以降を本文として扱う', () => {
    const md = `# t\n\n**Tags**: -\n\n> ${QUOTE_1}\n`;

    expect(parseWebHighlights(md).book.highlights).toEqual([{ text: QUOTE_1, notes: [] }]);
  });

  test('タグが埋まっている場合は # を落として分割する', () => {
    const { book, rawTags } = parseWebHighlights('# t\n\n**Tags**: #投資, #お金\n');

    expect(rawTags).toBe('#投資, #お金');
    expect(book.tags).toEqual(['投資', 'お金']);
  });

  test('引用でもメモでもない非空行は未対応ブロックとして数える', () => {
    const md = `**Highlights & Notes**\n\n> ${QUOTE_1}\n\n## 章タイトル\n`;

    expect(parseWebHighlights(md).unsupportedBlockCount).toBe(1);
  });

  test('ソース URL が単一書籍のものなら ASIN を拾う', () => {
    const md = '# t\n\n🌐 https://read.amazon.co.jp/notebook?asin=B0CFQZ1J8Q\n';

    expect(parseWebHighlights(md).book.asin).toBe('B0CFQZ1J8Q');
  });

  test('🔗 行が無くても本文中のページ URL を filePath に拾う', () => {
    const md = `# t\n\n${PAGE_URL}\n\n**Tags**: -\n`;

    expect(parseWebHighlights(md).book.filePath).toBe(PAGE_URL);
  });

  test('見出しもタグ行も無い書き出しでは未対応ブロックを数えない（誤検知を避ける）', () => {
    const md = `# t\n\n🌐 ${SOURCE_URL}\n\n> ${QUOTE_1}\n`;
    const { book, unsupportedBlockCount } = parseWebHighlights(md);

    expect(book.highlights).toEqual([{ text: QUOTE_1, notes: [] }]);
    expect(unsupportedBlockCount).toBe(0);
  });

  test('ハイライトより前のフェンスブロックは捨てる（帰属先が無い）', () => {
    const md = `**Highlights & Notes**\n\n\`\`\`\n迷子のメモ\n\`\`\`\n\n> ${QUOTE_1}\n`;

    expect(parseWebHighlights(md).book.highlights).toEqual([{ text: QUOTE_1, notes: [] }]);
  });
});

describe('parseWebHighlights (HTML export)', () => {
  test('メタ情報を全項目パースし、日付を ISO で返す', () => {
    const { book, format, unsupportedBlockCount, rawTags } =
      parseWebHighlights(WEB_HIGHLIGHTS_HTML);

    expect(format).toBe('html');
    expect(book.title).toBe(TITLE);
    // href / src の &amp; は復号して Markdown 側と同じ URL になる
    expect(book.coverUrl).toBe(COVER_URL);
    expect(book.bookUrl).toBe(SOURCE_URL);
    expect(book.filePath).toBe(PAGE_URL);
    expect(book.authors).toEqual([]);
    expect(book.asin).toBeNull();
    expect(book.kindleLink).toBeNull();
    expect(book.lastUpdated).toBe('2026-07-26');
    expect(book.tags).toEqual([]);
    expect(rawTags).toBe('No Tags found.');
    expect(unsupportedBlockCount).toBe(0);
  });

  test('blockquote 直後の .notes を直前ハイライトのメモにする', () => {
    const { book } = parseWebHighlights(WEB_HIGHLIGHTS_HTML);

    expect(book.highlights).toEqual([
      { text: QUOTE_1, notes: [] },
      { text: QUOTE_2, notes: ['chapter 9'] },
      { text: QUOTE_3, notes: [] },
    ]);
  });

  test('同じ本の Markdown / HTML はハイライトが一致する', () => {
    expect(parseWebHighlights(WEB_HIGHLIGHTS_HTML).book.highlights).toEqual(
      parseWebHighlights(WEB_HIGHLIGHTS_MD).book.highlights,
    );
  });

  test('blockquote 以外の media-type-* は無視して件数だけ返す', () => {
    const html = `<section class="marks-container">
  <div class="media-type-heading1"><h2>第 1 章</h2></div>
  <blockquote class="media-type-blockquote">${QUOTE_1}</blockquote>
  <div class="media-type-paragraph"><p>本文</p></div>
</section>`;
    const { book, unsupportedBlockCount } = parseWebHighlights(html);

    expect(book.highlights).toEqual([{ text: QUOTE_1, notes: [] }]);
    expect(unsupportedBlockCount).toBe(2);
  });

  test('<br> は改行に、整形由来の改行は空白に潰す', () => {
    const html = `<section class="marks-container">
  <blockquote class="media-type-blockquote">
    一行目<br>二行目
    の続き
  </blockquote>
</section>`;

    expect(parseWebHighlights(html).book.highlights).toEqual([
      { text: '一行目\n二行目 の続き', notes: [] },
    ]);
  });

  test('実体参照を復号する', () => {
    const html =
      '<section class="marks-container"><blockquote class="media-type-blockquote">A &amp; B &lt;C&gt; &#39;D&#39; &#x27;E&#x27;</blockquote></section>';

    expect(parseWebHighlights(html).book.highlights).toEqual([
      { text: "A & B <C> 'D' 'E'", notes: [] },
    ]);
  });

  test('marks-container が無くても blockquote を拾う', () => {
    const html = `<html><body><blockquote class="media-type-blockquote">${QUOTE_1}</blockquote></body></html>`;

    expect(parseWebHighlights(html).book.highlights).toEqual([{ text: QUOTE_1, notes: [] }]);
  });
});
