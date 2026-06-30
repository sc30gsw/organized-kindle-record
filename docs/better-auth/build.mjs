// Better Auth 詳細リファレンス — md → html ビルダー。
// 使い方: node docs/better-auth/build.mjs
// docs/better-auth/ 内の NN-*.md を読み、各 NN-*.html と index.html を生成する。
// レンダラは _renderer.js を読み込み、各 html に self-contained でインライン展開する。
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const SITE_TITLE = "AI が認証し、AI が認証を書く — Better Auth 詳細リファレンス";
const SITE_SUB = "AI Agent 時代の認証ライブラリ Better Auth を理解する（私用・網羅版）";
const renderer = readFileSync(join(DIR, "_renderer.js"), "utf8");

const SURVEY_DATE = "2026-06-24";
const FOOTER =
  '<footer style="margin-top:64px;padding-top:18px;border-top:1px solid var(--border);color:var(--muted);font-size:12px">' +
  "調査日 " + SURVEY_DATE + "・Better Auth は更新の速いライブラリ。最終的な裏取りは一次情報で確認すること。</footer>";

const ROUTE_HTML =
  '<section class="md"><h2>🗺 当日の推奨ルート</h2>' +
  "<p><strong>10分版</strong>（要点だけ）: " +
  '<a href="00-introduction.html">00 Auth.js合流のつかみ</a> → ' +
  '<a href="02-authentication.html">02 認証ざっくり</a> → ' +
  '<a href="03-plugins.html">03 プラグインは代表数個</a> → ' +
  '<a href="07-ai-resources.html">07 AI（山場）</a> → ' +
  '<a href="08-cons.html">08 弱みを一言</a></p>' +
  "<p><strong>20分版</strong>（フル）: " +
  '<a href="00-introduction.html">00</a> → <a href="01-concepts.html">01 コンセプト地図</a> → ' +
  '<a href="02-authentication.html">02</a> → <a href="03-plugins.html">03（Payment含む）</a> → ' +
  '<a href="06-infrastructure.html">06 Infra</a> → <a href="07-ai-resources.html">07 山場（厚め）</a> → ' +
  '<a href="08-cons.html">08 着地</a></p>' +
  '<p><a href="all.html">📄 全章1ページ版（Ctrl-F 横断・印刷用）</a></p></section>';

