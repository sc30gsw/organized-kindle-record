import { describe, expect, test } from 'vite-plus/test';
import { parseMdContent } from '~/parse-md';

/** Glasp エクスポートの最小構成。パーサーはこの形を厳密に前提にしている。 */
const GLASP_MD = `# 世界一流エンジニアの思考法

![](https://m.media-amazon.com/images/I/example.jpg)

- Author: 牛尾 剛
- Book URL: https://www.amazon.co.jp/dp/B0CFQZ1J8Q
- Last Updated on: 2024年5月4日

### Highlights & Notes

> 理解に時間をかける
> ことが結局は近道になる

- 急がば回れ
- 二度目からは速い

> 試行錯誤は「悪」である

[Kindle で開く](kindle://book?action=open&asin=B0CFQZ1J8Q)
`;

describe('parseMdContent', () => {
  test('Glasp 形式の正常系を全項目パースする', () => {
    const book = parseMdContent(GLASP_MD, 'sample.md');

    expect(book.filePath).toBe('sample.md');
    expect(book.title).toBe('世界一流エンジニアの思考法');
    expect(book.coverUrl).toBe('https://m.media-amazon.com/images/I/example.jpg');
    expect(book.authors).toEqual(['牛尾 剛']);
    expect(book.bookUrl).toBe('https://www.amazon.co.jp/dp/B0CFQZ1J8Q');
    expect(book.kindleLink).toBe('kindle://book?action=open&asin=B0CFQZ1J8Q');
    expect(book.asin).toBe('B0CFQZ1J8Q');
    expect(book.lastUpdated).toBe('2024-05-04');
  });

  test('複数行の引用と後続の箇条書きメモを 1 ハイライトにまとめる', () => {
    const book = parseMdContent(GLASP_MD);

    expect(book.highlights).toEqual([
      {
        text: '理解に時間をかける\nことが結局は近道になる',
        notes: ['急がば回れ', '二度目からは速い'],
      },
      { text: '試行錯誤は「悪」である', notes: [] },
    ]);
  });

  test('共著は and / 、 / , / & で分割する', () => {
    const book = parseMdContent('# t\n\n- Author: A and B、C,D & E\n');

    expect(book.authors).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  test('Kindle リンクが無くても Book URL の /dp/ から ASIN を拾う', () => {
    const book = parseMdContent('# t\n\n- Book URL: https://www.amazon.co.jp/dp/B00ABCDEFG\n');

    expect(book.kindleLink).toBeNull();
    expect(book.asin).toBe('B00ABCDEFG');
  });

  test('ASIN の手掛かりが無ければ null（インポーターの重複判定はこれを見る）', () => {
    const book = parseMdContent('# t\n\n- Author: A\n\n### Highlights & Notes\n\n> q\n');

    expect(book.asin).toBeNull();
    expect(book.highlights).toHaveLength(1);
  });

  test('Highlights & Notes セクションが無ければハイライト 0 件', () => {
    const book = parseMdContent('# t\n\n- Author: A\n');

    expect(book.highlights).toEqual([]);
  });

  test('引用の無い箇条書きだけの段落は直前のハイライトのメモになる', () => {
    const md = '# t\n\n### Highlights & Notes\n\n> 引用\n\n- 後から書いたメモ\n';
    const book = parseMdContent(md);

    expect(book.highlights).toEqual([{ text: '引用', notes: ['後から書いたメモ'] }]);
  });

  test('Last Updated が無ければ lastUpdated は null', () => {
    const book = parseMdContent('# t\n\n- Author: A\n');

    expect(book.lastUpdated).toBeNull();
  });

  test('Glasp にタグ欄は無いので tags は常に空（Book の共有項目を退化させない）', () => {
    expect(parseMdContent(GLASP_MD).tags).toEqual([]);
  });
});
