/**
 * exporter.js — Export slides to HTML, PDF, PPTX, and PNG.
 *
 * Combines Marp's multi-format export concept with the Python tool's
 * image generation approach (html2canvas for PNG, PptxGenJS for PPTX).
 */
window.SlideExporter = (function () {
  'use strict';

  /** Show a toast notification */
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }

  /** Trigger a file download */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadText(text, filename, mime) {
    const blob = new Blob([text], { type: mime });
    downloadBlob(blob, filename);
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /** Collect all CSS needed for standalone HTML */
  function collectCSS() {
    const sheets = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      // We'll inline the theme + slide CSS. For CDN sheets, include the link.
      sheets.push(link.outerHTML);
    });
    // Also grab our local style content
    const localStyles = [];
    ['css/app.css', 'css/themes.css', 'css/slides.css'].forEach(href => {
      const link = document.querySelector(`link[href="${href}"]`);
      if (link) localStyles.push(`<link rel="stylesheet" href="${href}">`);
    });
    return sheets;
  }

  // ============================
  // EXPORT: Standalone HTML
  // ============================
  function exportHTML(slides, theme) {
    toast('Generating HTML…');

    const slideMarkup = slides.map((slide, i) => {
      const dirs = slide.directives || {};
      const transRaw = String(dirs._transition || dirs.transition || '').trim();
      const transAttr = transRaw ? ` data-transition="${escapeAttr(transRaw)}"` : '';
      return `<section class="html-slide" id="slide-${i + 1}"${transAttr}>
        ${window.SlideRenderer.renderSlideHTML(slide, i + 1, slides.length)}
      </section>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css">
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"><\/script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    :root {
      --slide-bg: #ffffff; --slide-fg: #333333; --slide-heading: #246;
      --slide-accent: #0366d6; --slide-code-bg: #f6f8fa; --slide-code-fg: #24292e;
      --slide-border: #e1e4e8; --slide-muted: #6a737d;
      --slide-font: 'Segoe UI', system-ui, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; font-family: system-ui, sans-serif; background: #111; }

    /* Slide themes */
    .slide-theme-default { --slide-bg:#fff;--slide-fg:#333;--slide-heading:#246;--slide-accent:#0366d6;--slide-code-bg:#f6f8fa;--slide-code-fg:#24292e;--slide-border:#e1e4e8;--slide-muted:#6a737d; }
    .slide-theme-dark { --slide-bg:#1a1b26;--slide-fg:#c0caf5;--slide-heading:#bb9af7;--slide-accent:#7aa2f7;--slide-code-bg:#24283b;--slide-code-fg:#a9b1d6;--slide-border:#3b4261;--slide-muted:#565f89; }
    .slide-theme-gaia { --slide-bg:#fdf6e3;--slide-fg:#657b83;--slide-heading:#b58900;--slide-accent:#268bd2;--slide-code-bg:#eee8d5;--slide-code-fg:#586e75;--slide-border:#d6cba4;--slide-muted:#93a1a1; }
    .slide-theme-uncover { --slide-bg:#fafafa;--slide-fg:#333;--slide-heading:#e91e63;--slide-accent:#e91e63;--slide-code-bg:#263238;--slide-code-fg:#eeffff;--slide-border:#e0e0e0;--slide-muted:#757575; }
    .slide-theme-gradient { --slide-bg:linear-gradient(135deg,#0f0c29,#302b63,#24243e);--slide-fg:#e0e0ff;--slide-heading:#f857a6;--slide-accent:#ff5858;--slide-code-bg:rgba(0,0,0,0.4);--slide-code-fg:#e0e0ff;--slide-border:rgba(255,255,255,0.1);--slide-muted:rgba(255,255,255,0.4); }

    .html-slide {
      width: 100vw; height: 100vh;
      display: none; overflow: hidden;
    }
    .html-slide.active { display: block; }

    .slide-frame {
      width: 100%; height: 100%;
      padding: 48px 56px;
      font-family: var(--slide-font);
      color: var(--slide-fg);
      display: flex; flex-direction: column;
      justify-content: flex-start;
      overflow: hidden; position: relative;
    }
    .slide-frame.bg-solid { background: var(--slide-bg); }
    .slide-frame.bg-gradient { background: var(--slide-bg); }

    /* Raw HTML / Component element wrapper (see css/slides.css for rationale) */
    .slide-frame .el-html { display:block; align-self:flex-start; max-width:100%; margin:0.3em 0; }
    .slide-frame .el-html > * + * { margin-top:0.5em; }

    .slide-frame h1 { font-size:2.2em;font-weight:800;color:var(--slide-heading);margin-bottom:0.3em;line-height:1.2; }
    .slide-frame h2 { font-size:1.6em;font-weight:700;color:var(--slide-heading);margin-bottom:0.3em;line-height:1.25; }
    .slide-frame h3 { font-size:1.25em;font-weight:600;color:var(--slide-heading);margin-bottom:0.2em; }
    .slide-frame p { font-size:0.95em;line-height:1.6;margin-bottom:0.5em; }
    .slide-frame.slide-type-title { justify-content:center;align-items:center;text-align:center; }
    .slide-frame.slide-type-title h1 { font-size:2.8em;margin-bottom:0.2em; }
    .slide-frame.slide-type-title p { font-size:1.2em;color:var(--slide-muted); }

    .slide-frame ul, .slide-frame ol { padding-left:1.5em;margin-bottom:0.5em; }
    .slide-frame li { font-size:0.95em;line-height:1.7;margin-bottom:0.2em; }
    .slide-frame ul li::marker { color:var(--slide-accent); }

    .slide-frame pre {
      background:var(--slide-code-bg);border-radius:8px;padding:16px 20px;
      margin:0.5em 0;overflow-x:auto;box-shadow:0 2px 8px rgba(0,0,0,0.15);position:relative;
    }
    .slide-frame pre::before {
      content:'';display:block;height:12px;margin-bottom:12px;
      background:radial-gradient(circle at 8px 6px,#ff5f57 5px,transparent 5px),radial-gradient(circle at 28px 6px,#febc2e 5px,transparent 5px),radial-gradient(circle at 48px 6px,#28c840 5px,transparent 5px);
    }
    .slide-frame code { font-family:'Fira Code','Consolas',monospace;font-size:0.8em;color:var(--slide-code-fg); }
    .slide-frame :not(pre)>code { background:var(--slide-code-bg);padding:2px 6px;border-radius:4px; }
    .slide-frame pre[data-lang]::after { content:attr(data-lang);position:absolute;top:8px;right:12px;font-size:.65em;color:var(--slide-muted);text-transform:uppercase;font-weight:600; }

    .slide-frame table { width:100%;border-collapse:collapse;margin:0.5em 0;font-size:0.85em; }
    .slide-frame th { background:var(--slide-accent);color:#fff;padding:8px 12px;text-align:left;font-weight:600; }
    .slide-frame td { padding:8px 12px;border-bottom:1px solid var(--slide-border); }
    .slide-frame tr:nth-child(even) td { background:rgba(0,0,0,0.02); }

    .slide-frame img { max-width:100%;max-height:65%;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.15);object-fit:contain; }
    .slide-frame blockquote { border-left:4px solid var(--slide-accent);padding:8px 16px;margin:0.5em 0;color:var(--slide-muted);font-style:italic;background:rgba(0,0,0,0.03);border-radius:0 4px 4px 0; }
    .slide-frame .columns { display:flex;gap:32px;flex:1;align-items:flex-start; }
    .slide-frame .columns .col { flex:1;min-width:0; }
    .slide-number { position:absolute;bottom:12px;right:16px;font-size:0.7em;color:var(--slide-muted);font-weight:500; }
    .slide-progress { position:absolute;bottom:0;left:0;height:3px;background:var(--slide-accent);transition:width 0.3s ease; }

    .slide-frame.bg-image { background-size:cover;background-position:center; }
    .slide-frame.bg-image::before { content:'';position:absolute;inset:0;background:rgba(0,0,0,0.4); }
    .slide-frame.bg-image>* { position:relative;z-index:1; }
    .slide-frame.bg-image h1,.slide-frame.bg-image h2,.slide-frame.bg-image p { color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.5); }

    /* Toolbar */
    #controls {
      position:fixed;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:center;
      gap:12px;padding:10px;background:rgba(0,0,0,0.7);opacity:0;transition:opacity 0.3s;z-index:100;
    }
    body:hover #controls { opacity:1; }
    #controls button, #controls span {
      padding:6px 14px;border:1px solid rgba(255,255,255,0.2);border-radius:6px;
      background:rgba(255,255,255,0.05);color:#fff;font-size:13px;cursor:pointer;
    }
    #controls button:hover { background:rgba(255,255,255,0.15); }
    #controls .indicator { border:none;background:none;cursor:default; }

    /* Fragment animation */
    .slide-frame ul li, .slide-frame ol li { opacity:1; }

    /* === Marp bespoke-style transitions === */
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation-duration: var(--marp-transition-duration, 0.5s);
      animation-timing-function: ease;
      animation-fill-mode: both;
      mix-blend-mode: normal;
    }
    @media (prefers-reduced-motion: reduce) {
      :root[data-marp-transition]::view-transition-old(root),
      :root[data-marp-transition]::view-transition-new(root) {
        animation-name: marp-fade-out, marp-fade-in !important;
      }
    }
    @keyframes marp-fade-in  { from { opacity: 0 } to { opacity: 1 } }
    @keyframes marp-fade-out { from { opacity: 1 } to { opacity: 0 } }
    :root[data-marp-transition="fade"]::view-transition-old(root) { animation-name: marp-fade-out; }
    :root[data-marp-transition="fade"]::view-transition-new(root) { animation-name: marp-fade-in; }
    @keyframes marp-out-slide { from { transform: translateX(0) } to { transform: translateX(calc(var(--marp-transition-direction, 1) * -100%)) } }
    @keyframes marp-in-slide  { from { transform: translateX(calc(var(--marp-transition-direction, 1) * 100%)) } to { transform: translateX(0) } }
    :root[data-marp-transition="slide"]::view-transition-old(root) { animation-name: marp-out-slide; }
    :root[data-marp-transition="slide"]::view-transition-new(root) { animation-name: marp-in-slide; }
    @keyframes marp-out-push { from { transform: translateY(0) } to { transform: translateY(calc(var(--marp-transition-direction, 1) * -100%)) } }
    @keyframes marp-in-push  { from { transform: translateY(calc(var(--marp-transition-direction, 1) * 100%)) } to { transform: translateY(0) } }
    :root[data-marp-transition="push"]::view-transition-old(root) { animation-name: marp-out-push; }
    :root[data-marp-transition="push"]::view-transition-new(root) { animation-name: marp-in-push; }
    @keyframes marp-in-cover { from { transform: translateX(calc(var(--marp-transition-direction, 1) * 100%)) } to { transform: translateX(0) } }
    :root[data-marp-transition="cover"]::view-transition-old(root) { animation-name: marp-fade-out; }
    :root[data-marp-transition="cover"]::view-transition-new(root) { animation-name: marp-in-cover; z-index: 2; }
    @keyframes marp-out-reveal { from { transform: translateX(0) } to { transform: translateX(calc(var(--marp-transition-direction, 1) * -100%)) } }
    :root[data-marp-transition="reveal"]::view-transition-old(root) { animation-name: marp-out-reveal; z-index: 2; }
    :root[data-marp-transition="reveal"]::view-transition-new(root) { animation-name: marp-fade-in; }
    @keyframes marp-out-wipe { from { clip-path: inset(0 0 0 0) } to { clip-path: inset(0 100% 0 0) } }
    @keyframes marp-in-wipe  { from { clip-path: inset(0 0 0 100%) } to { clip-path: inset(0 0 0 0) } }
    :root[data-marp-transition="wipe"]::view-transition-old(root) { animation-name: marp-out-wipe; }
    :root[data-marp-transition="wipe"]::view-transition-new(root) { animation-name: marp-in-wipe; }
    @keyframes marp-out-zoom { from { transform: scale(1); opacity: 1 } to { transform: scale(0); opacity: 0 } }
    @keyframes marp-in-zoom  { from { transform: scale(0); opacity: 0 } to { transform: scale(1); opacity: 1 } }
    :root[data-marp-transition="zoom"]::view-transition-old(root) { animation-name: marp-out-zoom; }
    :root[data-marp-transition="zoom"]::view-transition-new(root) { animation-name: marp-in-zoom; }
    @keyframes marp-out-flip { from { transform: perspective(1200px) rotateY(0); opacity: 1 } to { transform: perspective(1200px) rotateY(calc(var(--marp-transition-direction, 1) * 90deg)); opacity: 0 } }
    @keyframes marp-in-flip  { from { transform: perspective(1200px) rotateY(calc(var(--marp-transition-direction, 1) * -90deg)); opacity: 0 } to { transform: perspective(1200px) rotateY(0); opacity: 1 } }
    :root[data-marp-transition="flip"]::view-transition-old(root) { animation-name: marp-out-flip; }
    :root[data-marp-transition="flip"]::view-transition-new(root) { animation-name: marp-in-flip; }
    @keyframes marp-in-iris-in { from { clip-path: circle(0% at 50% 50%) } to { clip-path: circle(150% at 50% 50%) } }
    :root[data-marp-transition="iris-in"]::view-transition-old(root) { animation-name: marp-fade-out; }
    :root[data-marp-transition="iris-in"]::view-transition-new(root) { animation-name: marp-in-iris-in; z-index: 2; }
    :root[data-marp-transition="none"]::view-transition-old(root),
    :root[data-marp-transition="none"]::view-transition-new(root) { animation: none !important; }
  </style>
</head>
<body>
  ${slideMarkup}

  <div id="controls">
    <button id="btn-prev">◀ Prev</button>
    <span class="indicator" id="indicator">1 / ${slides.length}</span>
    <button id="btn-next">Next ▶</button>
    <button id="btn-fs">⛶ Fullscreen</button>
  </div>

  <script>
    // Presentation logic
    (function() {
      const slides = document.querySelectorAll('.html-slide');
      let current = 0;

      function parseTransition(raw) {
        const v = String(raw || '').trim();
        if (!v) return null;
        const parts = v.split(/\\s+/);
        let dur = parts[1] || '';
        if (dur && /^[0-9]*\\.?[0-9]+$/.test(dur)) dur = dur + 's';
        return { name: parts[0], duration: dur };
      }

      function applyShow(idx) {
        slides.forEach((s,i) => s.classList.toggle('active', i === idx));
        document.getElementById('indicator').textContent = (idx+1) + ' / ' + slides.length;
      }

      function show(idx) {
        if (idx === current) return;
        const direction = idx > current ? 1 : -1;
        // Per Marp: outgoing slide's transition governs the boundary.
        const trans = parseTransition(slides[current] && slides[current].getAttribute('data-transition'));
        const root = document.documentElement;
        const finish = () => { current = idx; };

        if (trans && trans.name !== 'none' && typeof document.startViewTransition === 'function') {
          root.style.setProperty('--marp-transition-direction', String(direction));
          if (trans.duration) root.style.setProperty('--marp-transition-duration', trans.duration);
          else root.style.removeProperty('--marp-transition-duration');
          root.setAttribute('data-marp-transition', trans.name);
          const vt = document.startViewTransition(() => applyShow(idx));
          vt.finished.finally(() => {
            root.removeAttribute('data-marp-transition');
            root.style.removeProperty('--marp-transition-direction');
            root.style.removeProperty('--marp-transition-duration');
            finish();
          });
        } else {
          applyShow(idx);
          finish();
        }
      }

      applyShow(0);
      document.getElementById('btn-prev').onclick = () => show(Math.max(0, current-1));
      document.getElementById('btn-next').onclick = () => show(Math.min(slides.length-1, current+1));
      document.getElementById('btn-fs').onclick = () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      };
      document.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === ' ') show(Math.min(slides.length-1, current+1));
        if (e.key === 'ArrowLeft') show(Math.max(0, current-1));
        if (e.key === 'Escape' && document.fullscreenElement) document.exitFullscreen();
      });
      // Highlight code
      if (typeof hljs !== 'undefined') {
        document.querySelectorAll('pre code').forEach(b => {
          hljs.highlightElement(b);
          const lang = b.className.match(/language-(\\w+)/);
          if (lang) b.parentElement.setAttribute('data-lang', lang[1]);
        });
      }
    })();
  <\/script>
</body>
</html>`;

    downloadText(html, 'presentation.html', 'text/html');
    toast('HTML exported!');
  }

  // ============================
  // EXPORT: PDF (via print)
  // ============================
  function exportPDF(slides, theme) {
    toast('Opening print dialog for PDF…');

    // Build a print-friendly version
    const slideMarkup = slides.map((slide, i) => {
      return `<div class="pdf-slide">
        ${window.SlideRenderer.renderSlideHTML(slide, i + 1, slides.length)}
      </div>`;
    }).join('\n');

    const printWin = window.open('', '_blank');
    printWin.document.write(`<!DOCTYPE html>
<html><head><title>Presentation PDF</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<style>
  @page { size: landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; }

  .slide-theme-default { --slide-bg:#fff;--slide-fg:#333;--slide-heading:#246;--slide-accent:#0366d6;--slide-code-bg:#f6f8fa;--slide-code-fg:#24292e;--slide-border:#e1e4e8;--slide-muted:#6a737d;--slide-font:'Segoe UI',system-ui,sans-serif; }
  .slide-theme-dark { --slide-bg:#1a1b26;--slide-fg:#c0caf5;--slide-heading:#bb9af7;--slide-accent:#7aa2f7;--slide-code-bg:#24283b;--slide-code-fg:#a9b1d6;--slide-border:#3b4261;--slide-muted:#565f89;--slide-font:'Inter',system-ui,sans-serif; }
  .slide-theme-gaia { --slide-bg:#fdf6e3;--slide-fg:#657b83;--slide-heading:#b58900;--slide-accent:#268bd2;--slide-code-bg:#eee8d5;--slide-code-fg:#586e75;--slide-border:#d6cba4;--slide-muted:#93a1a1;--slide-font:'Georgia',serif; }
  .slide-theme-uncover { --slide-bg:#fafafa;--slide-fg:#333;--slide-heading:#e91e63;--slide-accent:#e91e63;--slide-code-bg:#263238;--slide-code-fg:#eeffff;--slide-border:#e0e0e0;--slide-muted:#757575;--slide-font:'Lato',system-ui,sans-serif; }
  .slide-theme-gradient { --slide-bg:linear-gradient(135deg,#0f0c29,#302b63,#24243e);--slide-fg:#e0e0ff;--slide-heading:#f857a6;--slide-accent:#ff5858;--slide-code-bg:rgba(0,0,0,0.4);--slide-code-fg:#e0e0ff;--slide-border:rgba(255,255,255,0.1);--slide-muted:rgba(255,255,255,0.4);--slide-font:'Inter',system-ui,sans-serif; }

  .pdf-slide {
    width: 100vw; height: 100vh;
    page-break-after: always;
    overflow: hidden;
  }
  .slide-frame {
    width:100%;height:100%;padding:48px 56px;font-family:var(--slide-font);color:var(--slide-fg);
    display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden;position:relative;
  }
  .slide-frame.bg-solid { background:var(--slide-bg); }
  .slide-frame.bg-gradient { background:var(--slide-bg); }
  .slide-frame h1 { font-size:2.2em;font-weight:800;color:var(--slide-heading);margin-bottom:0.3em;line-height:1.2; }
  .slide-frame h2 { font-size:1.6em;font-weight:700;color:var(--slide-heading);margin-bottom:0.3em; }
  .slide-frame h3 { font-size:1.25em;font-weight:600;color:var(--slide-heading);margin-bottom:0.2em; }
  .slide-frame p { font-size:0.95em;line-height:1.6;margin-bottom:0.5em; }
  .slide-frame.slide-type-title { justify-content:center;align-items:center;text-align:center; }
  .slide-frame.slide-type-title h1 { font-size:2.8em;margin-bottom:0.2em; }
  .slide-frame.slide-type-title p { font-size:1.2em;color:var(--slide-muted); }
  .slide-frame ul,.slide-frame ol { padding-left:1.5em;margin-bottom:0.5em; }
  .slide-frame li { font-size:0.95em;line-height:1.7;margin-bottom:0.2em; }
  .slide-frame ul li::marker { color:var(--slide-accent); }
  .slide-frame pre { background:var(--slide-code-bg);border-radius:8px;padding:16px 20px;margin:0.5em 0;overflow-x:auto;box-shadow:0 2px 8px rgba(0,0,0,0.15);position:relative; }
  .slide-frame pre::before { content:'';display:block;height:12px;margin-bottom:12px;background:radial-gradient(circle at 8px 6px,#ff5f57 5px,transparent 5px),radial-gradient(circle at 28px 6px,#febc2e 5px,transparent 5px),radial-gradient(circle at 48px 6px,#28c840 5px,transparent 5px); }
  .slide-frame code { font-family:'Fira Code','Consolas',monospace;font-size:0.8em;color:var(--slide-code-fg); }
  .slide-frame :not(pre)>code { background:var(--slide-code-bg);padding:2px 6px;border-radius:4px; }
  .slide-frame table { width:100%;border-collapse:collapse;margin:0.5em 0;font-size:0.85em; }
  .slide-frame th { background:var(--slide-accent);color:#fff;padding:8px 12px;text-align:left;font-weight:600; }
  .slide-frame td { padding:8px 12px;border-bottom:1px solid var(--slide-border); }
  .slide-frame img { max-width:100%;max-height:65%;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.15);object-fit:contain; }
  .slide-frame blockquote { border-left:4px solid var(--slide-accent);padding:8px 16px;margin:0.5em 0;color:var(--slide-muted);font-style:italic; }
  .slide-frame .columns { display:flex;gap:32px;flex:1; }
  .slide-frame .columns .col { flex:1; }
  .slide-number { position:absolute;bottom:12px;right:16px;font-size:0.7em;color:var(--slide-muted); }
  .slide-progress { position:absolute;bottom:0;left:0;height:3px;background:var(--slide-accent); }
</style>
</head><body>
${slideMarkup}
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
    printWin.document.close();
  }

  // ============================
  // EXPORT: PPTX (via PptxGenJS)
  // ============================
  function exportPPTX(slides, theme) {
    toast('Generating PPTX…');

    if (typeof PptxGenJS === 'undefined') {
      toast('PptxGenJS not loaded. Cannot export PPTX.');
      return;
    }

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';

    // Theme colors
    const themeColors = {
      default:  { bg: 'FFFFFF', fg: '333333', heading: '224466', accent: '0366D6' },
      dark:     { bg: '1A1B26', fg: 'C0CAF5', heading: 'BB9AF7', accent: '7AA2F7' },
      gaia:     { bg: 'FDF6E3', fg: '657B83', heading: 'B58900', accent: '268BD2' },
      uncover:  { bg: 'FAFAFA', fg: '333333', heading: 'E91E63', accent: 'E91E63' },
      gradient: { bg: '24243E', fg: 'E0E0FF', heading: 'F857A6', accent: 'FF5858' },
    };
    const colors = themeColors[theme] || themeColors.default;

    slides.forEach((slide, i) => {
      const pptSlide = pptx.addSlide();

      // Per-slide background
      const dirs = slide.directives || {};
      let slideBg = dirs.backgroundColor || '#' + colors.bg;
      if (slideBg.startsWith('#')) slideBg = slideBg.slice(1);
      pptSlide.background = { color: slideBg };

      // Parse HTML to extract text content
      const tmp = document.createElement('div');
      tmp.innerHTML = slide.html;

      let yPos = 0.5;

      // Headings
      tmp.querySelectorAll('h1, h2, h3').forEach(h => {
        const level = parseInt(h.tagName[1]);
        const fontSize = level === 1 ? 36 : level === 2 ? 28 : 22;
        pptSlide.addText(h.textContent, {
          x: 0.5, y: yPos, w: '90%',
          fontSize,
          bold: true,
          color: colors.heading,
          fontFace: 'Segoe UI',
        });
        yPos += level === 1 ? 0.8 : 0.6;
      });

      // Paragraphs
      tmp.querySelectorAll('p').forEach(p => {
        if (p.closest('blockquote')) return;
        const text = p.textContent.trim();
        if (!text) return;
        pptSlide.addText(text, {
          x: 0.5, y: yPos, w: '90%',
          fontSize: 18,
          color: colors.fg,
          fontFace: 'Segoe UI',
        });
        yPos += 0.5;
      });

      // Lists
      tmp.querySelectorAll('ul, ol').forEach(list => {
        const items = [];
        list.querySelectorAll('li').forEach(li => {
          items.push({
            text: li.textContent,
            options: {
              bullet: list.tagName === 'UL',
              fontSize: 16,
              color: colors.fg,
              fontFace: 'Segoe UI',
              indentLevel: 0,
            }
          });
        });
        if (items.length) {
          pptSlide.addText(items, { x: 0.5, y: yPos, w: '85%' });
          yPos += items.length * 0.35;
        }
      });

      // Code blocks
      tmp.querySelectorAll('pre code').forEach(code => {
        const text = code.textContent;
        pptSlide.addText(text, {
          x: 0.5, y: yPos, w: '90%', h: Math.min(text.split('\n').length * 0.25 + 0.3, 3.5),
          fontSize: 12,
          fontFace: 'Consolas',
          color: 'E0E0E0',
          fill: { color: '1E1E1E' },
          valign: 'top',
          isTextBox: true,
          margin: [10, 14, 10, 14],
        });
        yPos += Math.min(text.split('\n').length * 0.25 + 0.5, 4);
      });

      // Tables
      tmp.querySelectorAll('table').forEach(table => {
        const rows = [];
        table.querySelectorAll('tr').forEach((tr, ri) => {
          const cells = [];
          tr.querySelectorAll('th, td').forEach(cell => {
            cells.push({
              text: cell.textContent,
              options: {
                fontSize: 12,
                color: ri === 0 ? 'FFFFFF' : colors.fg,
                fill: { color: ri === 0 ? colors.accent : (ri % 2 === 0 ? 'F5F5F5' : 'FFFFFF') },
                bold: ri === 0,
                fontFace: 'Segoe UI',
                border: { pt: 0.5, color: 'D0D0D0' },
              }
            });
          });
          if (cells.length) rows.push(cells);
        });
        if (rows.length) {
          pptSlide.addTable(rows, {
            x: 0.5, y: yPos, w: '90%',
            fontSize: 12,
            colW: Array(rows[0].length).fill(9 / rows[0].length),
          });
        }
      });

      // Blockquotes
      tmp.querySelectorAll('blockquote').forEach(bq => {
        pptSlide.addText(bq.textContent.trim(), {
          x: 0.7, y: yPos, w: '85%',
          fontSize: 16,
          italic: true,
          color: '666666',
          fontFace: 'Georgia',
        });
        yPos += 0.7;
      });

      // Slide number
      pptSlide.addText(`${i + 1} / ${slides.length}`, {
        x: '85%', y: '92%', w: 1.5,
        fontSize: 10,
        color: '999999',
        fontFace: 'Segoe UI',
        align: 'right',
      });
    });

    pptx.writeFile({ fileName: 'presentation.pptx' })
      .then(() => toast('PPTX exported!'))
      .catch(err => toast('PPTX export failed: ' + err.message));
  }

  // ============================
  // EXPORT: PNG (all slides)
  // ============================
  async function exportPNG(slides, theme) {
    if (typeof html2canvas === 'undefined') {
      toast('html2canvas not loaded. Cannot export PNG.');
      return;
    }

    toast('Generating PNGs… This may take a moment.');

    // Create a hidden container for rendering
    const offscreen = document.createElement('div');
    offscreen.style.cssText = 'position:fixed;left:-9999px;top:0;width:1920px;height:1080px;';
    document.body.appendChild(offscreen);

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      offscreen.innerHTML = '';

      const frame = document.createElement('div');
      frame.style.cssText = 'width:1920px;height:1080px;';
      frame.innerHTML = window.SlideRenderer.renderSlideHTML(slide, i + 1, slides.length);
      offscreen.appendChild(frame);

      // Highlight code
      window.SlideRenderer.highlightCode(frame);

      try {
        const canvas = await html2canvas(frame, {
          width: 1920,
          height: 1080,
          scale: 1,
          useCORS: true,
          backgroundColor: null,
        });

        canvas.toBlob(blob => {
          if (blob) {
            const num = String(i).padStart(2, '0');
            const type = slide.type;
            downloadBlob(blob, `${num}_slide_${type}.png`);
          }
        }, 'image/png');
      } catch (err) {
        console.error('PNG export error for slide', i, err);
      }
    }

    document.body.removeChild(offscreen);
    toast(`Exported ${slides.length} PNG files!`);
  }

  return { exportHTML, exportPDF, exportPPTX, exportPNG };
})();