const CSS = `
  :root{--bg:#0f1115;--panel:#161a22;--text:#e6e9ef;--muted:#9aa4b2;--accent:#7c9cff;--accent2:#58e0c0;--border:#2a3140;--code-bg:#0b0d12;--th-bg:#222838;--max:920px}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--text)}
  body{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif;line-height:1.75;-webkit-font-smoothing:antialiased}
  a{color:var(--accent)}
  .topbar{position:sticky;top:0;z-index:10;background:rgba(15,17,21,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
  .topbar-inner{max-width:var(--max);margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
  .brand{font-weight:700;font-size:13px;color:var(--muted);letter-spacing:.02em;text-decoration:none}
  .brand:hover{color:var(--text)}
  .nav{display:flex;gap:10px;font-size:12px}
  .nav a{color:var(--muted);text-decoration:none;border:1px solid var(--border);padding:5px 10px;border-radius:7px}
  .nav a:hover{color:var(--text);border-color:var(--accent)}
  .spacer{margin-left:auto}
  .tabs{display:flex;gap:6px}
  .tab{appearance:none;cursor:pointer;border:1px solid var(--border);background:var(--panel);color:var(--muted);padding:7px 14px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s}
  .tab:hover{color:var(--text);border-color:var(--accent)}
  .tab[aria-selected="true"]{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#0b0d12;border-color:transparent}
  .copy-btn{appearance:none;cursor:pointer;border:1px solid var(--border);background:var(--panel);color:var(--muted);padding:7px 12px;border-radius:8px;font-size:12px;font-weight:600}
  .copy-btn:hover{color:var(--text);border-color:var(--accent2)}
  main{max-width:var(--max);margin:0 auto;padding:32px 20px 120px}
  .view[hidden]{display:none}
  .pager{display:flex;justify-content:space-between;gap:12px;margin-top:48px;padding-top:20px;border-top:1px solid var(--border);font-size:13px}
  .pager a{color:var(--accent);text-decoration:none;max-width:48%}
  .md h1{font-size:1.9rem;line-height:1.3;margin:0 0 .6em;letter-spacing:.01em}
  .md h2{font-size:1.4rem;margin:2.2em 0 .7em;padding-top:.6em;border-top:1px solid var(--border);color:#fff}
  .md h3{font-size:1.12rem;margin:1.6em 0 .5em;color:var(--accent2)}
  .md h4{font-size:1rem;margin:1.2em 0 .4em;color:var(--accent)}
  .md p{margin:.7em 0}
  .md a{text-decoration:none;border-bottom:1px solid rgba(124,156,255,.35)}
  .md a:hover{border-bottom-color:var(--accent)}
  .md strong{color:#fff;font-weight:700}
  .md ul,.md ol{margin:.6em 0;padding-left:1.5em}
  .md li{margin:.3em 0}
  .md ul ul,.md ul ol{margin:.25em 0}
  .md code{background:var(--code-bg);border:1px solid var(--border);padding:.12em .42em;border-radius:5px;font-size:.86em;font-family:"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;color:#ffd9a8}
  .md pre{background:var(--code-bg);border:1px solid var(--border);border-radius:10px;padding:16px 18px;overflow-x:auto;margin:1em 0}
  .md pre code{background:none;border:none;padding:0;color:#d6e2ff;font-size:.85rem;line-height:1.6}
  .md blockquote{margin:1.1em 0;padding:.6em 1.1em;border-left:3px solid var(--accent2);background:var(--panel);border-radius:0 8px 8px 0;color:#d7deea}
  .md blockquote p{margin:.3em 0}
  .md hr{border:none;border-top:1px solid var(--border);margin:2.2em 0}
  .md table{border-collapse:collapse;width:100%;margin:1.1em 0;font-size:.92rem;display:block;overflow-x:auto}
  .md th,.md td{border:1px solid var(--border);padding:8px 12px;text-align:left;vertical-align:top}
  .md th{background:var(--th-bg);color:#fff;font-weight:700;white-space:nowrap}
  .md tr:nth-child(even) td{background:rgba(255,255,255,.02)}
  .raw{background:var(--code-bg);border:1px solid var(--border);border-radius:10px;padding:20px;overflow-x:auto;white-space:pre;font-family:"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;font-size:.82rem;line-height:1.6;color:#cdd6e6}
  .note{color:var(--muted);font-size:12px;margin:0 0 14px}
  .toc{list-style:none;padding:0;margin:24px 0}
  .toc li{margin:0 0 10px;border:1px solid var(--border);border-radius:10px;background:var(--panel)}
  .toc a{display:block;padding:16px 18px;text-decoration:none;color:var(--text)}
  .toc a:hover{border-color:var(--accent)}
  .toc .num{color:var(--accent2);font-weight:700;margin-right:10px}
  .toc .desc{display:block;color:var(--muted);font-size:13px;margin-top:6px}
  .lead{color:#d7deea;font-size:1.02rem}
`;

