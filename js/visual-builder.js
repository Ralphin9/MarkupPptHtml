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
    imageCompare: { type: 'imageCompare', leftImage: 'https://via.placeholder.com/400x250/264653/ffffff?text=Before', rightImage: 'https://via.placeholder.com/400x250/e76f51/ffffff?text=After', leftLabel: 'Before', rightLabel: 'After' },
    imageGrid: { type: 'imageGrid', images: [
      { url: 'https://via.placeholder.com/300x200/264653/ffffff?text=Image+1', caption: 'Image 1' },
      { url: 'https://via.placeholder.com/300x200/2a9d8f/ffffff?text=Image+2', caption: 'Image 2' },
      { url: 'https://via.placeholder.com/300x200/e9c46a/333333?text=Image+3', caption: 'Image 3' },
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
    document.querySelectorAll('.element-item').forEach(item => {
      item.addEventListener('click', () => {
        addElement(item.dataset.element);
      });
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
    canvas.className = 'slide-canvas-visual slide-theme-' + theme;

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

    // Render logo overlay
    renderLogoOverlay(canvas);
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

  // ===== Render element to HTML preview =====
  function renderElementHTML(el) {
    switch (el.type) {
      case 'heading': {
        const tag = 'h' + (el.level || 2);
        const fit = el.fit ? ' class="fit-heading"' : '';
        return `<${tag}${fit}>${escapeHtml(el.content || 'Heading')}</${tag}>`;
      }
      case 'fittext':
        return `<h1 class="fit-heading" style="font-size:2.5em;font-weight:900;text-align:center;">${escapeHtml(el.content || 'BIG TEXT')}</h1>`;
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
        return '<ul>' + items.map(i => '<li class="fragment">' + escapeHtml(i.replace(/^[*-]\s*/, '')) + '</li>').join('') + '</ul>';
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
        if (el.sizing) style += 'max-width:' + (el.sizing.includes('%') || el.sizing.includes('px') ? el.sizing : '') + ';';
        if (el.width) style += 'width:' + el.width + (el.width.match(/\d$/) ? 'px' : '') + ';';
        if (el.height) style += 'height:' + el.height + (el.height.match(/\d$/) ? 'px' : '') + ';';
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
      case 'imageGrid': {
        const imgs = el.images || [];
        const gridItems = imgs.map(img =>
          `<div class="ig-item"><img src="${encodeURI(img.url || '')}" alt="${escapeHtml(img.caption || '')}"><span class="ig-caption">${escapeHtml(img.caption || '')}</span></div>`
        ).join('');
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

      // Remove directive comments to parse content only
      let clean = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/^_\w[\w-]*\s*:.+$/gm, '').trim();

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

    while (i < lines.length) {
      const line = lines[i];

      // Skip empty lines
      if (!line.trim()) { i++; continue; }

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
  };
})();
