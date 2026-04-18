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
  let dragging         = null; // {ann, el, startX, startY, origX, origY}
  let resizing         = null; // {ann, el, startX, startW}
  let renderPending    = null;
  let codeWrapDragging = false;
  let codeWrapResizing = false;
  const codeWrapState  = { x: 36, y: 80, w: 460 };
  // Keep the last meaningful selection so toolbar clicks don't collapse it.
  let savedSel = { start: 0, end: 0 };
  let savedCaret = 0;

  function updateSavedSel() {
    if (!codeEditor) return;
    const start = codeEditor.selectionStart ?? 0;
    const end = codeEditor.selectionEnd ?? start;
    savedCaret = start;

    // Only replace the saved range when the editor has an actual selection.
    if (start !== end) {
      savedSel = { start, end };
    }
  }

  function getSelectionSnapshot() {
    if (!codeEditor) return { start: 0, end: 0 };
    const start = codeEditor.selectionStart ?? 0;
    const end = codeEditor.selectionEnd ?? start;

    if (start !== end) {
      return { start, end };
    }
    if (savedSel.start !== savedSel.end) {
      return savedSel;
    }
    return { start: savedCaret, end: savedCaret };
  }

  function getRenderedSelectionSnapshot() {
    const sel = window.getSelection ? window.getSelection() : null;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const inRenderedCode = codeDisplayEl && codeDisplayEl.contains(container.nodeType === 1 ? container : container.parentNode);
    if (!inRenderedCode) return null;

    const getLineEl = (node) => {
      if (!node) return null;
      if (node.nodeType === 1) return node.closest('.tut-line');
      return node.parentElement ? node.parentElement.closest('.tut-line') : null;
    };

    const startLineEl = getLineEl(range.startContainer);
    if (!startLineEl) return null;

    return {
      selectedText: sel.toString().trim(),
      targetLine: Number(startLineEl.dataset.line),
      source: 'rendered',
    };
  }

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

  const FONT_FAMILIES = {
    sans: `Inter, 'Segoe UI', system-ui, sans-serif`,
    mono: `'Fira Code', 'Cascadia Code', 'Consolas', monospace`,
    serif: `'Georgia', 'Times New Roman', serif`,
  };

  const FONT_LABELS = {
    sans: 'Sans',
    mono: 'Mono',
    serif: 'Serif',
  };

  const LINE_PATTERNS = ['solid', 'dashed', 'dotted'];
  const PATH_STYLES = ['smooth', 'line', 'grid'];

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
    const annotBtn = document.getElementById('tut-annotate-btn');
    annotBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateSavedSel();
      addAnnotationFromSelection();
    });
    document.getElementById('tut-add-text-btn').addEventListener('click', addFreeText);
    document.getElementById('tut-clear-btn').addEventListener('click', clearAll);
    document.getElementById('tut-export-btn').addEventListener('click', exportPNG);
    document.getElementById('tut-export-gif-btn')?.addEventListener('click', exportGIF);
    document.getElementById('tut-insert-btn')?.addEventListener('click', insertToSlide);

      // Insert as Interactive Tutorial
      document.getElementById('tut-insert-interactive-btn')?.addEventListener('click', insertInteractiveTutorial);
  // ── Insert as Interactive Tutorial (structured data, not image) ──
  function insertInteractiveTutorial() {
    // Gather code and annotations
    const code = codeEditor.value;
    const lang = langSelect ? langSelect.value : 'javascript';
    const tutorialData = {
      code,
      lang,
      title: titleInput ? titleInput.value : '',
      annotations: annotations.map(a => ({
        text: a.text,
        targetLine: a.targetLine,
        x: a.x,
        y: a.y,
        color: a.color,
        fontSize: a.fontSize,
        minWidth: a.minWidth,
        fontFamily: a.fontFamily,
        opacity: a.opacity,
        linePattern: a.linePattern,
        pathStyle: a.pathStyle,
        arrowEnabled: a.arrowEnabled,
        highlightEnabled: a.highlightEnabled,
        selectedText: a.selectedText,
      }))
    };

    // Insert as a new 'tutorial' element in VisualBuilder
    if (window.VisualBuilder) {
      const el = window.VisualBuilder.addElement('tutorial');
      if (el) {
        window.VisualBuilder.updateElement(el.id, { tutorialData });
      }
      // Switch to Visual mode
      const visualBtn = document.querySelector('.mode-btn[data-mode="visual"]');
      if (visualBtn) visualBtn.click();
    } else {
      alert('Visual Builder not available.');
    }
  }

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

    // Code editor → live render + track selection
    codeEditor.addEventListener('input', scheduleRender);
    codeEditor.addEventListener('scroll', updateArrows);
    codeEditor.addEventListener('select', updateSavedSel);
    codeEditor.addEventListener('keyup', updateSavedSel);
    codeEditor.addEventListener('mouseup', updateSavedSel);
    codeEditor.addEventListener('focus', updateSavedSel);
    codeEditor.addEventListener('blur', updateSavedSel);

    // Click outside deselects
    slideEl.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.tut-callout')) deselectAll();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);

    // Code wrap — draggable & resizable floating card
    const cwEl  = document.getElementById('tut-slide-code-wrap');
    const cwBar = document.getElementById('tut-slide-code-bar');
    const cwRsz = document.getElementById('tut-code-wrap-resize');
    if (cwEl) {
      applyCWPos();
      if (cwBar) cwBar.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startCodeWrapDrag(e);
      });
      if (cwRsz) cwRsz.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startCodeWrapResize(e);
      });
    }

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
    // Re-apply persistent highlights for existing annotations.
    annotations.forEach(ann => {
      if (ann.targetLine != null && ann.highlightEnabled !== false) {
        setLineHighlight(ann.targetLine, ann.color, ann.selectedText);
      }
    });
    updateArrows();
    updateEmptyHint();
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Annotations ──────────────────────────────────────────────────────────
  function addAnnotationFromSelection() {
    const renderedSnap = getRenderedSelectionSnapshot();
    let selectedText = '';
    let targetLine = 0;

    if (renderedSnap) {
      selectedText = renderedSnap.selectedText;
      targetLine = renderedSnap.targetLine;
    } else {
      const snap  = getSelectionSnapshot();
      const start = snap.start;
      const end   = snap.end;
      selectedText = codeEditor.value.substring(start, end).trim();

      // Determine line number from the start of the selection
      const beforeSel = codeEditor.value.substring(0, start);
      targetLine = (beforeSel.match(/\n/g) || []).length;
    }

    // Build initial annotation text
    let initialText;
    if (selectedText) {
      const escaped = escapeHtml(selectedText);
      initialText = `<strong>${escaped}</strong> — `;
    } else {
      initialText = 'Explain this code…';
    }

    createAnnotation(initialText, targetLine, selectedText);

    const sel = window.getSelection ? window.getSelection() : null;
    if (sel && sel.rangeCount > 0) sel.removeAllRanges();
  }

  function clearInlineHighlights(lineEl) {
    if (!lineEl) return;
    lineEl.querySelectorAll('.tut-inline-highlight').forEach((el) => {
      el.replaceWith(...el.childNodes);
    });
    lineEl.normalize();
  }

  function findTextRange(lineEl, needle) {
    if (!lineEl || !needle) return null;
    const haystack = lineEl.textContent || '';
    const normalizedNeedle = needle.trim();
    if (!normalizedNeedle) return null;

    let startIndex = haystack.indexOf(normalizedNeedle);
    if (startIndex < 0) {
      const compactHaystack = haystack.replace(/\s+/g, ' ');
      const compactNeedle = normalizedNeedle.replace(/\s+/g, ' ');
      startIndex = compactHaystack.indexOf(compactNeedle);
      if (startIndex < 0) return null;
    }

    const endIndex = startIndex + normalizedNeedle.length;
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const length = node.textContent.length;
      const nodeStart = currentOffset;
      const nodeEnd = currentOffset + length;

      if (!startNode && startIndex >= nodeStart && startIndex <= nodeEnd) {
        startNode = node;
        startOffset = startIndex - nodeStart;
      }

      if (!endNode && endIndex >= nodeStart && endIndex <= nodeEnd) {
        endNode = node;
        endOffset = endIndex - nodeStart;
        break;
      }

      currentOffset = nodeEnd;
    }

    if (!startNode || !endNode) return null;
    return { startNode, startOffset, endNode, endOffset };
  }

  function applyInlineHighlight(lineEl, color, selectedText) {
    const match = findTextRange(lineEl, selectedText);
    if (!match) return false;

    const range = document.createRange();
    range.setStart(match.startNode, match.startOffset);
    range.setEnd(match.endNode, match.endOffset);

    const marker = document.createElement('span');
    marker.className = `tut-inline-highlight ${color}`;
    marker.dataset.selectedText = selectedText;
    const fragment = range.extractContents();
    marker.appendChild(fragment);
    range.insertNode(marker);
    return true;
  }

  function setLineHighlight(lineIndex, color, selectedText = '') {
    if (lineIndex == null) return;
    const lineEl = codeDisplayEl.querySelector(`[data-line="${lineIndex}"]`);
    if (!lineEl) return;
    clearInlineHighlights(lineEl);
    lineEl.classList.remove('green', 'orange', 'purple', 'red', 'blue');
    lineEl.classList.remove('highlighted');

    if (selectedText && applyInlineHighlight(lineEl, color, selectedText)) {
      return;
    }

    lineEl.classList.add('highlighted', color);
  }

  function clearLineHighlight(lineIndex) {
    if (lineIndex == null) return;
    const lineEl = codeDisplayEl.querySelector(`[data-line="${lineIndex}"]`);
    if (!lineEl) return;
    clearInlineHighlights(lineEl);
    lineEl.classList.remove('highlighted', 'green', 'orange', 'purple', 'red', 'blue');
  }

  function cycleOption(current, values) {
    const idx = values.indexOf(current);
    return values[(idx + 1) % values.length];
  }

  function syncAnnotationVisuals(el, ann) {
    if (!el) return;
    el.className = `tut-callout${ann.highlightEnabled === false ? ' no-highlight' : ''} color-${ann.color}` +
      (selectedId === ann.id ? ' selected' : '');
    el.style.left = ann.x + 'px';
    el.style.top = ann.y + 'px';
    el.style.minWidth = ann.minWidth + 'px';
    el.style.setProperty('--tut-bubble-opacity', ann.opacity);

    const textEl = el.querySelector('.tut-callout-text');
    if (textEl) {
      textEl.style.fontSize = ann.fontSize + 'px';
      textEl.style.fontFamily = FONT_FAMILIES[ann.fontFamily] || FONT_FAMILIES.sans;
    }

    const lineBtn = el.querySelector('[data-role="line-style"]');
    if (lineBtn) lineBtn.textContent = ann.linePattern;

    const pathBtn = el.querySelector('[data-role="path-style"]');
    if (pathBtn) pathBtn.textContent = ann.pathStyle;

    const fontBtn = el.querySelector('[data-role="font-family"]');
    if (fontBtn) fontBtn.textContent = FONT_LABELS[ann.fontFamily] || 'Sans';

    const hlBtn = el.querySelector('[data-role="highlight-toggle"]');
    if (hlBtn) {
      hlBtn.textContent = ann.highlightEnabled === false ? 'No HL' : 'HL';
      hlBtn.classList.toggle('active', ann.highlightEnabled !== false);
    }

    const arrowBtn = el.querySelector('[data-role="arrow-toggle"]');
    if (arrowBtn) {
      arrowBtn.textContent = ann.arrowEnabled === false ? 'No Arrow' : 'Arrow';
      arrowBtn.classList.toggle('active', ann.arrowEnabled !== false);
    }

    const opacityBtn = el.querySelector('[data-role="opacity-level"]');
    if (opacityBtn) opacityBtn.textContent = `${Math.round((ann.opacity || 0.92) * 100)}%`;

    el.querySelectorAll('.tut-color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === ann.color));
  }

  function addFreeText() {
    createAnnotation('Add your text here…', null);
  }

  function createAnnotation(text, targetLine, selectedText = '') {
    ++annIdCounter;
    const count = annotations.length;

    // Place the callout to the right of the code-block widget, aligned
    // vertically with the target line (or staggered if no specific line).
    let initX = 640;
    let initY = 60 + count * 100;

    const codeWrap = document.getElementById('tut-slide-code-wrap');
    if (codeWrap && slideEl) {
      const cwRect = codeWrap.getBoundingClientRect();
      const sr     = slideEl.getBoundingClientRect();
      // Only trust the rect when the panel is actually visible (non-zero size)
      if (cwRect.width > 0) {
        initX = cwRect.right - sr.left + 24 + (count % 2) * 12;

        if (targetLine != null) {
          const lineEl = codeDisplayEl.querySelector(`[data-line="${targetLine}"]`);
          if (lineEl) {
            const lr = lineEl.getBoundingClientRect();
            initY = Math.max(20, lr.top - sr.top - 24);
          }
        }
        // Stagger subsequent callouts downward so they don't overlap
        initY += Math.floor(count / 2) * 120;
      }
    }

    const ann = {
      id:        annIdCounter,
      text,
      targetLine,
      selectedText,
      x:         initX,
      y:         initY,
      color:     'blue',
      fontSize:  13,
      minWidth:  180,
      fontFamily: 'sans',
      opacity: 0.92,
      linePattern: 'dashed',
      pathStyle: 'smooth',
      arrowEnabled: targetLine != null,
      highlightEnabled: targetLine != null,
    };

    annotations.push(ann);
    if (targetLine != null && ann.highlightEnabled !== false) {
      setLineHighlight(targetLine, ann.color, ann.selectedText);
    }
    renderAnnotation(ann);
    selectAnnotation(ann.id);
    // Defer arrow update to next frame so DOM layout is complete
    requestAnimationFrame(() => updateArrows());
    updateEmptyHint();
  }

  function renderAnnotation(ann) {
    const el = document.createElement('div');
    el.className = `tut-callout color-${ann.color}`;
    el.dataset.id = ann.id;
    el.style.cssText = `left:${ann.x}px;top:${ann.y}px;min-width:${ann.minWidth}px;--tut-bubble-opacity:${ann.opacity};`;

    el.innerHTML = `
      <div class="tut-drag-handle" title="Drag to move"></div>
      <div class="tut-callout-bubble">
        <div class="tut-callout-text" contenteditable="true" spellcheck="false">${ann.text}</div>
        <div class="tut-callout-controls">
          <button class="tut-cc-btn" data-action="smaller" title="Smaller text (A-)">A-</button>
          <button class="tut-cc-btn" data-action="larger"  title="Larger text (A+)">A+</button>
          <button class="tut-cc-btn" data-action="font" data-role="font-family" title="Cycle font family">Sans</button>
          <button class="tut-cc-btn" data-action="opacity" data-role="opacity-level" title="Cycle box opacity">92%</button>
          <button class="tut-cc-btn" data-action="toggle-arrow" data-role="arrow-toggle" title="Toggle arrow">Arrow</button>
          <button class="tut-cc-btn" data-action="line-style" data-role="line-style" title="Cycle line style">dashed</button>
          <button class="tut-cc-btn" data-action="path-style" data-role="path-style" title="Cycle path style">smooth</button>
          <button class="tut-cc-btn" data-action="toggle-highlight" data-role="highlight-toggle" title="Toggle code highlight">HL</button>
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
  syncAnnotationVisuals(el, ann);

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
        updateArrows();
      } else if (action === 'larger') {
        ann.fontSize = Math.min(24, ann.fontSize + 1);
        updateArrows();
      } else if (action === 'font') {
        ann.fontFamily = cycleOption(ann.fontFamily, Object.keys(FONT_FAMILIES));
      } else if (action === 'opacity') {
        const levels = [0.72, 0.84, 0.92, 1];
        ann.opacity = cycleOption(ann.opacity, levels);
      } else if (action === 'line-style') {
        ann.linePattern = cycleOption(ann.linePattern, LINE_PATTERNS);
      } else if (action === 'path-style') {
        ann.pathStyle = cycleOption(ann.pathStyle, PATH_STYLES);
      } else if (action === 'toggle-arrow') {
        ann.arrowEnabled = ann.arrowEnabled === false;
      } else if (action === 'toggle-highlight') {
        ann.highlightEnabled = ann.highlightEnabled === false;
        if (ann.targetLine != null) {
          if (ann.highlightEnabled === false) clearLineHighlight(ann.targetLine);
          else setLineHighlight(ann.targetLine, ann.color, ann.selectedText);
        }
        updateArrows();
      } else if (action === 'delete') {
        deleteAnnotation(ann.id);
        return;
      }

      syncAnnotationVisuals(el, ann);
      updateArrows();
    });

    // ── Color dots ──
    el.querySelectorAll('.tut-color-dot').forEach(dot => {
      dot.addEventListener('mousedown', (e) => e.stopPropagation());
      dot.addEventListener('click', (e) => {
        const color = dot.dataset.color;
        ann.color = color;
        if (ann.targetLine != null && ann.highlightEnabled !== false) {
          setLineHighlight(ann.targetLine, color, ann.selectedText);
        }
        syncAnnotationVisuals(el, ann);
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
    annotations.forEach(ann => {
      const el = annotLayer.querySelector(`[data-id="${ann.id}"]`);
      if (el) syncAnnotationVisuals(el, ann);
    });
  }

  function deselectAll() {
    selectedId = null;
    annotLayer.querySelectorAll('.tut-callout').forEach(el => el.classList.remove('selected'));
  }

  function deleteAnnotation(id) {
    const ann = annotations.find(a => a.id === id);
    annotations = annotations.filter(a => a.id !== id);
    const el = annotLayer.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
    // Only remove highlight if no other annotation targets the same line
    if (ann && ann.targetLine != null) {
      const stillUsed = annotations.find(a => a.targetLine === ann.targetLine && a.highlightEnabled !== false);
      if (!stillUsed) clearLineHighlight(ann.targetLine);
      else setLineHighlight(stillUsed.targetLine, stillUsed.color, stillUsed.selectedText);
    }
    selectedId = null;
    updateArrows();
    updateEmptyHint();
  }

  function clearAll() {
    if (annotations.length > 0 && !confirm('Clear all annotations?')) return;
    // Remove all line highlights
    codeDisplayEl.querySelectorAll('.tut-line.highlighted').forEach(el => {
      el.classList.remove('highlighted', 'green', 'orange', 'purple', 'red', 'blue');
    });
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

  // ── Code-wrap drag & resize ───────────────────────────────────────────────
  function applyCWPos() {
    const el = document.getElementById('tut-slide-code-wrap');
    if (!el) return;
    el.style.left  = codeWrapState.x + 'px';
    el.style.top   = codeWrapState.y + 'px';
    el.style.width = codeWrapState.w + 'px';
  }

  function startCodeWrapDrag(e) {
    const startX = e.clientX, startY = e.clientY;
    const origX  = codeWrapState.x, origY = codeWrapState.y;
    codeWrapDragging = true;
    const onMove = (ev) => {
      codeWrapState.x = origX + (ev.clientX - startX);
      codeWrapState.y = origY + (ev.clientY - startY);
      applyCWPos();
      updateArrows();
    };
    const onUp = () => {
      codeWrapDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startCodeWrapResize(e) {
    const startX = e.clientX;
    const origW  = codeWrapState.w;
    codeWrapResizing = true;
    const onMove = (ev) => {
      codeWrapState.w = Math.max(180, origW + (ev.clientX - startX));
      applyCWPos();
      updateArrows();
    };
    const onUp = () => {
      codeWrapResizing = false;
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
      if (ann.targetLine == null || ann.arrowEnabled === false) return;
      const lineEl     = codeDisplayEl.querySelector(`[data-line="${ann.targetLine}"]`);
      const calloutEl  = annotLayer.querySelector(`[data-id="${ann.id}"]`);
      if (!lineEl || !calloutEl) return;
      // Only draw arrow if callout is visible (opacity not '0')
      const style = window.getComputedStyle(calloutEl);
      if (style.opacity === '0' || style.display === 'none' || style.visibility === 'hidden') return;


      const lineRect    = lineEl.getBoundingClientRect();
      const calloutRect = calloutEl.getBoundingClientRect();

      // Arrow ends at the nearest horizontal edge of the callout, vertically centred, but clamped to the callout box.
      const annLeft  = calloutRect.left  - slideRect.left;
      const annRight = calloutRect.right - slideRect.left;
      // Clamp y2 to be within the callout box
      let y2 = calloutRect.top + calloutRect.height / 2 - slideRect.top;
      const calloutTop = calloutRect.top - slideRect.top;
      const calloutBottom = calloutRect.bottom - slideRect.top;
      if (y2 < calloutTop + 8) y2 = calloutTop + 8; // 8px padding
      if (y2 > calloutBottom - 8) y2 = calloutBottom - 8;

      // Arrow starts from the selected token when available.
      const codeWrap = document.getElementById('tut-slide-code-wrap');
      const codeWrapRect = codeWrap ? codeWrap.getBoundingClientRect() : lineRect;
      const inlineHighlight = ann.selectedText
        ? lineEl.querySelector(`.tut-inline-highlight[data-selected-text="${CSS.escape(ann.selectedText)}"]`) || lineEl.querySelector('.tut-inline-highlight')
        : null;


      let x1;
      let y1;
      if (inlineHighlight) {
        const tokenRect = inlineHighlight.getBoundingClientRect();
        const tokenLeft = tokenRect.left - slideRect.left;
        const tokenRight = tokenRect.right - slideRect.left;
        const noteIsRight = annLeft >= tokenRight;
        x1 = noteIsRight ? tokenRight + 4 : tokenLeft - 4;
        y1 = tokenRect.top + tokenRect.height / 2 - slideRect.top;
      } else {
        const noteIsRight = annLeft >= (codeWrapRect.right - slideRect.left);
        x1 = noteIsRight
          ? codeWrapRect.right - slideRect.left + 4
          : codeWrapRect.left - slideRect.left - 4;
        y1 = lineRect.top + lineRect.height / 2 - slideRect.top;
      }
      // Clamp y1 to be within the callout box vertical bounds (with padding)
      if (y1 < calloutTop + 8) y1 = calloutTop + 8;
      if (y1 > calloutBottom - 8) y1 = calloutBottom - 8;

      const x2 = (annLeft >= x1 - 10) ? annLeft - 4 : annRight + 4;

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

      let pathData = '';
      if (ann.pathStyle === 'line') {
        pathData = `M${x1},${y1} L${x2},${y2}`;
      } else if (ann.pathStyle === 'grid') {
        const midX = x1 + (x2 - x1) * 0.45;
        pathData = `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`;
      } else {
        const pull = Math.min(Math.max(Math.abs(x2 - x1) * 0.5, 40), 140);
        let cx1, cy1, cx2, cy2;
        if (x2 >= x1) {
          cx1 = x1 + pull;       cy1 = y1;
          cx2 = x2 - pull * 0.4; cy2 = y2;
        } else {
          cx1 = x1 - pull;       cy1 = y1;
          cx2 = x2 + pull * 0.4; cy2 = y2;
        }
        pathData = `M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
      }

      let dash = null;
      if (ann.linePattern === 'dashed') dash = '6,4';
      if (ann.linePattern === 'dotted') dash = '2,5';

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('stroke', arrowColor);
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('fill', 'none');
      if (dash) path.setAttribute('stroke-dasharray', dash);
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

    const exportBtn = document.getElementById('tut-export-btn');
    const originalExportLabel = exportBtn ? exportBtn.innerHTML : '';

    // Temporarily hide UI-only elements
    const controls = annotLayer.querySelectorAll(
      '.tut-callout-controls, .tut-drag-handle, .tut-resize-handle'
    );
    controls.forEach(el => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });
    // Remove hover/selected/active classes from all callouts
    annotLayer.querySelectorAll('.tut-callout').forEach(el => {
      el.classList.remove('hover', 'selected', 'active');
      el.classList.add('no-accent'); // Hide accent stripe
    });

    const emptyHintWasHidden = emptyHint ? emptyHint.classList.contains('hidden') : true;
    if (emptyHint) emptyHint.classList.add('hidden');

    // Hide code-wrap interactive chrome
    const cwResize = document.getElementById('tut-code-wrap-resize');
    if (cwResize) cwResize.style.display = 'none';

    const hadSelected = selectedId;
    deselectAll();
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerHTML = '⏳ Generating PNG…';
    }

    // Snapshot the full canvas panel so absolutely-positioned elements are included
    const captureEl = slideEl;
    const slideRect = captureEl.getBoundingClientRect();

    html2canvas(captureEl, {
      backgroundColor: '#0d1117',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width:  Math.ceil(slideRect.width),
      height: Math.ceil(slideRect.height),
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        const clonedOverlay = clonedDoc.getElementById('tut-exporting-overlay');
        if (clonedOverlay) clonedOverlay.style.display = 'none';

        const clonedEmptyHint = clonedDoc.getElementById('tut-empty-hint');
        if (clonedEmptyHint) clonedEmptyHint.style.display = 'none';

        clonedDoc.querySelectorAll(
          '.tut-callout-controls, .tut-drag-handle, .tut-resize-handle, #tut-code-wrap-resize'
        ).forEach((el) => {
          el.style.display = 'none';
          el.style.opacity = '0';
        });
      },
    }).then(canvas => {
      const filename = sanitizeFilename(titleInput ? titleInput.value : 'tutorial') + '.png';
      const dataUrl  = canvas.toDataURL('image/png');

      // Must be in DOM for Firefox / Chrome to trigger the download
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 100);
    }).catch(err => {
      console.error('Tutorial export failed:', err);
      alert('PNG export failed. Check the browser console for details.');
    }).finally(() => {
      controls.forEach(el => { el.style.opacity = ''; el.style.pointerEvents = ''; });
      if (cwResize) cwResize.style.display = '';
      if (emptyHint && !emptyHintWasHidden) emptyHint.classList.remove('hidden');
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalExportLabel;
      }
      if (exporting) exporting.classList.add('hidden');
      if (hadSelected != null) selectAnnotation(hadSelected);
      // Restore accent stripe
      annotLayer.querySelectorAll('.tut-callout').forEach(el => {
        el.classList.remove('no-accent');
      });
    });
  }

  function sanitizeFilename(name) {
    return (name || 'tutorial').replace(/[^a-z0-9_\-]/gi, '-').substring(0, 60) || 'tutorial';
  }

  // ── Insert to Slide (add as image element to current Visual Builder slide) ───
  function insertToSlide() {
    if (!window.html2canvas) {
      alert('html2canvas is not loaded. Cannot generate image.');
      return;
    }

    const insertBtn = document.getElementById('tut-insert-btn');
    const originalLabel = insertBtn ? insertBtn.innerHTML : '';

    // Temporarily hide UI controls
    const controls = annotLayer.querySelectorAll(
      '.tut-callout-controls, .tut-drag-handle, .tut-resize-handle'
    );
    controls.forEach(el => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });

    const emptyHintWasHidden = emptyHint ? emptyHint.classList.contains('hidden') : true;
    if (emptyHint) emptyHint.classList.add('hidden');

    const cwResize = document.getElementById('tut-code-wrap-resize');
    if (cwResize) cwResize.style.display = 'none';

    const hadSelected = selectedId;
    deselectAll();

    if (insertBtn) {
      insertBtn.disabled = true;
      insertBtn.innerHTML = '⏳ Generating…';
    }

    const captureEl = slideEl;
    const slideRect = captureEl.getBoundingClientRect();

    html2canvas(captureEl, {
      backgroundColor: '#0d1117',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: Math.ceil(slideRect.width),
      height: Math.ceil(slideRect.height),
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        const clonedOverlay = clonedDoc.getElementById('tut-exporting-overlay');
        if (clonedOverlay) clonedOverlay.style.display = 'none';
        const clonedEmptyHint = clonedDoc.getElementById('tut-empty-hint');
        if (clonedEmptyHint) clonedEmptyHint.style.display = 'none';
        clonedDoc.querySelectorAll(
          '.tut-callout-controls, .tut-drag-handle, .tut-resize-handle, #tut-code-wrap-resize'
        ).forEach((el) => {
          el.style.display = 'none';
          el.style.opacity = '0';
        });
      },
    }).then(canvas => {
      const dataUrl = canvas.toDataURL('image/png');
      const name = sanitizeFilename(titleInput ? titleInput.value : 'tutorial');

      // Insert as image element in current Visual Builder slide
      if (window.VisualBuilder) {
        const el = window.VisualBuilder.addElement('image');
        if (el) {
          window.VisualBuilder.updateElement(el.id, { url: dataUrl, alt: name });
        }
        // Switch to Visual mode so user sees the result
        const visualRadio = document.querySelector('input[name="mode"][value="visual"]');
        if (visualRadio) {
          visualRadio.checked = true;
          visualRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        alert('Visual Builder not available.');
      }
    }).catch(err => {
      console.error('Tutorial insert failed:', err);
      alert('Insert to slide failed. Check the browser console.');
    }).finally(() => {
      controls.forEach(el => { el.style.opacity = ''; el.style.pointerEvents = ''; });
      if (cwResize) cwResize.style.display = '';
      if (emptyHint && !emptyHintWasHidden) emptyHint.classList.remove('hidden');
      if (insertBtn) {
        insertBtn.disabled = false;
        insertBtn.innerHTML = originalLabel;
      }
      if (hadSelected != null) selectAnnotation(hadSelected);
    });
  }

  // ── Animated GIF Export ─────────────────────────────────────────────────
  // Approach: reveal callouts one-by-one, capture each frame with html2canvas,
  // then encode into an animated GIF using gif.js.
  async function exportGIF() {
    if (!window.html2canvas) {
      alert('html2canvas is not loaded. Cannot export GIF.');
      return;
    }
    if (typeof GIF === 'undefined') {
      alert('gif.js is not loaded. Cannot export GIF.');
      return;
    }
    if (annotations.length === 0) {
      alert('No annotations to animate. Add at least one callout first.');
      return;
    }

    const gifBtn = document.getElementById('tut-export-gif-btn');
    const gifOverlay = document.getElementById('tut-gif-overlay');
    const gifStatus = document.getElementById('tut-gif-status');
    const gifFill = document.getElementById('tut-gif-progress-fill');

    const setStatus = (msg, pct) => {
      if (gifStatus) gifStatus.textContent = msg;
      if (gifFill) gifFill.style.width = (pct || 0) + '%';
    };

    if (gifBtn) { gifBtn.disabled = true; gifBtn.innerHTML = '⏳ Exporting…'; }
    if (gifOverlay) gifOverlay.classList.remove('hidden');
    setStatus('🎞 Preparing frames…', 0);

    // Hide UI chrome for capture
    const controls = annotLayer.querySelectorAll(
      '.tut-callout-controls, .tut-drag-handle, .tut-resize-handle'
    );
    controls.forEach(el => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });
    // Remove hover/selected/active classes from all callouts
    annotLayer.querySelectorAll('.tut-callout').forEach(el => {
      el.classList.remove('hover', 'selected', 'active');
    });
    const cwResize = document.getElementById('tut-code-wrap-resize');
    if (cwResize) cwResize.style.display = 'none';
    const emptyHintWasHidden = emptyHint ? emptyHint.classList.contains('hidden') : true;
    if (emptyHint) emptyHint.classList.add('hidden');
    const hadSelected = selectedId;
    deselectAll();

    // Hide ALL callouts initially
    const calloutEls = annotLayer.querySelectorAll('.tut-callout');
    calloutEls.forEach(el => { el.style.opacity = '0'; });

    const slideRect = slideEl.getBoundingClientRect();
    const captureOpts = {
      backgroundColor: '#0d1117',
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: Math.ceil(slideRect.width),
      height: Math.ceil(slideRect.height),
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        const ov = clonedDoc.getElementById('tut-gif-overlay');
        if (ov) ov.style.display = 'none';
        const ov2 = clonedDoc.getElementById('tut-exporting-overlay');
        if (ov2) ov2.style.display = 'none';
        clonedDoc.querySelectorAll('.tut-callout-controls, .tut-drag-handle, .tut-resize-handle, #tut-code-wrap-resize')
          .forEach(el => { el.style.display = 'none'; });
      },
    };

    const gif = new GIF({
      workers: 2,
      quality: 8,
      workerScript: 'js/gif.worker.js',
    });

    const frames = [];
    const totalFrames = annotations.length + 2; // opening frame + 1 per callout + final hold

    try {
      // Frame 0: no callouts (show only code)
      setStatus('📷 Capturing base frame…', 5);
      const f0 = await html2canvas(slideEl, captureOpts);
      frames.push({ canvas: f0, delay: 800 });

      // Reveal each callout step-by-step
      for (let i = 0; i < annotations.length; i++) {
        const ann = annotations[i];
        // Show this callout with a fade-in animation
        const calloutEl = annotLayer.querySelector(`.tut-callout[data-id="${ann.id}"]`);
        if (calloutEl) {
          calloutEl.style.transition = 'opacity 0s';
          calloutEl.style.opacity = '1';
        }
        // Update arrows for current visible state
        updateArrows();
        // Small delay to let DOM settle
        await new Promise(r => setTimeout(r, 80));

        const pct = 10 + Math.round((i + 1) / annotations.length * 70);
        setStatus(`📷 Capturing callout ${i + 1} / ${annotations.length}…`, pct);

        const fc = await html2canvas(slideEl, captureOpts);
        frames.push({ canvas: fc, delay: i === annotations.length - 1 ? 2000 : 900 });
      }

      // Final hold frame (all visible, longer delay)
      setStatus('📷 Capturing final frame…', 85);
      const fFinal = await html2canvas(slideEl, captureOpts);
      frames.push({ canvas: fFinal, delay: 2500 });

      // Add all frames to gif.js
      setStatus('🔧 Encoding GIF…', 88);
      frames.forEach(f => gif.addFrame(f.canvas, { delay: f.delay, copy: true }));

      gif.on('progress', (p) => setStatus(`🔧 Encoding GIF… ${Math.round(p * 100)}%`, 88 + Math.round(p * 10)));

      gif.on('finished', (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = sanitizeFilename(titleInput ? titleInput.value : 'tutorial') + '.gif';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);

        setStatus('✅ Done!', 100);
        setTimeout(() => {
          if (gifOverlay) gifOverlay.classList.add('hidden');
          if (gifBtn) { gifBtn.disabled = false; gifBtn.innerHTML = '🎞 Export GIF'; }
        }, 1200);
      });

      gif.render();

    } catch (err) {
      console.error('GIF export failed:', err);
      alert('GIF export failed: ' + err.message);
      if (gifOverlay) gifOverlay.classList.add('hidden');
      if (gifBtn) { gifBtn.disabled = false; gifBtn.innerHTML = '🎞 Export GIF'; }
    } finally {
      // Restore all callouts visible
      calloutEls.forEach(el => { el.style.opacity = ''; el.style.transition = ''; });
      controls.forEach(el => { el.style.opacity = ''; el.style.pointerEvents = ''; });
      if (cwResize) cwResize.style.display = '';
      if (emptyHint && !emptyHintWasHidden) emptyHint.classList.remove('hidden');
      if (hadSelected != null) selectAnnotation(hadSelected);
      // Restore accent stripe
      annotLayer.querySelectorAll('.tut-callout').forEach(el => {
        el.classList.remove('no-accent');
      });
    }
  }

  return { init, updateArrows };
})();