// md を JS 文字列リテラルに安全に埋め込む（</script> 破壊と行区切り混入を防ぐ）
function escJsString(md) {
  return JSON.stringify(md)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const files = readdirSync(DIR)
  .filter((f) => /^\d\d-.*\.md$/.test(f))
  .sort();

const sections = files.map((file) => {
  const md = readFileSync(join(DIR, file), "utf8");
  const titleLine = (md.split("\n").find((l) => /^#\s+/.test(l)) || "# " + file).replace(/^#\s+/, "").trim();
  const descLine = (md.split("\n").find((l) => /^>\s+/.test(l)) || "").replace(/^>\s+/, "").replace(/\*\*/g, "").trim();
  return { file, html: file.replace(/\.md$/, ".html"), title: titleLine, desc: descLine, md };
});

function shell({ title, navTop, body }) {
  return "<!doctype html>\n<html lang=\"ja\">\n<head>\n<meta charset=\"utf-8\" />\n" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n" +
    "<title>" + escHtml(title) + "</title>\n<style>" + CSS + "</style>\n</head>\n<body>\n" +
    navTop + "\n<main>\n" + body + "\n" + FOOTER + "\n</main>\n</body>\n</html>\n";
}

sections.forEach((sec, idx) => {
  const prev = sections[idx - 1];
  const next = sections[idx + 1];
  const navTop =
    '<div class="topbar"><div class="topbar-inner">' +
    '<a class="brand" href="index.html">← 目次</a>' +
    '<span class="nav">' +
    (prev ? '<a href="' + prev.html + '">‹ ' + escHtml(prev.title.slice(0, 18)) + "</a>" : "") +
    (next ? '<a href="' + next.html + '">' + escHtml(next.title.slice(0, 18)) + " ›</a>" : "") +
    "</span>" +
    '<span class="spacer"></span>' +
    '<div class="tabs" role="tablist">' +
    '<button class="tab" id="tab-read" role="tab" aria-selected="true">📖 読む</button>' +
    '<button class="tab" id="tab-raw" role="tab" aria-selected="false">📝 Markdown</button>' +
    "</div>" +
    '<button class="copy-btn" id="copy">Markdown をコピー</button>' +
    "</div></div>";

  const pager =
    '<div class="pager">' +
    (prev ? '<a href="' + prev.html + '">‹ ' + escHtml(prev.title) + "</a>" : "<span></span>") +
    (next ? '<a href="' + next.html + '">' + escHtml(next.title) + " ›</a>" : "<span></span>") +
    "</div>";

  const body =
    '<section class="view md" id="view-read" role="tabpanel"></section>' +
    '<section class="view" id="view-raw" role="tabpanel" hidden>' +
    '<p class="note">そのまま .md として保存・コピーできます。</p>' +
    '<div class="raw" id="raw"></div></section>' +
    pager +
    "\n<script>var SRC=" + escJsString(sec.md) + ";</script>\n<script>" + renderer + "</script>";

  writeFileSync(join(DIR, sec.html), shell({ title: sec.title + " | Better Auth 詳細リファレンス", navTop, body }));
});

// all.html — 全章を1ページに結合（Ctrl-F 横断・印刷用）
const combinedMd = sections.map((s) => s.md).join("\n\n\n---\n\n\n");
const allNav =
  '<div class="topbar"><div class="topbar-inner">' +
  '<a class="brand" href="index.html">← 目次</a>' +
  '<span class="spacer"></span>' +
  '<div class="tabs" role="tablist">' +
  '<button class="tab" id="tab-read" role="tab" aria-selected="true">📖 読む</button>' +
  '<button class="tab" id="tab-raw" role="tab" aria-selected="false">📝 Markdown</button>' +
  "</div>" +
  '<button class="copy-btn" id="copy">Markdown をコピー</button>' +
  "</div></div>";
const allBody =
  '<section class="view md" id="view-read" role="tabpanel"></section>' +
  '<section class="view" id="view-raw" role="tabpanel" hidden>' +
  '<div class="raw" id="raw"></div></section>' +
  "\n<script>var SRC=" + escJsString(combinedMd) + ";</script>\n<script>" + renderer + "</script>";
writeFileSync(join(DIR, "all.html"), shell({ title: "全章まとめ | " + SITE_TITLE, navTop: allNav, body: allBody }));

const indexNav =
  '<div class="topbar"><div class="topbar-inner">' +
  '<a class="brand" href="index.html">Better Auth 詳細リファレンス</a>' +
  '<span class="spacer"></span>' +
  '<span class="nav"><a href="https://www.better-auth.com/docs" target="_blank" rel="noopener">公式Docs ↗</a></span>' +
  "</div></div>";

const tocItems = sections
  .map(
    (s, i) =>
      '<li><a href="' + s.html + '"><span class="num">' +
      String(i).padStart(2, "0") + "</span>" + escHtml(s.title) +
      (s.desc ? '<span class="desc">' + escHtml(s.desc) + "</span>" : "") +
      "</a></li>",
  )
  .join("\n");

const indexBody =
  '<div class="md"><h1>' + escHtml(SITE_TITLE) + "</h1>" +
  '<p class="lead">' + escHtml(SITE_SUB) + "</p></div>" +
  ROUTE_HTML +
  '<ul class="toc">\n' + tocItems + "\n</ul>";

writeFileSync(join(DIR, "index.html"), shell({ title: SITE_TITLE, navTop: indexNav, body: indexBody }));

console.log("built " + sections.length + " section pages + index.html");
sections.forEach((s) => console.log("  - " + s.html + "  (" + s.title + ")"));
