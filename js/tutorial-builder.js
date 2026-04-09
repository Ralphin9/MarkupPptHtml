/**
 * tutorial-builder.js
 *
 * ExplainDev-inspired visual code annotation builder.
 *
 * Workflow:
 *  1. Write code in the left editor  → live syntax highlight on canvas
 *  2. Select a line/text in editor   → click "Annotate Selection"
 *                                       → creates a draggable callout card
 *  3. Drag callout cards freely       → SVG arrows track back to source line
 *  4. Edit callout text (contenteditable), font size, color
 *  5. Click "Download PNG"            → exports the canvas slide
 */
window.TutorialBuilder = (function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────
  let annotations   = [];   // {id, text, targetLine, x, y, color, fontSize, minWidth}
  let annIdCounter  = 0;
  let selectedId    = null;
  let dragging      = null; // {ann, el, startX, startY, origX, origY}
  let resizing      = null; // {ann, el, startX, startW}
  let renderPending = null;

  // ── DOM refs (bound in init) ────────────────────────────────────────────
  let codeEditor, slideEl, codeDisplayEl, arrowsSvg, annotLayer,
      titleInput, langSelect, langBadgeEl, exporting, emptyHint;

  // ── Color palette ───────────────────────────────────────────────────────
  const COLORS = {
    blue:   '#58a6ff',
    green:  '#3fb950',
    orange: '#d29922',
    purple: '#bc8cff',
    red:    '#f85149',
  };

  // ── Public API ───────────────────────────────────────────────────────────
  function init() {
    codeEditor    = document.getElementById('tut-code-editor');
    slideEl       = document.getElementById('tut-slide');
    codeDisplayEl = document.getElementById('tut-code-display');
    arrowsSvg     = document.getElementById('tut-arrows-svg');
    annotLayer    = document.getElementById('tut-annot-layer');
    titleInput    = document.getElementById('tut-title-input');
    langSelect    = document.getElementById('tut-lang-select');
    langBadgeEl   = document.getElementById('tut-slide-code-lang-badge');
    exporting     = document.getElementById('tut-exporting-overlay');
    emptyHint     = document.getElementById('tut-empty-hint');

    if (!codeEditor) return; // panel not yet in DOM

    // Wire toolbar buttons
    document.getElementById('tut-annotate-btn').addEventListener('click', addAnnotationFromSelection);
    document.getElementById('tut-add-text-btn').addEventListener('click', addFreeText);
    document.getElementById('tut-clear-btn').addEventListener('click', clearAll);
    document.getElementById('tut-export-btn').addEventListener('click', exportPNG);

    // Title sync
    titleInput.addEventListener('input', () => {
      const el = document.getElementById('tut-slide-title-el');
      if (el) el.textContent = titleInput.value || 'Code Tutorial';
    });

    // Lang sync
    langSelect.addEventListener('change', () => {
      if (langBadgeEl) langBadgeEl.textContent = langSelect.value;
      scheduleRender();
    });

    // Code editor → live render
    codeEditor.addEventListener('input', scheduleRender);
    codeEditor.addEventListener('scroll', updateArrows);

    // Click outside deselects
    slideEl.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.tut-callout')) deselectAll();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);

    // Seed with starter code
    codeEditor.value =
      `async function fetchUser(id) {\n` +
      `  const res = await fetch(\`/api/users/\${id}\`);\n` +
      `  const user = await res.json();\n` +
      `  return user;\n` +
      `}`;

    renderCode();
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  function scheduleRender() {
    clearTimeout(renderPending);
    renderPending = setTimeout(renderCode, 320);
  }

  function renderCode() {
    const code = codeEditor.value;
    const lang = langSelect ? langSelect.value : 'javascript';
    if (langBadgeEl) langBadgeEl.textContent = lang;

    let highlighted;
    try {
      highlighted = hljs.highlight(code, { language: lang }).value;
    } catch (e) {
      try { highlighted = hljs.highlightAuto(code).value; }
      catch (e2) { highlighted = escapeHtml(code); }
    }

    // Wrap each line in a .tut-line span for position tracking
    const lines = highlighted.split('\n');
    const html = lines.map((line, i) =>
      `<span class="tut-line" data-line="${i}">${line || '\u200b'}</span>`
    ).join('\n');

    codeDisplayEl.innerHTML = html;
    updateArrows();
    updateEmptyHint();
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Annotations ──────────────────────────────────────────────────────────
  function addAnnotationFromSelection() {
    const start  = codeEditor.selectionStart;
    const end    = codeEditor.selectionEnd;
    const selectedText = codeEditor.value.substring(start, end).trim();

    // Determine line number from cursor/selection start
    const beforeSel   = codeEditor.value.substring(0, start);
    const targetLine  = (beforeSel.match(/\n/g) || []).length;

    // Highlight that line on the slide temporarily
    highlightLine(targetLine, 'blue', 1800);

    // Build initial annotation text
    let initialText;
    if (selectedText) {
      const escaped = escapeHtml(selectedText);
      initialText = `<strong>${escaped}</strong> — `;
    } else {
      initialText = 'Explain this code…';
    }

    createAnnotation(initialText, targetLine);
  }

  function addFreeText() {
    createAnnotation('Add your text here…', null);
  }

  function createAnnotation(text, targetLine) {
    ++annIdCounter;
    const count = annotations.length;

    // Place to the right of the code block with vertical stagger
    const ann = {
      id:        annIdCounter,
      text,
      targetLine,
      x:         620 + (count % 2) * 20,
      y:         60  + count * 90,
      color:     'blue',
      fontSize:  13,
      minWidth:  180,
    };

    annotations.push(ann);
    renderAnnotation(ann);
    selectAnnotation(ann.id);
    updateArrows();
    updateEmptyHint();
  }

  function renderAnnotation(ann) {
    const el = document.createElement('div');
    el.className = `tut-callout color-${ann.color}`;
    el.dataset.id = ann.id;
    el.style.cssText = `left:${ann.x}px;top:${ann.y}px;min-width:${ann.minWidth}px;`;

    el.innerHTML = `
      <div class="tut-drag-handle" title="Drag to move"></div>
      <div class="tut-callout-bubble">
        <div class="tut-callout-text" contenteditable="true" spellcheck="false">${ann.text}</div>
        <div class="tut-callout-controls">
          <button class="tut-cc-btn" data-action="smaller" title="Smaller text (A-)">A-</button>
          <button class="tut-cc-btn" data-action="larger"  title="Larger text (A+)">A+</button>
          <span class="tut-color-pick">
            ${Object.keys(COLORS).map(c =>
              `<span class="tut-color-dot${ann.color===c?' active':''}" data-color="${c}" title="${c}"></span>`
            ).join('')}
          </span>
          <button class="tut-cc-btn danger" data-action="delete" title="Delete (Del)">✕</button>
        </div>
        <div class="tut-resize-handle" title="Resize"></div>
      </div>
    `;

    // Apply font size
    el.querySelector('.tut-callout-text').style.fontSize = ann.fontSize + 'px';

    // ── Select on click ──
    el.addEventListener('mousedown', (e) => {
      selectAnnotation(ann.id);
    });

    // ── Drag (on drag handle) ──
    el.querySelector('.tut-drag-handle').addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectAnnotation(ann.id);
      startDrag(e, el, ann);
    });

    // Also allow dragging by bubble area (but not text or controls)
    el.querySelector('.tut-callout-bubble').addEventListener('mousedown', (e) => {
      if (e.target.closest('[contenteditable]') ||
          e.target.closest('.tut-callout-controls') ||
          e.target.closest('.tut-resize-handle')) return;
      e.preventDefault();
      selectAnnotation(ann.id);
      startDrag(e, el, ann);
    });

    // ── Resize ──
    el.querySelector('.tut-resize-handle').addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startResize(e, el, ann);
    });

    // ── Text edit ──
    const textEl = el.querySelector('.tut-callout-text');
    textEl.addEventListener('input', () => {
      ann.text = textEl.innerHTML;
      updateArrows();
    });
    // Prevent drag when editing text
    textEl.addEventListener('mousedown', (e) => e.stopPropagation());

    // ── Controls ──
    el.querySelector('.tut-callout-controls').addEventListener('mousedown', (e) => e.stopPropagation());
    el.querySelector('.tut-callout-controls').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'smaller') {
        ann.fontSize = Math.max(9, ann.fontSize - 1);
        el.querySelector('.tut-callout-text').style.fontSize = ann.fontSize + 'px';
        updateArrows();
      } else if (action === 'larger') {
        ann.fontSize = Math.min(24, ann.fontSize + 1);
        el.querySelector('.tut-callout-text').style.fontSize = ann.fontSize + 'px';
        updateArrows();
      } else if (action === 'delete') {
        deleteAnnotation(ann.id);
      }
    });

    // ── Color dots ──
    el.querySelectorAll('.tut-color-dot').forEach(dot => {
      dot.addEventListener('mousedown', (e) => e.stopPropagation());
      dot.addEventListener('click', (e) => {
        const color = dot.dataset.color;
        ann.color = color;
        el.className = `tut-callout selected color-${color}`;
        el.querySelectorAll('.tut-color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === color));
        // Re-highlight target line in new color
        if (ann.targetLine != null) highlightLine(ann.targetLine, color, 1200);
        updateArrows();
      });
    });

    annotLayer.appendChild(el);
  }

  function selectAnnotation(id) {
    selectedId = id;
    annotLayer.querySelectorAll('.tut-callout').forEach(el => {
      el.classList.toggle('selected', el.dataset.id == id);
    });
  }

  function deselectAll() {
    selectedId = null;
    annotLayer.querySelectorAll('.tut-callout').forEach(el => el.classList.remove('selected'));
  }

  function deleteAnnotation(id) {
    annotations = annotations.filter(a => a.id !== id);
    const el = annotLayer.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
    const lineEl = codeDisplayEl.querySelector('.tut-line.highlighted');
    if (lineEl) lineEl.classList.remove('highlighted', 'green', 'orange', 'purple', 'red');
    selectedId = null;
    updateArrows();
    updateEmptyHint();
  }

  function clearAll() {
    if (annotations.length > 0 && !confirm('Clear all annotations?')) return;
    annotations = [];
    annotLayer.innerHTML = '';
    selectedId = null;
    updateArrows();
    updateEmptyHint();
  }

  // ── Drag ─────────────────────────────────────────────────────────────────
  function startDrag(e, el, ann) {
    const slideRect = slideEl.getBoundingClientRect();
    dragging = { ann, el, startX: e.clientX, startY: e.clientY, origX: ann.x, origY: ann.y, slideRect };

    const onMove = (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - dragging.startX;
      const dy = ev.clientY - dragging.startY;
      dragging.ann.x = dragging.origX + dx;
      dragging.ann.y = dragging.origY + dy;
      dragging.el.style.left = dragging.ann.x + 'px';
      dragging.el.style.top  = dragging.ann.y + 'px';
      updateArrows();
    };

    const onUp = () => {
      dragging = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Resize ───────────────────────────────────────────────────────────────
  function startResize(e, el, ann) {
    resizing = { ann, el, startX: e.clientX, origW: el.offsetWidth };

    const onMove = (ev) => {
      if (!resizing) return;
      const dx = ev.clientX - resizing.startX;
      const newW = Math.max(140, resizing.origW + dx);
      resizing.ann.minWidth = newW;
      resizing.el.style.minWidth = newW + 'px';
      updateArrows();
    };

    const onUp = () => {
      resizing = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Line highlight flash ──────────────────────────────────────────────────
  function highlightLine(lineIndex, color, duration) {
    const lineEl = codeDisplayEl.querySelector(`[data-line="${lineIndex}"]`);
    if (!lineEl) return;
    lineEl.classList.remove('highlighted', 'green', 'orange', 'purple', 'red');
    void lineEl.offsetWidth; // reflow
    lineEl.classList.add('highlighted', color);
    setTimeout(() => {
      lineEl.classList.remove('highlighted', 'green', 'orange', 'purple', 'red');
    }, duration);
  }

  // ── SVG Arrows ───────────────────────────────────────────────────────────
  function updateArrows() {
    if (!arrowsSvg || !slideEl) return;
    arrowsSvg.innerHTML = '';

    const slideRect = slideEl.getBoundingClientRect();

    annotations.forEach(ann => {
      if (ann.targetLine == null) return;
      const lineEl     = codeDisplayEl.querySelector(`[data-line="${ann.targetLine}"]`);
      const calloutEl  = annotLayer.querySelector(`[data-id="${ann.id}"]`);
      if (!lineEl || !calloutEl) return;

      const lineRect    = lineEl.getBoundingClientRect();
      const calloutRect = calloutEl.getBoundingClientRect();

      // Compute positions relative to the slide element
      const x1 = lineRect.right  - slideRect.left + 4;
      const y1 = lineRect.top    + lineRect.height / 2 - slideRect.top;
      const x2 = calloutRect.left - slideRect.left - 4;
      const y2 = calloutRect.top  + calloutRect.height / 2 - slideRect.top;

      const arrowColor = COLORS[ann.color] || COLORS.blue;
      const markerId   = `marker-${ann.id}`;

      // Arrowhead marker
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', markerId);
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('refX', '5');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');
      const arrowPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      arrowPoly.setAttribute('points', '0 0, 6 3, 0 6');
      arrowPoly.setAttribute('fill', arrowColor);
      arrowPoly.setAttribute('opacity', '0.8');
      marker.appendChild(arrowPoly);
      defs.appendChild(marker);
      arrowsSvg.appendChild(defs);

      // Bezier curve: control points curve outward naturally
      const dist = x2 - x1;
      const cx1  = x1 + Math.max(dist * 0.55, 40);
      const cy1  = y1;
      const cx2  = x2 - Math.max(dist * 0.25, 20);
      const cy2  = y2;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`);
      path.setAttribute('stroke', arrowColor);
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-dasharray', '5,3');
      path.setAttribute('opacity', '0.75');
      path.setAttribute('marker-end', `url(#${markerId})`);

      arrowsSvg.appendChild(path);

      // Small dot at start (on the code line end)
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x1);
      dot.setAttribute('cy', y1);
      dot.setAttribute('r', '3');
      dot.setAttribute('fill', arrowColor);
      dot.setAttribute('opacity', '0.7');
      arrowsSvg.appendChild(dot);
    });
  }

  // ── Empty hint ───────────────────────────────────────────────────────────
  function updateEmptyHint() {
    if (!emptyHint) return;
    emptyHint.classList.toggle('hidden', annotations.length > 0);
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  function onKeyDown(e) {
    const panel = document.getElementById('tutorial-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    // Delete selected
    if ((e.key === 'Delete' || e.key === 'Backspace') &&
        e.target.tagName !== 'TEXTAREA' &&
        e.target.tagName !== 'INPUT' &&
        !e.target.closest('[contenteditable]')) {
      if (selectedId != null) {
        deleteAnnotation(selectedId);
      }
    }
    // Escape deselects
    if (e.key === 'Escape') deselectAll();
  }

  // ── PNG Export ────────────────────────────────────────────────────────────
  function exportPNG() {
    if (!window.html2canvas) {
      alert('html2canvas is not loaded. Cannot export PNG.');
      return;
    }

    // Temporarily hide UI-only elements
    const controls = annotLayer.querySelectorAll('.tut-callout-controls, .tut-drag-handle, .tut-resize-handle');
    controls.forEach(el => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });
    const hadSelected = selectedId;
    deselectAll();
    if (exporting) exporting.classList.remove('hidden');

    html2canvas(slideEl, {
      backgroundColor: '#0d1117',
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = sanitizeFilename(titleInput ? titleInput.value : 'tutorial') + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }).catch(err => {
      console.error('Tutorial export failed:', err);
    }).finally(() => {
      controls.forEach(el => { el.style.opacity = ''; el.style.pointerEvents = ''; });
      if (exporting) exporting.classList.add('hidden');
      if (hadSelected != null) selectAnnotation(hadSelected);
    });
  }

  function sanitizeFilename(name) {
    return (name || 'tutorial').replace(/[^a-z0-9_\-]/gi, '-').substring(0, 60) || 'tutorial';
  }

  return { init, updateArrows };
})();
