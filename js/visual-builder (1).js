/**
 * visual-builder.js — Visual drag-and-drop slide builder.
 *
 * Manages a data model of slides, each containing ordered elements.
 * Elements can be added from the palette (drag or click), reordered
 * within a slide via drag-and-drop, and edited via the properties panel.
 * Changes auto-generate markdown (the reverse flow).
 */
window.VisualBuilder = (function () {
  'use strict';

  // ===== Data Model =====
  // Each slide: { id, directives: {}, elements: [ { id, type, content, ... } ] }
  let slideModels = [];
  let activeSlideIndex = 0;
  let selectedElementId = null;
  let elementIdCounter = 0;
  let slideIdCounter = 0;
  let onChangeCallback = null;

  // ===== Default element content =====
  const ELEMENT_DEFAULTS = {
      tutorial: { type: 'tutorial', tutorialData: { code: '', lang: 'javascript', title: '', annotations: [] } },
    heading:   { type: 'heading', content: 'Slide Title', level: 2 },
    text:      { type: 'text', content: 'Your text content here.' },
    bullets:   { type: 'bullets', content: 'First point\nSecond point\nThird point' },
    numbered:  { type: 'numbered', content: 'Step one\nStep two\nStep three' },
    fragments: { type: 'fragments', content: 'Appear first\nAppear second\nAppear third' },
    code:      { type: 'code', content: 'print("Hello, World!")', language: 'python' },
    table:     { type: 'table', content: '| Feature | Value |\n|---------|-------|\n| Speed   | Fast  |\n| Cost    | Low   |' },
    image:     { type: 'image', url: 'https://via.placeholder.com/600x300/264653/ffffff?text=Image', alt: '', bgMode: '', sizing: '', filters: [], width: '', height: '' },
    quote:     { type: 'quote', content: '"The best way to predict the future is to invent it."' },
    math:      { type: 'math', content: 'E = mc^2' },
    columns:   { type: 'columns', leftContent: '### Left\n- Item A\n- Item B', rightContent: '### Right\n- Item X\n- Item Y' },
    hr:        { type: 'hr', content: '' },
    fittext:   { type: 'fittext', content: 'BIG TEXT' },
    html:      { type: 'html', content: '<button class="button-primary">Buy Now</button>\n<div data-component="card">Premium content card</div>' },
    hyperframe: { type: 'hyperframe',
      width: 1280, height: 360,
      // HeyGen HyperFrames spec stub — see https://github.com/heygen-com/hyperframes
      // Composition root carries data-composition-id / data-width / data-height /
      // data-start / data-duration. GSAP timelines register on window.__timelines
      // in PAUSED state so the renderer can seek frame-by-frame for MP4 export.
      content: [
        '<!-- HyperFrames composition stub (HeyGen spec). Renders here as an',
        '     interactive preview; can also be fed to `npx hyperframes render`. -->',
        '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>',
        '<style>',
        '  html, body { margin:0; width:1920px; height:1080px; background:#0a0a0a;',
        '               overflow:hidden; font-family:Inter,system-ui,sans-serif; }',
        '  #stage { position:relative; width:1920px; height:1080px;',
        '           transform-origin:0 0; }',
        '  .title { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);',
        '           color:#fff; font-size:140px; font-weight:600; letter-spacing:-0.02em; }',
        '  .cap { position:absolute; bottom:80px; left:50%; transform:translateX(-50%);',
        '         color:rgba(240,235,220,0.92); font-size:40px;',
        '         background:rgba(10,8,5,0.55); padding:12px 28px; border-radius:10px; }',
        '</style>',
        '<div id="stage"',
        '     data-composition-id="my-comp"',
        '     data-width="1920" data-height="1080"',
        '     data-start="0" data-duration="5">',
        '  <div class="title">Hello, HyperFrames</div>',
        '  <div class="cap clip" data-start="0.5" data-duration="3"',
        '       data-track-index="20">Write HTML. Render video.</div>',
        '</div>',
        '<!-- Audio (optional). The renderer mixes by data-start / data-duration. -->',
        '<!-- <audio id="vo" src="assets/voiceover.mp3"',
        '             data-start="0" data-duration="5"',
        '             data-track-index="0" data-volume="1"></audio> -->',
        '<script>',
        '  // Fit the 1920x1080 stage into whatever box the iframe gives us.',
        '  (function fit() {',
        '    const s = document.getElementById("stage");',
        '    const r = () => {',
        '      const k = Math.min(window.innerWidth/1920, window.innerHeight/1080);',
        '      s.style.transform = "scale(" + k + ")";',
        '    };',
        '    r(); window.addEventListener("resize", r);',
        '  })();',
        '  // Register a PAUSED GSAP timeline on window.__timelines["<composition-id>"].',
        '  // The HyperFrames engine seeks this for deterministic frame-perfect render.',
        '  window.__timelines = window.__timelines || {};',
        '  const tl = gsap.timeline({ paused: true });',
        '  tl.from(".title", { opacity: 0, y: 60, duration: 1, ease: "power2.out" })',
        '    .from(".cap",   { opacity: 0, y: 20, duration: 0.6 }, 0.5);',
        '  window.__timelines["my-comp"] = tl;',
        '  // For interactive preview only: play locally. The renderer ignores this.',
        '  tl.play();',
        '</script>',
      ].join('\n'),
    },
    imageCompare: { type: 'imageCompare', leftImage: 'https://via.placeholder.com/400x250/264653/ffffff?text=Before', rightImage: 'https://via.placeholder.com/400x250/e76f51/ffffff?text=After', leftLabel: 'Before', rightLabel: 'After' },
    imageCombine: { type: 'imageCombine', sourceImages: [
      { url: 'https://via.placeholder.com/300x250/264653/ffffff?text=Source+1', label: 'Source 1' },
      { url: 'https://via.placeholder.com/250x200/2a9d8f/ffffff?text=Source+2', label: 'Source 2' },
    ], resultImage: 'https://via.placeholder.com/400x300/e76f51/ffffff?text=Result', resultLabel: 'Result' },
    imageGrid: { type: 'imageGrid', images: [
      { url: 'https://via.placeholder.com/300x200/264653/ffffff?text=Image+1', caption: 'Image 1', width: 280, height: 220 },
      { url: 'https://via.placeholder.com/300x200/2a9d8f/ffffff?text=Image+2', caption: 'Image 2', width: 280, height: 220 },
      { url: 'https://via.placeholder.com/300x200/e9c46a/333333?text=Image+3', caption: 'Image 3', width: 280, height: 220 },
    ] },
  };

  // ===== Init =====
  function init(onChange) {
    onChangeCallback = onChange;
    setupDropZone();
    setupElementPaletteDrag();
    setupElementPaletteClick();
    setupQuickToolbar();
    setupSlideActions();
    setupElementActions();

    // Start with one blank slide
    if (slideModels.length === 0) {
      addSlide();
    }
  }

  // ===== Slide CRUD =====
  function addSlide(afterIndex) {
    const slide = {
      id: ++slideIdCounter,
      directives: {},
      elements: [],
    };
    const idx = (afterIndex !== undefined) ? afterIndex + 1 : slideModels.length;
    slideModels.splice(idx, 0, slide);
    activeSlideIndex = idx;
    notifyChange();
    return slide;
  }

  function duplicateSlide(index) {
    if (index < 0 || index >= slideModels.length) return;
    const src = slideModels[index];
    const clone = {
      id: ++slideIdCounter,
      directives: { ...src.directives },
      elements: src.elements.map(el => ({ ...el, id: ++elementIdCounter })),
    };
    slideModels.splice(index + 1, 0, clone);
    activeSlideIndex = index + 1;
    notifyChange();
  }

  function deleteSlide(index) {
    if (slideModels.length <= 1) return; // keep at least one
    slideModels.splice(index, 1);
    if (activeSlideIndex >= slideModels.length) activeSlideIndex = slideModels.length - 1;
    selectedElementId = null;
    notifyChange();
  }

  function reorderSlides(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const [moved] = slideModels.splice(fromIdx, 1);
    slideModels.splice(toIdx, 0, moved);
    activeSlideIndex = toIdx;
    notifyChange();
  }

  function setActiveSlide(index) {
    if (index < 0 || index >= slideModels.length) return;
    activeSlideIndex = index;
    selectedElementId = null;
    notifyChange();
  }

  function getActiveSlide() {
    return slideModels[activeSlideIndex] || null;
  }

  // ===== Element CRUD =====
  function addElement(type, slideIdx, insertIdx) {
    const slide = slideModels[slideIdx !== undefined ? slideIdx : activeSlideIndex];
    if (!slide) return null;
    const defaults = ELEMENT_DEFAULTS[type];
    if (!defaults) return null;

    const el = { ...defaults, id: ++elementIdCounter };
    if (el.filters) el.filters = [...el.filters]; // clone array

    const idx = (insertIdx !== undefined) ? insertIdx : slide.elements.length;
    slide.elements.splice(idx, 0, el);
    selectedElementId = el.id;
    notifyChange();
    return el;
  }

  function deleteElement(elId) {
    const slide = getActiveSlide();
    if (!slide) return;
    const idx = slide.elements.findIndex(e => e.id === elId);
    if (idx >= 0) {
      slide.elements.splice(idx, 1);
      selectedElementId = null;
      notifyChange();
    }
  }

  function moveElement(elId, direction) {
    const slide = getActiveSlide();
    if (!slide) return;
    const idx = slide.elements.findIndex(e => e.id === elId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= slide.elements.length) return;
    const [el] = slide.elements.splice(idx, 1);
    slide.elements.splice(newIdx, 0, el);
    notifyChange();
  }

  function reorderElement(fromIdx, toIdx) {
    const slide = getActiveSlide();
    if (!slide) return;
    if (fromIdx === toIdx) return;
    const [el] = slide.elements.splice(fromIdx, 1);
    slide.elements.splice(toIdx, 0, el);
    notifyChange();
  }

  function updateElement(elId, props) {
    const slide = getActiveSlide();
    if (!slide) return;
    const el = slide.elements.find(e => e.id === elId);
    if (!el) return;
    Object.assign(el, props);
    notifyChange();
  }

  function getElement(elId) {
    const slide = getActiveSlide();
    if (!slide) return null;
    return slide.elements.find(e => e.id === elId) || null;
  }

  function selectElement(elId) {
    selectedElementId = elId;
    notifyChange();
  }

  // ===== Drop Zone =====
  function setupDropZone() {
    const zone = document.getElementById('drop-zone');

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      zone.classList.add('drag-hover');

      // Find insert position
      const target = findDropTarget(e, zone);
      clearDropIndicators(zone);
      if (target && target.el) {
        if (target.pos === 'above') target.el.classList.add('drag-over-above');
        else target.el.classList.add('drag-over-below');
      }
    });

    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-hover');
        clearDropIndicators(zone);
      }
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-hover');
      clearDropIndicators(zone);

      const elementType = e.dataTransfer.getData('element-type');
      const reorderFrom = e.dataTransfer.getData('reorder-from');
      const imageUrl = e.dataTransfer.getData('image-url');

      const target = findDropTarget(e, zone);
      const insertIdx = target ? target.index + (target.pos === 'below' ? 1 : 0) : undefined;

      if (elementType) {
        addElement(elementType, activeSlideIndex, insertIdx);
      } else if (imageUrl) {
        const el = addElement('image', activeSlideIndex, insertIdx);
        if (el) updateElement(el.id, { url: imageUrl });
      } else if (reorderFrom !== '') {
        const fromIdx = parseInt(reorderFrom);
        if (!isNaN(fromIdx) && insertIdx !== undefined) {
          reorderElement(fromIdx, insertIdx > fromIdx ? insertIdx - 1 : insertIdx);
        }
      }
    });

    // Click on zone background to deselect
    zone.addEventListener('click', (e) => {
      if (e.target === zone || e.target.classList.contains('drop-zone-empty')) {
        selectedElementId = null;
        notifyChange();
      }
    });
  }

  function findDropTarget(e, zone) {
    const elements = zone.querySelectorAll('.ve-element');
    if (elements.length === 0) return null;

    for (let i = 0; i < elements.length; i++) {
      const rect = elements[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        return { el: elements[i], index: i, pos: 'above' };
      }
    }
    return { el: elements[elements.length - 1], index: elements.length - 1, pos: 'below' };
  }

  function clearDropIndicators(zone) {
    zone.querySelectorAll('.drag-over-above,.drag-over-below').forEach(el => {
      el.classList.remove('drag-over-above', 'drag-over-below');
    });
  }

  // ===== Element Palette Drag =====
  function setupElementPaletteDrag() {
    document.querySelectorAll('.element-item[draggable]').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('element-type', item.dataset.element);
        e.dataTransfer.effectAllowed = 'copy';
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
      });
    });
  }

  // ===== Element Palette Click (quick-add) =====
  function setupElementPaletteClick() {
    // Delegated handler so dynamically rendered palette items keep working.
    const palette = document.querySelector('.element-palette') || document.body;
    palette.addEventListener('click', (e) => {
      const item = e.target.closest('.element-item[data-element]');
      if (!item) return;
      // Skip if the user actually started a drag (drag end fires click on some browsers).
      if (item.dataset.dragging === '1') { delete item.dataset.dragging; return; }
      const type = item.dataset.element;
      if (!type) return;
      if (!ELEMENT_DEFAULTS[type]) {
        console.warn('[VisualBuilder] Unknown element type from palette:', type);
        return;
      }
      addElement(type);
    });
  }

  // ===== Quick Toolbar =====
  function setupQuickToolbar() {
    const toolbar = document.getElementById('quick-toolbar');
    if (!toolbar) return;

    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-quick]');
      if (btn) {
        addElement(btn.dataset.quick);
      }
    });
  }

  // ===== Slide List Actions =====
  function setupSlideActions() {
    document.getElementById('btn-add-slide')?.addEventListener('click', () => addSlide(activeSlideIndex));
    document.getElementById('btn-duplicate-slide')?.addEventListener('click', () => duplicateSlide(activeSlideIndex));
    document.getElementById('btn-delete-slide')?.addEventListener('click', () => deleteSlide(activeSlideIndex));
  }

  // ===== Element Actions (delete, move) =====
  function setupElementActions() {
    document.getElementById('btn-delete-element')?.addEventListener('click', () => {
      if (selectedElementId) deleteElement(selectedElementId);
    });
    document.getElementById('btn-move-up')?.addEventListener('click', () => {
      if (selectedElementId) moveElement(selectedElementId, -1);
    });
    document.getElementById('btn-move-down')?.addEventListener('click', () => {
      if (selectedElementId) moveElement(selectedElementId, 1);
    });
  }

  // ===== Render Visual Canvas =====
  function renderCanvas() {
    const zone = document.getElementById('drop-zone');
    const slide = getActiveSlide();
    if (!zone || !slide) return;

    zone.innerHTML = '';

    // Apply slide theme styling to the canvas (always, even for empty slides)
    const canvas = document.getElementById('visual-canvas');
    const theme = slide.directives?.theme || 'default';
    const classTokens = String(slide.directives?.class || '').split(/\s+/).filter(Boolean).join(' ');
    canvas.className = 'slide-canvas-visual slide-theme-' + theme + (classTokens ? ' ' + classTokens : '');

    // Apply per-slide directives as inline styles
    const dirs = slide.directives || {};
    let bgStyle = '';
    if (dirs.backgroundColor) bgStyle += 'background:' + dirs.backgroundColor + ';';
    if (dirs.color) bgStyle += 'color:' + dirs.color + ';';
    if (dirs.backgroundImage) {
      const imgUrl = dirs.backgroundImage.replace(/^url\(["']?|["']?\)$/g, '');
      bgStyle += 'background-image:url(' + imgUrl + ');background-size:' + (dirs.backgroundSize || 'cover') + ';background-position:center;';
    }
    canvas.style.cssText = bgStyle;

    if (slide.elements.length === 0) {
      zone.innerHTML = '<div class="drop-zone-empty"><span class="dz-icon">➕</span><p>Drag elements here or use toolbar to add</p></div>';
      renderLogoOverlay(canvas);
      return;
    }

    // Render each element
    slide.elements.forEach((el, idx) => {
      const div = document.createElement('div');
      div.className = 've-element' + (el.id === selectedElementId ? ' selected' : '');
      div.dataset.id = el.id;
      div.dataset.type = el.type;
      div.dataset.index = idx;
      div.draggable = true;

      // Apply free-transform styles (resize/rotate). When set, the wrapper
      // is sized explicitly and the inner content stretches to fill.
      const transform = buildElementTransformStyle(el);
      if (transform) div.style.cssText = transform;

      // Drag handle
      const handle = document.createElement('span');
      handle.className = 've-drag-handle';
      handle.textContent = '⋮⋮';
      div.appendChild(handle);

      // Rendered content
      const content = document.createElement('div');
      content.className = 've-content';
      content.innerHTML = renderElementHTML(el);
      div.appendChild(content);

      if (el.type === 'image' && !el.bgMode) {
        attachImageResizeHandle(div, el);
      }

      // Universal resize + rotate handles (shown only on selected element).
      if (el.id === selectedElementId) {
        attachTransformHandles(div, el);
      }

      // Click to select
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedElementId = el.id;
        notifyChange();
      });

      // Double-click to quick-edit
      div.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        // Focus the properties content textarea
        const ta = document.getElementById('prop-content');
        if (ta) { ta.focus(); ta.select(); }
      });

      // Drag for reorder
      div.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.setData('reorder-from', String(idx));
        e.dataTransfer.effectAllowed = 'move';
        div.classList.add('dragging');
      });
      div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
      });

      zone.appendChild(div);
    });

    // Highlight code blocks
    if (typeof hljs !== 'undefined') {
      zone.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }

    // Activate inline <script> tags inside .el-html (HyperFrames already
    // execute via iframe srcdoc so they don't need this).
    if (window.SlideRenderer && window.SlideRenderer.activateScripts) {
      window.SlideRenderer.activateScripts(zone);
    }

    // Render logo overlay
    renderLogoOverlay(canvas);
    // Render header/footer overlays
    renderHeaderFooterOverlays(canvas);
  }

  function renderLogoOverlay(canvas) {
    // Remove existing logo overlay
    const existing = canvas.querySelector('.slide-logo-overlay');
    if (existing) existing.remove();

    const logo = window.DirectivesPanel?.getGlobalDirectives()?.logo;
    if (!logo) return;

    const overlay = document.createElement('div');
    overlay.className = 'slide-logo-overlay';
    const img = document.createElement('img');
    img.src = encodeURI(logo);
    img.alt = 'Logo';
    img.onerror = function () { this.style.display = 'none'; };
    overlay.appendChild(img);
    canvas.appendChild(overlay);
  }

  function attachImageResizeHandle(container, el) {
    const img = container.querySelector('.ve-content img');
    if (!img) return;

    const handle = document.createElement('span');
    handle.className = 've-image-resize-handle';
    handle.title = 'Drag to resize image';
    handle.draggable = false;
    container.appendChild(handle);

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = img.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = Math.max(80, rect.width);
      const startH = Math.max(60, rect.height);
      let nextW = startW;
      let nextH = startH;

      const onMove = (ev) => {
        ev.preventDefault();
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        nextW = Math.max(80, Math.round(startW + dx));
        nextH = Math.max(60, Math.round(startH + dy));
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        img.style.width = nextW + 'px';
        img.style.height = nextH + 'px';
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        updateElement(el.id, { width: nextW, height: nextH });
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ===== Universal resize + rotate handles =====
  // Inspired by Ralphin9/GraphicVideoImageGif's ThumbnailStudio: 8 resize
  // handles around the element bounding box plus one rotation handle above
  // top-center. Updates `el.styleW` (px), `el.styleH` (px), `el.rotate` (deg)
  // on the model — these flow back through render and persist with the project.

  /** Build inline style string from el.styleW/styleH/rotate. Returns '' if none set. */
  function buildElementTransformStyle(el) {
    const parts = [];
    if (el.styleW) parts.push('width:' + parseInt(el.styleW, 10) + 'px');
    if (el.styleH) parts.push('height:' + parseInt(el.styleH, 10) + 'px');
    if (el.rotate) parts.push('transform:rotate(' + parseFloat(el.rotate) + 'deg)');
    if (el.styleW || el.styleH) parts.push('flex:0 0 auto');
    return parts.join(';');
  }

  function attachTransformHandles(container, el) {
    container.classList.add('ve-transformable');

    const HANDLES = [
      { pos: 'tl', cursor: 'nw-resize', dx: -1, dy: -1 },
      { pos: 't',  cursor: 'n-resize',  dx:  0, dy: -1 },
      { pos: 'tr', cursor: 'ne-resize', dx:  1, dy: -1 },
      { pos: 'r',  cursor: 'e-resize',  dx:  1, dy:  0 },
      { pos: 'br', cursor: 'se-resize', dx:  1, dy:  1 },
      { pos: 'b',  cursor: 's-resize',  dx:  0, dy:  1 },
      { pos: 'bl', cursor: 'sw-resize', dx: -1, dy:  1 },
      { pos: 'l',  cursor: 'w-resize',  dx: -1, dy:  0 },
    ];

    HANDLES.forEach(h => {
      const node = document.createElement('span');
      node.className = 've-tx-handle ve-tx-' + h.pos;
      node.style.cursor = h.cursor;
      node.dataset.pos = h.pos;
      node.addEventListener('mousedown', (e) => startResize(e, container, el, h));
      container.appendChild(node);
    });

    // Rotation handle (top-center, offset above)
    const rot = document.createElement('span');
    rot.className = 've-tx-handle ve-tx-rot';
    rot.title = 'Drag to rotate';
    rot.addEventListener('mousedown', (e) => startRotate(e, container, el));
    container.appendChild(rot);
  }

  function startResize(e, container, el, handle) {
    e.preventDefault();
    e.stopPropagation();
    container.draggable = false;

    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = Math.max(40, rect.width);
    const startH = Math.max(20, rect.height);
    let nextW = startW;
    let nextH = startH;

    const onMove = (ev) => {
      ev.preventDefault();
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (handle.dx > 0) nextW = Math.max(40, Math.round(startW + dx));
      else if (handle.dx < 0) nextW = Math.max(40, Math.round(startW - dx));
      if (handle.dy > 0) nextH = Math.max(20, Math.round(startH + dy));
      else if (handle.dy < 0) nextH = Math.max(20, Math.round(startH - dy));

      container.style.width  = nextW + 'px';
      container.style.height = nextH + 'px';
      container.style.flex   = '0 0 auto';
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      container.draggable = true;
      updateElement(el.id, { styleW: nextW, styleH: nextH });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startRotate(e, container, el) {
    e.preventDefault();
    e.stopPropagation();
    container.draggable = false;

    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const startRot = parseFloat(el.rotate || 0);
    let nextRot = startRot;

    const onMove = (ev) => {
      ev.preventDefault();
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      const deltaDeg = (a - startAngle) * 180 / Math.PI;
      nextRot = Math.round(startRot + deltaDeg);
      // Snap to 15° while holding Shift
      if (ev.shiftKey) nextRot = Math.round(nextRot / 15) * 15;
      container.style.transform = 'rotate(' + nextRot + 'deg)';
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      container.draggable = true;
      updateElement(el.id, { rotate: nextRot });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function renderHeaderFooterOverlays(canvas) {
    // Remove existing header/footer overlays
    canvas.querySelectorAll('.canvas-header-overlay, .canvas-footer-overlay').forEach(el => el.remove());

    const globals = window.DirectivesPanel?.getGlobalDirectives();
    if (!globals) return;
    const slide = getActiveSlide();
    const headerText = slide?.directives?.header || globals.header;
    const footerText = slide?.directives?.footer || globals.footer;

    const renderOverlayMarkdown = (text) => {
      const src = String(text || '').trim();
      if (!src) return '';
      if (typeof marked !== 'undefined' && typeof marked.parseInline === 'function') {
        return marked.parseInline(src);
      }
      return escapeHtml(src);
    };

    if (headerText) {
      const h = document.createElement('div');
      h.className = 'canvas-header-overlay';
      h.innerHTML = renderOverlayMarkdown(headerText);
      canvas.appendChild(h);
    }
    if (footerText) {
      const f = document.createElement('div');
      f.className = 'canvas-footer-overlay';
      f.innerHTML = renderOverlayMarkdown(footerText);
      canvas.appendChild(f);
    }
  }

  // ===== Render element to HTML preview =====
  function renderElementHTML(el) {
    switch (el.type) {
        case 'tutorial': {
          // Render code block and callouts as overlays
          if (!el.tutorialData) return '<div class="tutorial-placeholder">[Tutorial]</div>';
          const td = el.tutorialData;
          // Syntax highlight code
          let codeHtml = '';
          if (typeof hljs !== 'undefined') {
            try {
              codeHtml = hljs.highlight(td.code, { language: td.lang || 'javascript' }).value;
            } catch {
              codeHtml = escapeHtml(td.code);
            }
          } else {
            codeHtml = escapeHtml(td.code);
          }
          // Wrap lines for annotation targeting
          const lines = codeHtml.split('\n');
          const codeLinesHtml = lines.map((line, i) => `<span class="tut-line" data-line="${i}">${line || '\u200b'}</span>`).join('\n');
          // Render callouts
          const calloutsHtml = (td.annotations || []).map(a =>
            `<div class="tut-callout color-${a.color}"
                  style="left:${a.x}px;top:${a.y}px;min-width:${a.minWidth}px;opacity:${a.opacity};font-size:${a.fontSize}px;font-family:${a.fontFamily};">
                <div class="tut-callout-bubble">
                  <div class="tut-callout-text">${a.text}</div>
                </div>
            </div>`
          ).join('');
          return `
            <div class="tutorial-group">
              <div class="tutorial-title">${escapeHtml(td.title || 'Code Tutorial')}</div>
              <div class="tutorial-code-wrap">
                <pre class="tutorial-code-block"><code class="language-${td.lang || 'javascript'}">${codeLinesHtml}</code></pre>
              </div>
              <div class="tutorial-callouts-layer">${calloutsHtml}</div>
            </div>
          `;
        }
      case 'heading': {
        const tag = 'h' + (el.level || 2);
        const fit = el.fit ? ' class="fit-heading"' : '';
        return `<${tag}${fit}>${escapeHtml(el.content || 'Heading')}</${tag}>`;
      }
      case 'fittext':
        return `<h1 class="fit-heading" style="font-size:2.5em;font-weight:900;text-align:center;">${escapeHtml(el.content || 'BIG TEXT')}</h1>`;
      case 'html': {
        // Raw HTML element — emitted verbatim, never wrapped by `marked`.
        // We wrap in `.el-html` so the slide-frame's flex layout treats the
        // whole snippet as ONE child (otherwise direct <button>/<div>
        // children get stretched to full width by `align-items: stretch`).
        return '<div class="el-html">' + String(el.content || '') + '</div>';
      }
      case 'hyperframe': {
        // HyperFrame element — composition rendered inside an isolated iframe.
        // Inline <script>/CSS run inside the iframe sandbox, so global state
        // and styles never leak into the deck. Inspired by HeyGen HyperFrames
        // and Remotion: HTML/CSS/JS as a video/animation primitive.
        const w = parseInt(el.width, 10) || 1280;
        const h = parseInt(el.height, 10) || 360;
        const safeSrc = buildIframeSrcdoc(el.content);
        return '<div class="el-hyperframe" style="width:' + w + 'px;max-width:100%;">'
          + '<iframe sandbox="allow-scripts allow-same-origin allow-popups allow-forms" '
          + 'loading="lazy" referrerpolicy="no-referrer" '
          + 'style="width:100%;height:' + h + 'px;border:0;border-radius:8px;background:#0d1117;" '
          + 'srcdoc="' + safeSrc + '"></iframe>'
          + '</div>';
      }
      case 'text': {
        // Support basic markdown in text
        if (typeof marked !== 'undefined') {
          return marked.parse(el.content || 'Text content');
        }
        return `<p>${escapeHtml(el.content || 'Text content')}</p>`;
      }
      case 'bullets': {
        const items = (el.content || 'Item').split('\n').filter(Boolean);
        return '<ul>' + items.map(i => '<li>' + escapeHtml(i.replace(/^[-*]\s*/, '')) + '</li>').join('') + '</ul>';
      }
      case 'numbered': {
        const items = (el.content || 'Item').split('\n').filter(Boolean);
        return '<ol>' + items.map(i => '<li>' + escapeHtml(i.replace(/^\d+\.\s*/, '')) + '</li>').join('') + '</ol>';
      }
      case 'fragments': {
        const items = (el.content || 'Item').split('\n').filter(Boolean);
        return '<ul data-marpit-fragments="' + items.length + '">' + items.map((i, idx) => '<li class="fragment" data-marpit-fragment="' + (idx + 1) + '">' + escapeHtml(i.replace(/^[*-]\s*/, '')) + '</li>').join('') + '</ul>';
      }
      case 'code': {
        const lang = el.language ? ' class="language-' + el.language + '"' : '';
        const langBadge = el.language ? ` data-lang="${el.language}"` : '';
        return `<pre${langBadge}><code${lang}>${escapeHtml(el.content || '// code')}</code></pre>`;
      }
      case 'table': {
        const md = el.content || '| A | B |\n|---|---|\n| 1 | 2 |';
        if (typeof marked !== 'undefined') return marked.parse(md);
        return '<p>' + escapeHtml(md) + '</p>';
      }
      case 'image': {
        let style = '';
        const sizing = String(el.sizing || '').trim().toLowerCase();
        const hasExplicitSize = sizing.includes('%') || sizing.includes('px');
        const hasManualDimensions = el.width !== undefined && el.width !== null && el.width !== '';

        // Map Marpit-style sizing controls into concrete CSS behavior in the visual canvas.
        if (hasExplicitSize) {
          style += 'max-width:' + sizing + ';';
        } else if (sizing === 'cover' || sizing === 'contain' || sizing === 'fit' || sizing === 'auto') {
          const fitMap = {
            cover: 'cover',
            contain: 'contain',
            fit: 'fill',
            auto: 'scale-down',
          };
          style += 'width:100%;';
          style += 'height:' + (sizing === 'cover' ? '320px' : '260px') + ';';
          style += 'object-fit:' + fitMap[sizing] + ';';
          style += 'object-position:center;';
          style += 'display:block;';
        }

        if (hasManualDimensions) {
          style += 'max-width:none;';
          style += 'max-height:none;';
          style += 'display:block;';
        }

        if (el.width !== undefined && el.width !== null && el.width !== '') {
          const widthVal = String(el.width).trim();
          style += 'width:' + widthVal + (/^\d+(\.\d+)?$/.test(widthVal) ? 'px' : '') + ';';
        }
        if (el.height !== undefined && el.height !== null && el.height !== '') {
          const heightVal = String(el.height).trim();
          style += 'height:' + heightVal + (/^\d+(\.\d+)?$/.test(heightVal) ? 'px' : '') + ';';
        }
        let filterStyle = '';
        if (el.filters && el.filters.length) {
          filterStyle = 'filter:' + el.filters.map(f => {
            if (f === 'blur') return 'blur(4px)';
            if (f === 'brightness') return 'brightness(1.5)';
            if (f === 'grayscale') return 'grayscale(1)';
            if (f === 'invert') return 'invert(1)';
            if (f === 'opacity') return 'opacity(0.5)';
            if (f === 'sepia') return 'sepia(1)';
            if (f === 'drop-shadow') return 'drop-shadow(4px 4px 8px rgba(0,0,0,0.5))';
            return '';
          }).join(' ') + ';';
        }
        const allStyle = style + filterStyle;
        return `<img src="${encodeURI(el.url || '')}" alt="${escapeHtml(el.alt || '')}" style="${allStyle}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22120%22><rect fill=%22%23ddd%22 width=%22200%22 height=%22120%22/><text x=%2250%%22 y=%2250%%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2214%22>Image</text></svg>'">`;
      }
      case 'quote': {
        const lines = (el.content || 'Quote').split('\n');
        return '<blockquote>' + lines.map(l => '<p>' + escapeHtml(l) + '</p>').join('') + '</blockquote>';
      }
      case 'math': {
        const expr = el.content || 'E = mc^2';
        if (typeof katex !== 'undefined') {
          try { return '<div class="katex-display">' + katex.renderToString(expr, { displayMode: true, throwOnError: false }) + '</div>'; }
          catch { return '<p>$$' + escapeHtml(expr) + '$$</p>'; }
        }
        return '<p>$$' + escapeHtml(expr) + '$$</p>';
      }
      case 'columns': {
        const leftHtml = typeof marked !== 'undefined' ? marked.parse(el.leftContent || '') : escapeHtml(el.leftContent || '');
        const rightHtml = typeof marked !== 'undefined' ? marked.parse(el.rightContent || '') : escapeHtml(el.rightContent || '');
        return '<div class="columns"><div class="col">' + leftHtml + '</div><div class="col">' + rightHtml + '</div></div>';
      }
      case 'hr':
        return '<hr>';
      case 'imageCompare': {
        const leftUrl = encodeURI(el.leftImage || '');
        const rightUrl = encodeURI(el.rightImage || '');
        const leftLabel = escapeHtml(el.leftLabel || 'Before');
        const rightLabel = escapeHtml(el.rightLabel || 'After');
        return `<div class="image-compare-container">
          <div class="ic-side"><img src="${leftUrl}" alt="${leftLabel}"><span class="ic-label">${leftLabel}</span></div>
          <div class="ic-arrow"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg></div>
          <div class="ic-side"><img src="${rightUrl}" alt="${rightLabel}"><span class="ic-label">${rightLabel}</span></div>
        </div>`;
      }
      case 'imageCombine': {
        const srcs = el.sourceImages || [];
        const srcCards = srcs.map((s, idx) => {
          const scale = 1 - idx * 0.12;
          return `<div class="cmb-source" style="z-index:${srcs.length - idx};transform:scale(${scale.toFixed(2)}) translateY(${idx * 8}px)"><img src="${encodeURI(s.url || '')}" alt="${escapeHtml(s.label || '')}"><span class="cmb-label">${escapeHtml(s.label || '')}</span></div>`;
        }).join('');
        const resUrl = encodeURI(el.resultImage || '');
        const resLabel = escapeHtml(el.resultLabel || 'Result');
        return `<div class="image-combine-container">
          <div class="cmb-sources">${srcCards}</div>
          <div class="cmb-arrow"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg></div>
          <div class="cmb-result"><img src="${resUrl}" alt="${resLabel}"><span class="cmb-label">${resLabel}</span></div>
        </div>`;
      }
      case 'imageGrid': {
        const imgs = el.images || [];
        const gridItems = imgs.map(img => {
          const w = img.width ? `width:${img.width}px;` : '';
          const h = img.height ? `height:${img.height}px;` : '';
          const imgStyle = (w || h) ? ` style="${w}${h}object-fit:cover"` : '';
          return `<div class="ig-item"><img src="${encodeURI(img.url || '')}" alt="${escapeHtml(img.caption || '')}"${imgStyle}><span class="ig-caption">${escapeHtml(img.caption || '')}</span></div>`;
        }).join('');
        return `<div class="image-grid-container">${gridItems}</div>`;
      }
      default:
        return '<p>' + escapeHtml(el.content || '') + '</p>';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== Render Slide Thumbnails =====
  function renderSlideThumbnails() {
    const list = document.getElementById('slide-list');
    if (!list) return;
    list.innerHTML = '';

    slideModels.forEach((slide, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'slide-thumb' + (i === activeSlideIndex ? ' active' : '');
      thumb.dataset.index = i;
      thumb.draggable = true;

      // Mini rendered content
      const inner = document.createElement('div');
      inner.className = 'slide-thumb-inner';
      // Render a mini version of the slide
      const miniSlide = document.createElement('div');
      miniSlide.className = 'slide-frame slide-theme-' + (slide.directives?.theme || 'default') + ' bg-solid';
      miniSlide.style.cssText = 'width:960px;height:540px;padding:48px 56px;font-family:system-ui,sans-serif;';
      if (slide.directives?.backgroundColor) miniSlide.style.background = slide.directives.backgroundColor;
      if (slide.directives?.color) miniSlide.style.color = slide.directives.color;

      // Render simplified content
      let contentHtml = '';
      slide.elements.forEach(el => {
        contentHtml += renderElementHTML(el);
      });
      if (!contentHtml) contentHtml = '<p style="color:#ccc;text-align:center;margin-top:200px;">Empty slide</p>';
      miniSlide.innerHTML = contentHtml;
      inner.appendChild(miniSlide);
      thumb.appendChild(inner);

      // Number badge
      const num = document.createElement('span');
      num.className = 'slide-thumb-num';
      num.textContent = i + 1;
      thumb.appendChild(num);

      // Click to navigate
      thumb.addEventListener('click', () => setActiveSlide(i));

      // Drag for reorder
      thumb.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('slide-reorder', String(i));
        e.dataTransfer.effectAllowed = 'move';
        thumb.classList.add('dragging');
      });
      thumb.addEventListener('dragend', () => thumb.classList.remove('dragging'));
      thumb.addEventListener('dragover', (e) => {
        e.preventDefault();
        thumb.classList.add('drag-over');
      });
      thumb.addEventListener('dragleave', () => thumb.classList.remove('drag-over'));
      thumb.addEventListener('drop', (e) => {
        e.preventDefault();
        thumb.classList.remove('drag-over');
        const fromIdx = parseInt(e.dataTransfer.getData('slide-reorder'));
        if (!isNaN(fromIdx) && fromIdx !== i) {
          reorderSlides(fromIdx, i);
        }
      });

      list.appendChild(thumb);
    });
  }

  // ===== Build from markdown (parse markdown into slide models) =====
  function loadFromMarkdown(markdown) {
    if (!markdown || !markdown.trim()) {
      slideModels = [{ id: ++slideIdCounter, directives: {}, elements: [] }];
      activeSlideIndex = 0;
      selectedElementId = null;
      notifyChange();
      return;
    }

    const { directives, bodyStart } = window.SlideParser.parseFrontMatter(markdown);
    const body = markdown.slice(bodyStart).trim();
    const rawSlides = body.split(/^---$/m).filter(s => s.trim());

    slideModels = rawSlides.map(raw => {
      const spotDirs = {};
      const commentRe = /<!--\s*([\s\S]*?)\s*-->/g;
      let cm;
      while ((cm = commentRe.exec(raw)) !== null) {
        cm[1].split('\n').forEach(line => {
          const kv = line.match(/^\s*([\w-]+)\s*:\s*(.+)\s*$/);
          if (kv) spotDirs[kv[1].trim()] = kv[2].trim();
        });
      }

      // Remove directive comments to parse content only.
      // Preserve `<!-- el:* -->` markers — those are element-type sentinels
      // (e.g. el:hyperframe, el:html) that the element parser depends on.
      let clean = raw.replace(/<!--([\s\S]*?)-->/g, (full, body) => {
        return /^\s*el:/i.test(body) ? full : '';
      }).replace(/^_\w[\w-]*\s*:.+$/gm, '').trim();

      // Parse clean markdown into elements
      const elements = parseMarkdownToElements(clean);

      return {
        id: ++slideIdCounter,
        directives: { ...spotDirs, theme: spotDirs.theme || directives.theme || 'default' },
        elements,
      };
    });

    if (slideModels.length === 0) {
      slideModels = [{ id: ++slideIdCounter, directives: { theme: directives.theme || 'default' }, elements: [] }];
    }
    activeSlideIndex = 0;
    selectedElementId = null;
    notifyChange();
  }

  // ===== Parse markdown text into element objects =====
  function parseMarkdownToElements(md) {
    const elements = [];
    const lines = md.split('\n');
    let i = 0;

    // Pending size/rotation sentinel applied to the next element pushed.
    let pendingStyle = null;
    // Wrap push so any of the many existing `elements.push(...)` call sites
    // automatically receive the pending sentinel without invasive edits.
    const origPush = elements.push.bind(elements);
    elements.push = function (...items) {
      const r = origPush(...items);
      if (pendingStyle && items.length) {
        Object.assign(items[items.length - 1], pendingStyle);
        pendingStyle = null;
      }
      return r;
    };

    while (i < lines.length) {
      const line = lines[i];

      // Skip empty lines
      if (!line.trim()) { i++; continue; }

      // <!-- el-style w=400 h=200 r=15 --> sentinel
      const styleMatch = line.match(/^<!--\s*el-style\s+([^>]+?)\s*-->\s*$/i);
      if (styleMatch) {
        const patch = {};
        styleMatch[1].split(/\s+/).forEach(kv => {
          const m = kv.match(/^(w|h|r)=(-?[\d.]+)$/i);
          if (!m) return;
          if (m[1].toLowerCase() === 'w') patch.styleW = parseInt(m[2], 10);
          else if (m[1].toLowerCase() === 'h') patch.styleH = parseInt(m[2], 10);
          else if (m[1].toLowerCase() === 'r') patch.rotate = parseFloat(m[2]);
        });
        pendingStyle = patch;
        i++;
        continue;
      }

      // Heading with fit
      const fitMatch = line.match(/^(#{1,6})\s*<!--\s*fit\s*-->\s*(.+)$/);
      if (fitMatch) {
        elements.push({ id: ++elementIdCounter, type: 'fittext', content: fitMatch[2].trim() });
        i++;
        continue;
      }

      // Heading
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        elements.push({ id: ++elementIdCounter, type: 'heading', level: headingMatch[1].length, content: headingMatch[2].trim() });
        i++;
        continue;
      }

      // Code block
      if (line.match(/^```/)) {
        const lang = line.replace(/^```/, '').trim();
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].match(/^```$/)) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push({ id: ++elementIdCounter, type: 'code', content: codeLines.join('\n'), language: lang || '' });
        i++; // skip closing ```
        continue;
      }

      // Math block
      if (line.match(/^\$\$/)) {
        const mathLines = [];
        i++;
        while (i < lines.length && !lines[i].match(/^\$\$/)) {
          mathLines.push(lines[i]);
          i++;
        }
        elements.push({ id: ++elementIdCounter, type: 'math', content: mathLines.join('\n') });
        i++; // skip closing $$
        continue;
      }

      // Blockquote
      if (line.match(/^>\s/)) {
        const quoteLines = [];
        while (i < lines.length && lines[i].match(/^>/)) {
          quoteLines.push(lines[i].replace(/^>\s*/, ''));
          i++;
        }
        elements.push({ id: ++elementIdCounter, type: 'quote', content: quoteLines.join('\n') });
        continue;
      }

      // Table (starts with |)
      if (line.match(/^\|/)) {
        const tableLines = [];
        while (i < lines.length && lines[i].match(/^\|/)) {
          tableLines.push(lines[i]);
          i++;
        }
        elements.push({ id: ++elementIdCounter, type: 'table', content: tableLines.join('\n') });
        continue;
      }

      // Horizontal rule
      if (line.match(/^[-*_]{3,}$/)) {
        elements.push({ id: ++elementIdCounter, type: 'hr', content: '' });
        i++;
        continue;
      }

      // Image (Marpit syntax)
      const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        const parsed = window.SlideParser.parseImageSyntax(line);
        if (parsed.length > 0) {
          const pi = parsed[0];
          elements.push({
            id: ++elementIdCounter, type: 'image',
            url: pi.url, alt: pi.alt, bgMode: pi.bg ? ('bg' + (pi.position ? ' ' + pi.position : '')) : '',
            sizing: pi.sizing, filters: pi.filters, width: pi.width, height: pi.height,
          });
        }
        i++;
        continue;
      }

      // Fragment list (* items)
      if (line.match(/^\*\s+[^*]/)) {
        const items = [];
        while (i < lines.length && lines[i].match(/^\*\s/)) {
          items.push(lines[i].replace(/^\*\s*/, ''));
          i++;
        }
        elements.push({ id: ++elementIdCounter, type: 'fragments', content: items.join('\n') });
        continue;
      }

      // Unordered list
      if (line.match(/^[-+]\s/)) {
        const items = [];
        while (i < lines.length && lines[i].match(/^[-+]\s/)) {
          items.push(lines[i].replace(/^[-+]\s*/, ''));
          i++;
        }
        elements.push({ id: ++elementIdCounter, type: 'bullets', content: items.join('\n') });
        continue;
      }

      // Ordered list
      if (line.match(/^\d+\.\s/)) {
        const items = [];
        while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
          items.push(lines[i].replace(/^\d+\.\s*/, ''));
          i++;
        }
        elements.push({ id: ++elementIdCounter, type: 'numbered', content: items.join('\n') });
        continue;
      }

      // HyperFrame element marker (round-trip from `hyperframe` type).
      // Format:  <!-- el:hyperframe w=1280 h=360 -->
      //         <div class="el-hyperframe-src" style="display:none">
      //         ...composition HTML/CSS/JS...
      //         </div>
      const hfMatch = line.match(/^<!--\s*el:hyperframe(?:\s+w=(\d+))?(?:\s+h=(\d+))?\s*-->/i);
      if (hfMatch) {
        const w = parseInt(hfMatch[1], 10) || 1280;
        const h = parseInt(hfMatch[2], 10) || 360;
        i++; // skip marker
        // Skip optional opening wrapper
        if (i < lines.length && lines[i].match(/^<div class="el-hyperframe-src"/i)) i++;
        const hfLines = [];
        let depth = 1;
        while (i < lines.length && depth > 0) {
          const cur = lines[i];
          const opens = (cur.match(/<div\b/gi) || []).length;
          const closes = (cur.match(/<\/div>/gi) || []).length;
          if (depth - closes <= 0) {
            // Last closing </div> ends the wrapper — don't include it.
            const trimmed = cur.replace(/<\/div>\s*$/, '');
            if (trimmed.trim()) hfLines.push(trimmed);
            i++;
            depth = 0;
            break;
          }
          hfLines.push(cur);
          depth += opens - closes;
          i++;
        }
        elements.push({
          id: ++elementIdCounter, type: 'hyperframe',
          width: w, height: h,
          content: hfLines.join('\n').trim(),
        });
        continue;
      }

      // HTML element marker (round-trip from `html` type)
      if (line.match(/^<div class="el-html">/i)) {
        const htmlLines = [];
        let depth = 0;
        // Consume the wrapper, tracking nested <div> depth so inner markup
        // with its own <div>s doesn't terminate us early.
        while (i < lines.length) {
          const cur = lines[i];
          const opens = (cur.match(/<div\b/gi) || []).length;
          const closes = (cur.match(/<\/div>/gi) || []).length;
          depth += opens - closes;
          htmlLines.push(cur);
          i++;
          if (depth <= 0) break;
        }
        // Strip outer <div class="el-html"> ... </div>
        const full = htmlLines.join('\n').trim();
        const inner = full
          .replace(/^<div class="el-html">\s*/i, '')
          .replace(/\s*<\/div>\s*$/i, '')
          .trim();
        elements.push({ id: ++elementIdCounter, type: 'html', content: inner });
        continue;
      }

      // Legacy HTML element marker (older exports)
      if (line.match(/^<!--\s*el:html\s*-->/i)) {
        i++; // skip marker
        const htmlLines = [];
        // Consume until blank line or another known block starter / EOF
        while (i < lines.length && lines[i].trim() && !lines[i].match(/^<!--\s*el:html\s*-->/i)) {
          if (lines[i].match(/^(#{1,6})\s|^```|^\$\$|^>\s|^---$|^\d+\.\s|^[-*+]\s/)) break;
          htmlLines.push(lines[i]);
          i++;
        }
        elements.push({ id: ++elementIdCounter, type: 'html', content: htmlLines.join('\n').trim() });
        continue;
      }

      // HTML div (columns)
      if (line.match(/^<div class="columns">/i)) {
        const htmlLines = [];
        let depth = 0;
        while (i < lines.length) {
          htmlLines.push(lines[i]);
          if (lines[i].match(/<div/i)) depth++;
          if (lines[i].match(/<\/div>/i)) depth--;
          i++;
          if (depth <= 0) break;
        }
        // Try to extract left/right content
        const full = htmlLines.join('\n');
        const colMatch = full.match(/<div class="col">\s*([\s\S]*?)\s*<\/div>\s*<div class="col">\s*([\s\S]*?)\s*<\/div>/i);
        if (colMatch) {
          elements.push({ id: ++elementIdCounter, type: 'columns', leftContent: colMatch[1].trim(), rightContent: colMatch[2].trim() });
        } else {
          elements.push({ id: ++elementIdCounter, type: 'text', content: full });
        }
        continue;
      }

      // Image Compare HTML
      if (line.match(/^<div class="image-compare-container">/i)) {
        const htmlLines = [];
        let depth = 0;
        while (i < lines.length) {
          htmlLines.push(lines[i]);
          if (lines[i].match(/<div/i)) depth++;
          if (lines[i].match(/<\/div>/i)) depth--;
          i++;
          if (depth <= 0) break;
        }
        const full = htmlLines.join('\n');
        const srcRe = /<img\s+src="([^"]*)"\s+alt="([^"]*)"/gi;
        const matches = [...full.matchAll(srcRe)];
        elements.push({
          id: ++elementIdCounter, type: 'imageCompare',
          leftImage: matches[0]?.[1] || '', rightImage: matches[1]?.[1] || '',
          leftLabel: matches[0]?.[2] || 'Before', rightLabel: matches[1]?.[2] || 'After',
        });
        continue;
      }

      // Image Combine HTML
      if (line.match(/^<div class="image-combine-container">/i)) {
        const htmlLines = [];
        let depth = 0;
        while (i < lines.length) {
          htmlLines.push(lines[i]);
          if (lines[i].match(/<div/i)) depth++;
          if (lines[i].match(/<\/div>/i)) depth--;
          i++;
          if (depth <= 0) break;
        }
        const full = htmlLines.join('\n');
        const srcRe = /<div class="cmb-source"><img\s+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>.*?<\/div>/gi;
        const sourceImages = [];
        let sm;
        while ((sm = srcRe.exec(full)) !== null) {
          sourceImages.push({ url: sm[1], label: sm[2] || '' });
        }
        const resMatch = full.match(/<div class="cmb-result"><img\s+src="([^"]*)"[^>]*alt="([^"]*)"/);
        elements.push({
          id: ++elementIdCounter, type: 'imageCombine',
          sourceImages,
          resultImage: resMatch?.[1] || '',
          resultLabel: resMatch?.[2] || 'Result',
        });
        continue;
      }

      // Image Grid HTML
      if (line.match(/^<div class="image-grid-container">/i)) {
        const htmlLines = [];
        let depth = 0;
        while (i < lines.length) {
          htmlLines.push(lines[i]);
          if (lines[i].match(/<div/i)) depth++;
          if (lines[i].match(/<\/div>/i)) depth--;
          i++;
          if (depth <= 0) break;
        }
        const full = htmlLines.join('\n');
        const itemRe = /<div class="ig-item"><img\s+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>.*?<\/div>/gi;
        const images = [];
        let m;
        while ((m = itemRe.exec(full)) !== null) {
          const tag = m[0];
          const wm = tag.match(/width:\s*(\d+)px/);
          const hm = tag.match(/height:\s*(\d+)px/);
          images.push({ url: m[1], caption: m[2] || '', width: wm ? parseInt(wm[1]) : 280, height: hm ? parseInt(hm[1]) : 220 });
        }
        elements.push({ id: ++elementIdCounter, type: 'imageGrid', images });
        continue;
      }

      // Default: text paragraph
      const textLines = [];
      while (i < lines.length && lines[i].trim() && !lines[i].match(/^[#>`|!$*\-+\d][\s.#]|^```|^\$\$|^<div|^[-*_]{3,}$/)) {
        textLines.push(lines[i]);
        i++;
      }
      if (textLines.length > 0) {
        elements.push({ id: ++elementIdCounter, type: 'text', content: textLines.join('\n') });
      } else {
        i++; // avoid infinite loops
      }
    }

    return elements;
  }

  function buildIframeSrcdoc(content) {
    const trimmed = String(content || '').trim();
    const srcdoc = /^\s*(?:<!doctype\s+html\b|<html\b)/i.test(trimmed)
      ? trimmed
      : '<!doctype html><html><head><meta charset="utf-8"></head><body>' + trimmed + '</body></html>';
    return srcdoc.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  // ===== Generate Markdown from current model =====
  function toMarkdown(globalDirs) {
    return window.SlideParser.generateMarkdown(slideModels, globalDirs || { theme: 'default', paginate: true });
  }

  // ===== Notify change =====
  function notifyChange() {
    if (typeof onChangeCallback === 'function') onChangeCallback();
  }

  // ===== Public API =====
  return {
    init, renderCanvas, renderSlideThumbnails, loadFromMarkdown, toMarkdown,
    addSlide, duplicateSlide, deleteSlide, reorderSlides,
    setActiveSlide, getActiveSlide,
    addElement, deleteElement, moveElement, updateElement, getElement, selectElement,
    get slideModels() { return slideModels; },
    set slideModels(val) { slideModels = val; },
    get activeSlideIndex() { return activeSlideIndex; },
    set activeSlideIndex(val) { activeSlideIndex = val; },
    get selectedElementId() { return selectedElementId; },
    set selectedElementId(val) { selectedElementId = val; },
    renderElementHTML,
    parseMarkdownToElements,
  };
})();
