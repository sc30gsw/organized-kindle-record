(function () {
  "use strict";
  var src = (typeof SRC === "string") ? SRC : "";

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // inline formatting. input is already HTML-escaped.
  function inline(s) {
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) {
      codes.push(c);
      return "@@CODE" + (codes.length - 1) + "@@";
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/@@CODE(\d+)@@/g, function (_, i) {
      return "<code>" + codes[+i] + "</code>";
    });
    return s;
  }

  function isTableSep(line) {
    return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.indexOf("-") !== -1;
  }
  function splitRow(line) {
    var t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return t.split("|").map(function (c) { return c.trim(); });
  }

  function render(md) {
    var lines = md.replace(/\r\n/g, "\n").split("\n");
    var out = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];

      var fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        var buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>");
        continue;
      }

      if (/^\s*$/.test(line)) { i++; continue; }

      if (/^---+\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        var lv = h[1].length;
        out.push("<h" + lv + ">" + inline(esc(h[2])) + "</h" + lv + ">");
        i++; continue;
      }

      if (line.indexOf("|") !== -1 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        var header = splitRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].indexOf("|") !== -1 && !/^\s*$/.test(lines[i])) {
          rows.push(splitRow(lines[i])); i++;
        }
        var t = "<table><thead><tr>";
        header.forEach(function (c) { t += "<th>" + inline(esc(c)) + "</th>"; });
        t += "</tr></thead><tbody>";
        rows.forEach(function (r) {
          t += "<tr>";
          r.forEach(function (c) { t += "<td>" + inline(esc(c)) + "</td>"; });
          t += "</tr>";
        });
        t += "</tbody></table>";
        out.push(t);
        continue;
      }

      if (/^>\s?/.test(line)) {
        var qbuf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          qbuf.push(lines[i].replace(/^>\s?/, "")); i++;
        }
        out.push("<blockquote>" + render(qbuf.join("\n")) + "</blockquote>");
        continue;
      }

      if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
        var items = [];
        while (i < lines.length && /^(\s*)([-*]|\d+\.)\s+/.test(lines[i])) {
          var m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
          items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), num: parseInt(m[2], 10), text: m[3] });
          i++;
        }
        out.push(buildList(items));
        continue;
      }

      var pbuf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) &&
             !/^(#{1,6})\s/.test(lines[i]) && !/^```/.test(lines[i]) &&
             !/^>\s?/.test(lines[i]) && !/^---+\s*$/.test(lines[i]) &&
             !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i]) &&
             !(lines[i].indexOf("|") !== -1 && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
        pbuf.push(lines[i]); i++;
      }
      out.push("<p>" + inline(esc(pbuf.join(" "))) + "</p>");
    }
    return out.join("\n");
  }

  function buildList(items) {
    var ordered = items[0].ordered;
    var tag = ordered ? "ol" : "ul";
    var start = ordered && items[0].num !== 1 ? ' start="' + items[0].num + '"' : "";
    var html = "<" + tag + start + ">";
    var n = 0;
    while (n < items.length) {
      var it = items[n];
      var li = "<li>" + inline(esc(it.text));
      var children = [];
      var k = n + 1;
      while (k < items.length && items[k].indent > it.indent) { children.push(items[k]); k++; }
      if (children.length) li += buildList(children);
      li += "</li>";
      html += li;
      n = k;
    }
    html += "</" + tag + ">";
    return html;
  }

  var viewRead = document.getElementById("view-read");
  if (viewRead) viewRead.innerHTML = render(src);
  var rawEl = document.getElementById("raw");
  if (rawEl) rawEl.textContent = src;

  var tabRead = document.getElementById("tab-read");
  var tabRaw = document.getElementById("tab-raw");
  var viewRaw = document.getElementById("view-raw");
  function select(which) {
    var read = which === "read";
    if (tabRead) tabRead.setAttribute("aria-selected", read ? "true" : "false");
    if (tabRaw) tabRaw.setAttribute("aria-selected", read ? "false" : "true");
    if (viewRead) viewRead.hidden = !read;
    if (viewRaw) viewRaw.hidden = read;
  }
  if (tabRead) tabRead.addEventListener("click", function () { select("read"); });
  if (tabRaw) tabRaw.addEventListener("click", function () { select("raw"); });

  var copyBtn = document.getElementById("copy");
  if (copyBtn) copyBtn.addEventListener("click", function () {
    var btn = this;
    navigator.clipboard.writeText(src).then(function () {
      var prev = btn.textContent;
      btn.textContent = "コピーしました ✓";
      setTimeout(function () { btn.textContent = prev; }, 1500);
    });
  });
})();
