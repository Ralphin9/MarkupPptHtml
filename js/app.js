/**
 * app.js — Main controller for the 3-panel visual presentation builder.
 *
 * Wires together:  VisualBuilder ↔ Markdown Editor ↔ Renderer ↔ Exporter
 *                  ImageManager, DirectivesPanel, Templates, Presenter
 *
 * Manages: mode switching (visual / markdown / split), panel tabs,
 *          properties panel, auto-save to localStorage, keyboard shortcuts.
 */
(function () {
  'use strict';

  // ===== State =====
  let currentMode = 'visual'; // 'visual' | 'markdown' | 'split'
  let syncLock = false;       // Prevent circular sync
  const STORAGE_KEY = 'markupppt_project';
  const AUTOSAVE_DELAY = 1000;
  let autosaveTimer = null;

  // ===== Boot =====
  document.addEventListener('DOMContentLoaded', () => {
    initModules();
    setupModeSwitcher();
    setupLeftPanelTabs();
    setupRightPanelTabs();
    setupPropertiesPanel();
    setupExportMenu();
    setupTemplatesModal();
    setupHfLaunchSample();
    setupScriptToVideo();
    setupPresenter();
    setupThemeSelect();
    setupCustomCSS();
    setupDesignMdImport();
    setupKeyboardShortcuts();
    setupSlideNav();

    // Load from localStorage or start fresh
    loadProject();

    // Initial render
    fullRefresh();
  });

  // ===== Module Init =====
  function initModules() {
    window.VisualBuilder.init(onVisualChange);
    window.ImageManager.init(onImageInsert);
    window.DirectivesPanel.init(onDirectivesChange);
    window.Presenter.init();
    window.TutorialBuilder.init();
  }

  // ===== Mode Switcher =====
  function setupModeSwitcher() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setMode(btn.dataset.mode);
      });
    });
  }

  function setMode(mode) {
    currentMode = mode;

    // Update button states
    document.querySelectorAll('.mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === mode));

    const visualCanvas    = document.getElementById('visual-canvas-wrapper');
    const markdownPanel   = document.getElementById('markdown-panel');
    const tutorialPanel   = document.getElementById('tutorial-panel');
    const visualToolbar   = document.getElementById('visual-toolbar-area');
    const leftPanel       = document.getElementById('left-panel');
    const rightPanel      = document.getElementById('right-panel');
    const centerHeader    = document.querySelector('.center-header');

    // Reset all
    [visualCanvas, markdownPanel].forEach(el => {
      if (el) { el.classList.add('hidden'); el.classList.remove('split-mode'); }
    });
    if (tutorialPanel) tutorialPanel.classList.add('hidden');
    if (visualToolbar) visualToolbar.classList.remove('hidden');

    if (mode === 'tutorial') {
      // Tutorial mode: hide side panels, show full-width tutorial builder
      if (leftPanel)    leftPanel.style.display  = 'none';
      if (rightPanel)   rightPanel.style.display = 'none';
      if (centerHeader) centerHeader.style.display = 'none';
      if (tutorialPanel) tutorialPanel.classList.remove('hidden');
      // Refresh arrows after layout stabilises
      requestAnimationFrame(() => window.TutorialBuilder.updateArrows());
    } else {
      // Restore side panels
      if (leftPanel)    leftPanel.style.display  = '';
      if (rightPanel)   rightPanel.style.display = '';
      if (centerHeader) centerHeader.style.display = '';

      if (mode === 'visual') {
        visualCanvas.classList.remove('hidden');
        visualToolbar.classList.remove('hidden');
      } else if (mode === 'markdown') {
        markdownPanel.classList.remove('hidden');
        visualToolbar.classList.add('hidden');
        syncVisualToMarkdown();
      } else if (mode === 'split') {
        visualCanvas.classList.remove('hidden');
        markdownPanel.classList.remove('hidden');
        visualToolbar.classList.remove('hidden');
        visualCanvas.classList.add('split-mode');
        markdownPanel.classList.add('split-mode');
        syncVisualToMarkdown();
      }
    }
  }

  // ===== Left Panel Tabs =====
  function setupLeftPanelTabs() {
    document.querySelectorAll('.left-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.left-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#left-panel .left-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  }

  // ===== Right Panel Tabs =====
  function setupRightPanelTabs() {
    document.querySelectorAll('.right-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.right-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#right-panel .right-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  }

  // ===== Properties Panel =====
  function setupPropertiesPanel() {
    // Content textarea
    const propContent = document.getElementById('prop-content');
    if (propContent) {
      propContent.addEventListener('input', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (!elId) return;
        const el = window.VisualBuilder.getElement(elId);
        if (!el) return;

        if (el.type === 'columns') {
          // For columns, content is left column
          window.VisualBuilder.updateElement(elId, { leftContent: propContent.value });
        } else {
          window.VisualBuilder.updateElement(elId, { content: propContent.value });
        }
      });
    }

    // Size + rotation (universal transform)
    const propW = document.getElementById('prop-style-w');
    const propH = document.getElementById('prop-style-h');
    const propR = document.getElementById('prop-rotate');
    const propReset = document.getElementById('prop-transform-reset');
    const updateTransform = (patch) => {
      const elId = window.VisualBuilder.selectedElementId;
      if (elId) window.VisualBuilder.updateElement(elId, patch);
    };
    if (propW) propW.addEventListener('input', () => updateTransform({ styleW: propW.value ? parseInt(propW.value, 10) : null }));
    if (propH) propH.addEventListener('input', () => updateTransform({ styleH: propH.value ? parseInt(propH.value, 10) : null }));
    if (propR) propR.addEventListener('input', () => updateTransform({ rotate: propR.value ? parseFloat(propR.value) : null }));
    if (propReset) propReset.addEventListener('click', () => {
      updateTransform({ styleW: null, styleH: null, rotate: null });
      if (propW) propW.value = '';
      if (propH) propH.value = '';
      if (propR) propR.value = '';
    });

    // Heading level
    const propLevel = document.getElementById('prop-heading-level');
    if (propLevel) {
      propLevel.addEventListener('change', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (elId) window.VisualBuilder.updateElement(elId, { level: parseInt(propLevel.value) });
      });
    }

    // Code language
    const propLang = document.getElementById('prop-code-lang');
    if (propLang) {
      propLang.addEventListener('change', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (elId) window.VisualBuilder.updateElement(elId, { language: propLang.value });
      });
    }

    // Image URL
    const propImgUrl = document.getElementById('prop-img-url');
    if (propImgUrl) {
      propImgUrl.addEventListener('input', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (elId) window.VisualBuilder.updateElement(elId, { url: propImgUrl.value });
      });
    }

    // Image sizing
    const propImgSizing = document.getElementById('prop-img-sizing');
    if (propImgSizing) {
      propImgSizing.addEventListener('change', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (elId) window.VisualBuilder.updateElement(elId, { sizing: propImgSizing.value });
      });
    }

    // BG mode
    const propBgMode = document.getElementById('prop-bg-mode');
    if (propBgMode) {
      propBgMode.addEventListener('change', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (elId) window.VisualBuilder.updateElement(elId, { bgMode: propBgMode.value });
      });
    }

    // Fit check
    const propFit = document.getElementById('prop-fit-check');
    if (propFit) {
      propFit.addEventListener('change', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (elId) window.VisualBuilder.updateElement(elId, { fit: propFit.checked });
      });
    }

    // Filters
    document.querySelectorAll('#filter-chips input[data-filter]').forEach(cb => {
      cb.addEventListener('change', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (!elId) return;
        const filters = [];
        document.querySelectorAll('#filter-chips input[data-filter]:checked').forEach(c => {
          filters.push(c.dataset.filter);
        });
        window.VisualBuilder.updateElement(elId, { filters });
      });
    });

    // List style selector
    const propListStyle = document.getElementById('prop-list-style');
    if (propListStyle) {
      propListStyle.addEventListener('change', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (!elId) return;
        const el = window.VisualBuilder.getElement(elId);
        if (!el) return;
        const val = propListStyle.value;
        const typeMap = { dash: 'bullets', star: 'fragments', ordered: 'numbered' };
        const newType = typeMap[val];
        if (newType && newType !== el.type) {
          window.VisualBuilder.updateElement(elId, { type: newType });
        }
      });
    }

    // Right-column content (for columns element)
    const propRightContent = document.getElementById('prop-right-content');
    if (propRightContent) {
      propRightContent.addEventListener('input', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (elId) window.VisualBuilder.updateElement(elId, { rightContent: propRightContent.value });
      });
    }

    // Image Compare fields
    ['prop-compare-left', 'prop-compare-right', 'prop-compare-left-label', 'prop-compare-right-label'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (!elId) return;
        window.VisualBuilder.updateElement(elId, {
          leftImage: document.getElementById('prop-compare-left')?.value || '',
          rightImage: document.getElementById('prop-compare-right')?.value || '',
          leftLabel: document.getElementById('prop-compare-left-label')?.value || 'Before',
          rightLabel: document.getElementById('prop-compare-right-label')?.value || 'After',
        });
      });
    });

    // Image Grid fields — now uses per-image card UI
    // (old textarea-based sync removed; new card-based sync in renderGridImageCards)

    // Drag-and-drop zones for image compare (left & right)
    setupImageDropTarget('drop-compare-left', 'prop-compare-left', 'preview-compare-left');
    setupImageDropTarget('drop-compare-right', 'prop-compare-right', 'preview-compare-right');

    // Image Combine fields
    ['prop-combine-result', 'prop-combine-result-label'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', () => {
        const elId = window.VisualBuilder.selectedElementId;
        if (!elId) return;
        window.VisualBuilder.updateElement(elId, {
          resultImage: document.getElementById('prop-combine-result')?.value || '',
          resultLabel: document.getElementById('prop-combine-result-label')?.value || 'Result',
        });
      });
    });
    setupImageDropTarget('drop-combine-result', 'prop-combine-result', 'preview-combine-result');
    setupCombineDropTarget();

    // Drag-and-drop zone for image grid
    setupGridDropTarget();
  }

  /** Wire a drop zone to accept image drags from the gallery and populate a text input + preview */
  function setupImageDropTarget(dropId, inputId, previewId) {
    const zone = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!zone || !input) return;

    zone.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; zone.classList.add('drag-hover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-hover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-hover');

      // Accept gallery image-url or dropped files
      const url = e.dataTransfer.getData('image-url');
      if (url) {
        applyImageToField(url, input, preview, zone);
      } else if (e.dataTransfer.files?.length) {
        const file = e.dataTransfer.files[0];
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          // Also add to gallery
          window.ImageManager.addImageDirect(file.name, ev.target.result);
          applyImageToField(ev.target.result, input, preview, zone);
        };
        reader.readAsDataURL(file);
      }
    });

    // Clicking the zone triggers file browse
    zone.addEventListener('click', () => {
      const fi = document.createElement('input');
      fi.type = 'file';
      fi.accept = 'image/*';
      fi.addEventListener('change', () => {
        if (!fi.files?.length) return;
        const file = fi.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          window.ImageManager.addImageDirect(file.name, ev.target.result);
          applyImageToField(ev.target.result, input, preview, zone);
        };
        reader.readAsDataURL(file);
      });
      fi.click();
    });
  }

  function applyImageToField(url, input, preview, zone) {
    input.value = url;
    input.dispatchEvent(new Event('input'));
    if (preview) {
      preview.innerHTML = '<img src="' + encodeURI(url) + '" alt="">';
    }
    if (zone) zone.classList.add('has-image');
  }

  /** Wire the grid drop zone to accept multiple image drops */
  function setupGridDropTarget() {
    const zone = document.getElementById('drop-grid-images');
    if (!zone) return;

    zone.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; zone.classList.add('drag-hover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-hover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-hover');

      const addImage = (url) => {
        const elId = window.VisualBuilder.selectedElementId;
        if (!elId) return;
        const el = window.VisualBuilder.getElement(elId);
        if (!el || el.type !== 'imageGrid') return;
        const imgs = [...(el.images || [])];
        imgs.push({ url, caption: '', width: 280, height: 220 });
        window.VisualBuilder.updateElement(elId, { images: imgs });
        renderGridImageCards();
      };

      const url = e.dataTransfer.getData('image-url');
      if (url) {
        addImage(url);
      } else if (e.dataTransfer.files?.length) {
        Array.from(e.dataTransfer.files).forEach(file => {
          if (!file.type.startsWith('image/')) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            window.ImageManager.addImageDirect(file.name, ev.target.result);
            addImage(ev.target.result);
          };
          reader.readAsDataURL(file);
        });
      }
    });
  }

  /** Wire the combine source drop zone */
  function setupCombineDropTarget() {
    const zone = document.getElementById('drop-combine-sources');
    if (!zone) return;

    zone.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; zone.classList.add('drag-hover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-hover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-hover');

      const addSource = (url) => {
        const elId = window.VisualBuilder.selectedElementId;
        if (!elId) return;
        const el = window.VisualBuilder.getElement(elId);
        if (!el || el.type !== 'imageCombine') return;
        const srcs = [...(el.sourceImages || [])];
        srcs.push({ url, label: '' });
        window.VisualBuilder.updateElement(elId, { sourceImages: srcs });
        renderCombineSourceCards();
      };

      const url = e.dataTransfer.getData('image-url');
      if (url) {
        addSource(url);
      } else if (e.dataTransfer.files?.length) {
        Array.from(e.dataTransfer.files).forEach(file => {
          if (!file.type.startsWith('image/')) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            window.ImageManager.addImageDirect(file.name, ev.target.result);
            addSource(ev.target.result);
          };
          reader.readAsDataURL(file);
        });
      }
    });
  }

  /** Render per-image control cards for imageGrid */
  function renderGridImageCards() {
    const container = document.getElementById('grid-image-cards');
    if (!container) return;

    const elId = window.VisualBuilder.selectedElementId;
    if (!elId) { container.innerHTML = ''; return; }
    const el = window.VisualBuilder.getElement(elId);
    if (!el || el.type !== 'imageGrid') { container.innerHTML = ''; return; }

    const imgs = el.images || [];
    // Also update drop zone preview
    const zone = document.getElementById('drop-grid-images');
    const previewsEl = document.getElementById('grid-drop-previews');
    if (previewsEl) previewsEl.innerHTML = imgs.map(i => '<img src="' + encodeURI(i.url) + '" alt="">').join('');
    if (zone) zone.classList.toggle('has-image', imgs.length > 0);

    container.innerHTML = '';
    imgs.forEach((img, idx) => {
      const card = document.createElement('div');
      card.className = 'grid-img-card';
      card.innerHTML = `
        <div class="gic-preview"><img src="${encodeURI(img.url)}" alt=""></div>
        <div class="gic-controls">
          <input type="text" class="gic-caption" value="${(img.caption || '').replace(/"/g, '&quot;')}" placeholder="Caption" data-idx="${idx}">
          <div class="gic-size-row">
            <label>W</label>
            <input type="range" class="gic-width" min="80" max="500" value="${img.width || 280}" data-idx="${idx}">
            <span class="gic-val">${img.width || 280}px</span>
          </div>
          <div class="gic-size-row">
            <label>H</label>
            <input type="range" class="gic-height" min="60" max="500" value="${img.height || 220}" data-idx="${idx}">
            <span class="gic-val">${img.height || 220}px</span>
          </div>
          <button class="gic-remove" data-idx="${idx}" title="Remove image">&times;</button>
        </div>
      `;
      container.appendChild(card);
    });

    // Bind events
    container.querySelectorAll('.gic-caption').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx);
        const updated = [...(el.images || [])];
        if (updated[i]) { updated[i] = { ...updated[i], caption: e.target.value }; }
        window.VisualBuilder.updateElement(elId, { images: updated });
      });
    });
    container.querySelectorAll('.gic-width').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx);
        const val = parseInt(e.target.value);
        const sync = document.getElementById('grid-sync-sizes')?.checked;
        const updated = [...(el.images || [])];
        if (sync) {
          updated.forEach((img, j) => { updated[j] = { ...img, width: val }; });
          container.querySelectorAll('.gic-width').forEach(s => { s.value = val; s.nextElementSibling.textContent = val + 'px'; });
        } else {
          e.target.nextElementSibling.textContent = val + 'px';
          if (updated[i]) { updated[i] = { ...updated[i], width: val }; }
        }
        window.VisualBuilder.updateElement(elId, { images: updated });
      });
    });
    container.querySelectorAll('.gic-height').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx);
        const val = parseInt(e.target.value);
        const sync = document.getElementById('grid-sync-sizes')?.checked;
        const updated = [...(el.images || [])];
        if (sync) {
          updated.forEach((img, j) => { updated[j] = { ...img, height: val }; });
          container.querySelectorAll('.gic-height').forEach(s => { s.value = val; s.nextElementSibling.textContent = val + 'px'; });
        } else {
          e.target.nextElementSibling.textContent = val + 'px';
          if (updated[i]) { updated[i] = { ...updated[i], height: val }; }
        }
        window.VisualBuilder.updateElement(elId, { images: updated });
      });
    });
    container.querySelectorAll('.gic-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.idx);
        const updated = [...(el.images || [])];
        updated.splice(i, 1);
        window.VisualBuilder.updateElement(elId, { images: updated });
        renderGridImageCards();
      });
    });
  }

  /** Render per-source-image control cards for imageCombine */
  function renderCombineSourceCards() {
    const container = document.getElementById('combine-source-cards');
    if (!container) return;

    const elId = window.VisualBuilder.selectedElementId;
    if (!elId) { container.innerHTML = ''; return; }
    const el = window.VisualBuilder.getElement(elId);
    if (!el || el.type !== 'imageCombine') { container.innerHTML = ''; return; }

    const srcs = el.sourceImages || [];
    const previewsEl = document.getElementById('combine-src-previews');
    if (previewsEl) previewsEl.innerHTML = srcs.map(s => '<img src="' + encodeURI(s.url) + '" alt="">').join('');
    const zone = document.getElementById('drop-combine-sources');
    if (zone) zone.classList.toggle('has-image', srcs.length > 0);

    container.innerHTML = '';
    srcs.forEach((src, idx) => {
      const card = document.createElement('div');
      card.className = 'grid-img-card';
      card.innerHTML = `
        <div class="gic-preview"><img src="${encodeURI(src.url)}" alt=""></div>
        <div class="gic-controls">
          <input type="text" class="gic-caption" value="${(src.label || '').replace(/"/g, '&quot;')}" placeholder="Label" data-idx="${idx}">
          <button class="gic-remove" data-idx="${idx}" title="Remove">&times;</button>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.gic-caption').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx);
        const updated = [...(el.sourceImages || [])];
        if (updated[i]) { updated[i] = { ...updated[i], label: e.target.value }; }
        window.VisualBuilder.updateElement(elId, { sourceImages: updated });
      });
    });
    container.querySelectorAll('.gic-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.idx);
        const updated = [...(el.sourceImages || [])];
        updated.splice(i, 1);
        window.VisualBuilder.updateElement(elId, { sourceImages: updated });
        renderCombineSourceCards();
      });
    });
  }

  function refreshGridPreviews() {
    renderGridImageCards();
  }

  function renderPropertiesPanel() {
    const elId = window.VisualBuilder.selectedElementId;
    const noneMsg = document.getElementById('props-none');
    const editor  = document.getElementById('props-editor');

    if (!elId) {
      if (noneMsg) noneMsg.classList.remove('hidden');
      if (editor)  editor.classList.add('hidden');
      return;
    }

    const el = window.VisualBuilder.getElement(elId);
    if (!el) {
      if (noneMsg) noneMsg.classList.remove('hidden');
      if (editor)  editor.classList.add('hidden');
      return;
    }

    if (noneMsg) noneMsg.classList.add('hidden');
    if (editor)  editor.classList.remove('hidden');

    // Type label
    const typeLabel = document.getElementById('prop-type');
    if (typeLabel) typeLabel.textContent = el.type.charAt(0).toUpperCase() + el.type.slice(1);

    // Universal size + rotation values
    const propW = document.getElementById('prop-style-w');
    const propH = document.getElementById('prop-style-h');
    const propR = document.getElementById('prop-rotate');
    if (propW) propW.value = el.styleW != null ? el.styleW : '';
    if (propH) propH.value = el.styleH != null ? el.styleH : '';
    if (propR) propR.value = el.rotate != null ? el.rotate : '';

    // Content
    const propContent = document.getElementById('prop-content');
    const contentGroup = document.getElementById('prop-content-group');
    if (propContent && contentGroup) {
      if (el.type === 'hr') {
        contentGroup.classList.add('hidden');
      } else if (el.type === 'image') {
        contentGroup.classList.add('hidden');
      } else if (el.type === 'imageCompare') {
        contentGroup.classList.add('hidden');
      } else if (el.type === 'imageCombine') {
        contentGroup.classList.add('hidden');
      } else if (el.type === 'imageGrid') {
        contentGroup.classList.add('hidden');
      } else if (el.type === 'columns') {
        contentGroup.classList.remove('hidden');
        propContent.value = el.leftContent || '';
        document.querySelector('#prop-content-group label').textContent = 'Left Column';
      } else {
        contentGroup.classList.remove('hidden');
        document.querySelector('#prop-content-group label').textContent = 'Content';
        propContent.value = el.content || '';
      }
    }

    // Show/hide type-specific fields
    toggleGroup('prop-level-group',    el.type === 'heading');
    toggleGroup('prop-lang-group',     el.type === 'code');
    toggleGroup('prop-imgurl-group',   el.type === 'image');
    toggleGroup('prop-imgsize-group',  el.type === 'image');
    toggleGroup('prop-imgfilter-group',el.type === 'image');
    toggleGroup('prop-bgimg-group',    el.type === 'image');
    toggleGroup('prop-fit-group',      el.type === 'heading' || el.type === 'fittext');
    toggleGroup('prop-fragment-group', el.type === 'bullets' || el.type === 'numbered' || el.type === 'fragments');
    toggleGroup('prop-right-content-group', el.type === 'columns');
    toggleGroup('prop-compare-group', el.type === 'imageCompare');
    toggleGroup('prop-combine-group', el.type === 'imageCombine');
    toggleGroup('prop-grid-group', el.type === 'imageGrid');

    // Set list style value based on element type
    if (el.type === 'bullets' || el.type === 'fragments' || el.type === 'numbered') {
      const listStyle = document.getElementById('prop-list-style');
      if (listStyle) {
        const typeToStyle = { bullets: 'dash', fragments: 'star', numbered: 'ordered' };
        listStyle.value = typeToStyle[el.type] || 'dash';
      }
    }

    // Set right column content for columns
    if (el.type === 'columns') {
      const rightContent = document.getElementById('prop-right-content');
      if (rightContent) rightContent.value = el.rightContent || '';
    }

    // Set values for specific types
    if (el.type === 'heading') {
      const level = document.getElementById('prop-heading-level');
      if (level) level.value = el.level || 2;
    }
    if (el.type === 'code') {
      const lang = document.getElementById('prop-code-lang');
      if (lang) lang.value = el.language || '';
    }
    if (el.type === 'image') {
      const url = document.getElementById('prop-img-url');
      if (url) url.value = el.url || '';
      const sizing = document.getElementById('prop-img-sizing');
      if (sizing) sizing.value = el.sizing || '';
      const bgMode = document.getElementById('prop-bg-mode');
      if (bgMode) bgMode.value = el.bgMode || '';

      // Image preview
      const preview = document.getElementById('prop-img-preview');
      if (preview) {
        preview.innerHTML = el.url ? `<img src="${encodeURI(el.url)}" alt="preview" style="max-width:100%;max-height:80px;border-radius:4px;">` : '';
      }

      // Filters
      document.querySelectorAll('#filter-chips input[data-filter]').forEach(cb => {
        cb.checked = (el.filters || []).includes(cb.dataset.filter);
      });
    }
    if (el.type === 'heading' || el.type === 'fittext') {
      const fit = document.getElementById('prop-fit-check');
      if (fit) fit.checked = el.fit || el.type === 'fittext';
    }
    if (el.type === 'imageCompare') {
      setValue('prop-compare-left', el.leftImage || '');
      setValue('prop-compare-right', el.rightImage || '');
      setValue('prop-compare-left-label', el.leftLabel || 'Before');
      setValue('prop-compare-right-label', el.rightLabel || 'After');
      // Update drop zone previews
      updateDropPreview('preview-compare-left', 'drop-compare-left', el.leftImage);
      updateDropPreview('preview-compare-right', 'drop-compare-right', el.rightImage);
    }
    if (el.type === 'imageCombine') {
      setValue('prop-combine-result', el.resultImage || '');
      setValue('prop-combine-result-label', el.resultLabel || 'Result');
      updateDropPreview('preview-combine-result', 'drop-combine-result', el.resultImage);
      renderCombineSourceCards();
    }
    if (el.type === 'imageGrid') {
      renderGridImageCards();
    }
  }

  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function updateDropPreview(previewId, zoneId, url) {
    const preview = document.getElementById(previewId);
    const zone = document.getElementById(zoneId);
    if (preview) {
      preview.innerHTML = url ? '<img src="' + encodeURI(url) + '" alt="">' : '';
    }
    if (zone) zone.classList.toggle('has-image', !!url);
  }

  function toggleGroup(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !show);
  }

  // ===== Sync: Visual ↔ Markdown =====
  function onVisualChange() {
    if (syncLock) return;
    syncLock = true;

    window.VisualBuilder.renderCanvas();
    window.VisualBuilder.renderSlideThumbnails();
    renderPropertiesPanel();
    window.DirectivesPanel.renderSlideDirectives();
    updateSlideIndicator();

    // Sync markdown
    if (currentMode === 'markdown' || currentMode === 'split') {
      syncVisualToMarkdown();
    }

    scheduleAutosave();
    syncLock = false;
  }

  function syncVisualToMarkdown() {
    const editor = document.getElementById('markdown-editor');
    if (!editor) return;
    editor.value = window.VisualBuilder.toMarkdown(window.DirectivesPanel.getGlobalDirectives());
  }

  function syncMarkdownToVisual() {
    const editor = document.getElementById('markdown-editor');
    if (!editor) return;
    syncLock = true;
    try {
      window.VisualBuilder.loadFromMarkdown(editor.value);
    } finally {
      syncLock = false;
    }
  }

  // ===== Markdown editor changes =====
  function setupMarkdownEditorSync() {
    const editor = document.getElementById('markdown-editor');
    if (!editor) return;

    let debounce;
    editor.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (currentMode === 'markdown' || currentMode === 'split') {
          syncMarkdownToVisual();
          window.VisualBuilder.renderCanvas();
          window.VisualBuilder.renderSlideThumbnails();
          renderPropertiesPanel();
          updateSlideIndicator();
          scheduleAutosave();
        }
      }, 400);
    });
  }

  // ===== Directives change =====
  function onDirectivesChange() {
    if (syncLock) return;
    // Re-render visual with new directives
    window.VisualBuilder.renderCanvas();
    window.VisualBuilder.renderSlideThumbnails();
    if (currentMode === 'markdown' || currentMode === 'split') {
      syncVisualToMarkdown();
    }
    scheduleAutosave();
  }

  // ===== Image Insert =====
  function onImageInsert(url, name) {
    const el = window.VisualBuilder.addElement('image');
    if (el) {
      window.VisualBuilder.updateElement(el.id, { url, alt: name || '' });
    }
  }

  // ===== Slide Navigation =====
  function setupSlideNav() {
    document.getElementById('btn-prev-slide')?.addEventListener('click', () => {
      const idx = window.VisualBuilder.activeSlideIndex;
      if (idx > 0) window.VisualBuilder.setActiveSlide(idx - 1);
    });
    document.getElementById('btn-next-slide')?.addEventListener('click', () => {
      const idx = window.VisualBuilder.activeSlideIndex;
      if (idx < window.VisualBuilder.slideModels.length - 1) window.VisualBuilder.setActiveSlide(idx + 1);
    });
    setupMarkdownEditorSync();
  }

  function updateSlideIndicator() {
    const indicator = document.getElementById('slide-indicator');
    const badge = document.getElementById('slide-count-badge');
    const total = window.VisualBuilder.slideModels.length;
    const current = window.VisualBuilder.activeSlideIndex + 1;
    if (indicator) indicator.textContent = current + ' / ' + total;
    if (badge) badge.textContent = total + ' slide' + (total !== 1 ? 's' : '');
  }

  // ===== Awesome-Marp Dynamic Theme Loader =====
  const AWESOME_MARP_THEMES = [
    'awesome-marp-blue',
    'awesome-marp-dark',
    'awesome-marp-green',
    'awesome-marp-red',
    'awesome-marp-purple',
    'awesome-marp-brown',
  ];

  function loadAwesomeMarpTheme(theme) {
    // Remove any previously loaded Awesome-Marp theme link
    const existing = document.getElementById('awesome-marp-theme-link');
    if (existing) existing.remove();

    if (!AWESOME_MARP_THEMES.includes(theme)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'awesome-marp-theme-link';
    link.href = 'themes/' + theme + '.css';
    document.head.appendChild(link);
  }

  // ===== Theme Select (header) =====
  function setupThemeSelect() {
    const sel = document.getElementById('theme-select');
    if (!sel) return;
    sel.addEventListener('change', () => {
      const theme = sel.value;
      loadAwesomeMarpTheme(theme);
      window.DirectivesPanel.setGlobalDirectives({ theme });
      // Also set dir-theme in directives panel
      const dirTheme = document.getElementById('dir-theme');
      if (dirTheme) dirTheme.value = theme;
      onDirectivesChange();
    });

    // Sync dir-theme with header theme-select
    const dirTheme = document.getElementById('dir-theme');
    if (dirTheme) {
      dirTheme.addEventListener('change', () => {
        loadAwesomeMarpTheme(dirTheme.value);
        sel.value = dirTheme.value;
        window.DirectivesPanel.setGlobalDirectives({ theme: dirTheme.value });
        onDirectivesChange();
      });
    }
  }

  // ===== Custom CSS =====
  function setupCustomCSS() {
    const editor = document.getElementById('custom-css-editor');

    const ensureCustomStyleTag = () => {
      let existing = document.getElementById('custom-user-css');
      if (!existing) {
        existing = document.createElement('style');
        existing.id = 'custom-user-css';
        document.head.appendChild(existing);
      }
      return existing;
    };

    const buildPreviewCss = (css) => {
      const marpitAlias = String(css || '')
        .replace(/:root\b/g, '.slide-frame')
        .replace(/(^|[,{]\s*)section(?=[\s.#:[,{>+~]|$)/gm, '$1.slide-frame');
      return css + '\n\n/* Live preview Marpit aliases */\n' + marpitAlias;
    };

    const applyCustomCss = (css) => {
      if (!css) return;
      const styleTag = ensureCustomStyleTag();
      styleTag.textContent = buildPreviewCss(css);
      window.DirectivesPanel.setGlobalDirectives({ customStyle: css, style: css });
    };

    document.getElementById('btn-apply-css')?.addEventListener('click', () => {
      const css = editor?.value;
      if (!css) return;
      applyCustomCss(css);
      toast('Custom CSS applied');
    });

    const addClassToken = (existing, token) => {
      const list = String(existing || '').split(/\s+/).filter(Boolean);
      if (!list.includes(token)) list.push(token);
      return list.join(' ');
    };

    const removeTagTokens = (existing) => String(existing || '').split(/\s+/).filter(Boolean).filter(t => !t.startsWith('tag-')).join(' ');

    document.querySelectorAll('#css-tags .css-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const classToken = btn.dataset.class;
        const cssSnippet = btn.dataset.css || '';
        if (!classToken || !editor) return;

        if (cssSnippet && !editor.value.includes(cssSnippet)) {
          editor.value = (editor.value ? editor.value + '\n\n' : '') + cssSnippet;
        }
        applyCustomCss(editor.value);

        const scope = document.querySelector('input[name="css-tag-scope"]:checked')?.value || 'current';
        if (scope === 'all') {
          window.VisualBuilder.slideModels.forEach(slide => {
            slide.directives = slide.directives || {};
            slide.directives.class = addClassToken(slide.directives.class, classToken);
          });
        } else {
          const slide = window.VisualBuilder.getActiveSlide();
          if (slide) {
            slide.directives = slide.directives || {};
            slide.directives.class = addClassToken(slide.directives.class, classToken);
          }
        }

        window.DirectivesPanel.renderSlideDirectives();
        onDirectivesChange();
        toast('#' + classToken.replace(/^tag-/, '') + ' applied to ' + (scope === 'all' ? 'all pages' : 'current page'));
      });
    });

    document.getElementById('btn-clear-css-tags')?.addEventListener('click', () => {
      const scope = document.querySelector('input[name="css-tag-scope"]:checked')?.value || 'current';
      if (scope === 'all') {
        window.VisualBuilder.slideModels.forEach(slide => {
          slide.directives = slide.directives || {};
          slide.directives.class = removeTagTokens(slide.directives.class);
        });
      } else {
        const slide = window.VisualBuilder.getActiveSlide();
        if (slide) {
          slide.directives = slide.directives || {};
          slide.directives.class = removeTagTokens(slide.directives.class);
        }
      }
      window.DirectivesPanel.renderSlideDirectives();
      onDirectivesChange();
      toast('Hashtag styles removed from ' + (scope === 'all' ? 'all pages' : 'current page'));
    });
  }

  // ===== Export Menu =====
  function setupExportMenu() {
    const btn = document.getElementById('btn-export');
    const menu = document.getElementById('export-menu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('show');
    });

    document.addEventListener('click', () => menu.classList.remove('show'));

    menu.querySelectorAll('button[data-export]').forEach(b => {
      b.addEventListener('click', () => {
        menu.classList.remove('show');
        doExport(b.dataset.export);
      });
    });
  }

  function doExport(format) {
    // Build parsed slides array for the exporter / presenter
    const parsedSlides = buildParsedSlides();
    const theme = window.DirectivesPanel.getGlobalDirectives().theme || 'default';

    switch (format) {
      case 'html':
        window.SlideExporter.exportHTML(parsedSlides, theme);
        break;
      case 'pdf':
        window.SlideExporter.exportPDF(parsedSlides, theme);
        break;
      case 'pptx':
        window.SlideExporter.exportPPTX(parsedSlides, theme);
        break;
      case 'png':
        window.SlideExporter.exportPNG(parsedSlides, theme);
        break;
      case 'md':
        exportMarkdown();
        break;
    }
  }

  function exportMarkdown() {
    const md = window.VisualBuilder.toMarkdown(window.DirectivesPanel.getGlobalDirectives());
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Markdown exported!');
  }

  /** Convert visual model to parsed slides format for renderer/exporter */
  function buildParsedSlides() {
    const globals = window.DirectivesPanel.getGlobalDirectives();
    const theme = globals.theme || 'default';

    return window.VisualBuilder.slideModels.map(slide => {
      // Render elements to HTML
      let html = '';
      slide.elements.forEach(el => {
        // Background images are rendered by slide.bgImage, so skip inline duplication.
        if (el.type === 'image' && el.bgMode) return;
        html += window.VisualBuilder.renderElementHTML(el);
      });

      // Detect slide type
      let type = 'content';
      if (slide.elements.length === 0) type = 'blank';
      else if (slide.elements.length <= 2 && slide.elements[0]?.type === 'heading' && (slide.elements[0]?.level || 2) === 1) type = 'title';

      // Detect bg image from image elements
      let bgImage = null;
      slide.elements.forEach(el => {
        if (el.type === 'image' && el.bgMode) {
          bgImage = {
            url: el.url,
            position: el.bgMode.replace('bg ', '').replace('bg', 'cover') || 'cover',
            sizing: el.sizing || '',
            filters: Array.isArray(el.filters) ? [...el.filters] : [],
          };
        }
      });

      return {
        type,
        html,
        theme,
        directives: {
          // Inherit global transition (per-slide `_transition` overrides it).
          transition: globals.transition
            ? (globals.transitionDuration
                ? `${globals.transition} ${globals.transitionDuration}`
                : globals.transition)
            : undefined,
          ...slide.directives,
        },
        bgImage,
        header: slide.directives?.header || globals.header || '',
        footer: slide.directives?.footer || globals.footer || '',
        logo: globals.logo || '',
        paginate: globals.paginate,
      };
    });
  }

  // ===== Import DESIGN.md =====
  // Persists the last-applied DESIGN.md source + the CSS/state that was active
  // BEFORE applying it, so the user can:
  //   - Load saved : repopulate the textarea with the previously applied source
  //   - Revert     : roll back the live theme to what it was before applying
  //   - Clear      : drop both the snapshot and the active DESIGN.md theme
  function setupDesignMdImport() {
    const DM_KEY = 'markupppt_design_md';

    const btn      = document.getElementById('btn-import-design');
    const modal    = document.getElementById('design-md-modal');
    const input    = document.getElementById('design-md-input');
    const apply    = document.getElementById('btn-design-md-apply');
    const loadBtn  = document.getElementById('btn-design-md-load');
    const revertBtn= document.getElementById('btn-design-md-revert');
    const clearBtn = document.getElementById('btn-design-md-clear');
    const status   = document.getElementById('design-md-status');
    const editor   = document.getElementById('custom-css-editor');
    if (!btn || !modal || !input || !apply) return;

    const ensureStyleTag = () => {
      let t = document.getElementById('custom-user-css');
      if (!t) { t = document.createElement('style'); t.id = 'custom-user-css'; document.head.appendChild(t); }
      return t;
    };
    const buildPreviewCss = (css) => {
      if (!css) return '';
      const aliased = String(css)
        .replace(/:root\b/g, '.slide-frame')
        .replace(/(^|[,{]\s*)section(?=[\s.#:[,{>+~]|$)/gm, '$1.slide-frame');
      return css + '\n\n/* Live preview Marpit aliases */\n' + aliased;
    };
    const writeStatus = (msg, ok) => {
      if (!status) return;
      status.textContent = msg;
      status.style.color = ok === false ? '#f38ba8' : (ok ? '#a6e3a1' : '#9aa');
    };
    const readSaved = () => {
      try { return JSON.parse(localStorage.getItem(DM_KEY) || 'null'); }
      catch { return null; }
    };
    const writeSaved = (obj) => {
      if (obj) localStorage.setItem(DM_KEY, JSON.stringify(obj));
      else     localStorage.removeItem(DM_KEY);
    };

    const open = () => {
      modal.classList.remove('hidden');
      const saved = readSaved();
      if (saved && saved.source && !input.value.trim()) input.value = saved.source;
      if (saved) writeStatus('Saved DESIGN.md ready to load (' + (saved.name || 'unnamed') + ', ' + new Date(saved.appliedAt || Date.now()).toLocaleString() + ')');
      else       writeStatus('');
    };
    const close = () => modal.classList.add('hidden');

    btn.addEventListener('click', open);
    modal.querySelectorAll('[data-close="design-md-modal"], .modal-overlay').forEach(el => {
      el.addEventListener('click', close);
    });

    apply.addEventListener('click', () => {
      const md = input.value.trim();
      if (!md) { writeStatus('Paste a DESIGN.md first.', false); return; }
      try {
        const result = window.DesignMdImport.importString(md);
        const css = result.css;

        // Snapshot the BEFORE state once per session (don't overwrite on re-apply
        // so Revert always rolls back to the original pre-DESIGN.md theme).
        const prev = readSaved();
        const beforeSnapshot = (prev && prev.previousCss !== undefined)
          ? prev.previousCss
          : (window.DirectivesPanel.getGlobalDirectives().style || '');

        // Apply
        ensureStyleTag().textContent = buildPreviewCss(css);
        if (editor) editor.value = css;
        window.DirectivesPanel.setGlobalDirectives({ customStyle: css, style: css });

        // Persist
        writeSaved({
          source: md,
          generatedCss: css,
          previousCss: beforeSnapshot,
          name: result.name,
          appliedAt: Date.now(),
        });

        const s = result.summary;
        const warn = (result.warnings && result.warnings.length)
          ? ` — ${result.warnings.length} warning(s); see console`
          : '';
        if (result.warnings && result.warnings.length) {
          console.group('[DESIGN.md] warnings');
          result.warnings.forEach(w => console.warn(w));
          console.groupEnd();
        }
        writeStatus(
          `Applied "${result.name}" — colors:${s.colors} typography:${s.typography} rounded:${s.rounded} spacing:${s.spacing} components:${s.components}${warn}`,
          true
        );
        toast('DESIGN.md theme applied & saved');
        fullRefresh();
        setTimeout(close, 800);
      } catch (e) {
        console.error(e);
        writeStatus('Parse error: ' + (e && e.message || e), false);
      }
    });

    loadBtn?.addEventListener('click', () => {
      const saved = readSaved();
      if (!saved || !saved.source) { writeStatus('No saved DESIGN.md found.', false); return; }
      input.value = saved.source;
      writeStatus(`Loaded "${saved.name || 'unnamed'}" from ${new Date(saved.appliedAt).toLocaleString()} — click Apply to re-activate.`, true);
    });

    revertBtn?.addEventListener('click', () => {
      const saved = readSaved();
      if (!saved) { writeStatus('Nothing to revert — no DESIGN.md has been applied.', false); return; }
      const prevCss = saved.previousCss || '';
      ensureStyleTag().textContent = buildPreviewCss(prevCss);
      if (editor) editor.value = prevCss;
      window.DirectivesPanel.setGlobalDirectives({ customStyle: prevCss, style: prevCss });
      // Keep the saved source so the user can re-apply later, but clear the
      // pre-snapshot so the next Apply records a fresh baseline.
      writeSaved({ ...saved, previousCss: undefined });
      writeStatus('Reverted to previous theme. Saved DESIGN.md source is still available via Load saved.', true);
      toast('DESIGN.md reverted');
      fullRefresh();
    });

    clearBtn?.addEventListener('click', () => {
      if (!confirm('Clear the applied DESIGN.md theme and remove the saved source from this browser?')) return;
      const saved = readSaved();
      const prevCss = (saved && saved.previousCss) || '';
      ensureStyleTag().textContent = buildPreviewCss(prevCss);
      if (editor) editor.value = prevCss;
      window.DirectivesPanel.setGlobalDirectives({ customStyle: prevCss, style: prevCss });
      writeSaved(null);
      input.value = '';
      writeStatus('Cleared.', true);
      toast('DESIGN.md cleared');
      fullRefresh();
    });

    // Auto-restore on page load. We do NOT overwrite the project's existing
    // customStyle if the user has manually changed it since last apply — only
    // re-inject the live <style> tag so component classes still render.
    try {
      const saved = readSaved();
      if (saved && saved.generatedCss) {
        ensureStyleTag().textContent = buildPreviewCss(saved.generatedCss);
        const dirs = window.DirectivesPanel.getGlobalDirectives();
        if (!dirs.style && !dirs.customStyle) {
          window.DirectivesPanel.setGlobalDirectives({ customStyle: saved.generatedCss, style: saved.generatedCss });
          if (editor) editor.value = saved.generatedCss;
        }
        console.info('[DESIGN.md] Auto-restored saved theme:', saved.name || '(unnamed)');
      }
    } catch (e) {
      console.warn('[DESIGN.md] Auto-restore failed:', e);
    }
  }

  // ===== Templates Modal =====
  function setupTemplatesModal() {
    const btn = document.getElementById('btn-templates');
    const modal = document.getElementById('templates-modal');
    if (!btn || !modal) return;

    btn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      const gallery = document.getElementById('templates-gallery');
      if (gallery) {
        window.SlideTemplates.renderGallery(gallery, (tpl) => {
          // Insert template markdown: parse it and merge into visual model
          if (tpl.id === 'starter') {
            // Full deck replacement
            window.VisualBuilder.loadFromMarkdown(tpl.markdown);
            window.DirectivesPanel.setGlobalDirectives({ theme: 'default', paginate: true });
          } else {
            // Insert as new slide(s) after current
            const slide = window.VisualBuilder.addSlide(window.VisualBuilder.activeSlideIndex);
            const { elements, directives } = parseTemplateToElements(tpl.markdown);
            elements.forEach(el => slide.elements.push(el));
            Object.assign(slide.directives, directives);
          }
          modal.classList.add('hidden');
          fullRefresh();
        });
      }
    });

    // Close modal
    modal.querySelector('.modal-close')?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.querySelector('.modal-overlay')?.addEventListener('click', () => modal.classList.add('hidden'));
  }

  // ===== Hyperframes Launch sample loader =====
  // "🎬 HF Launch" button: shows a picker of available sample decks.
  function setupHfLaunchSample() {
    const btn = document.getElementById('btn-load-hf-launch');
    if (!btn) return;
    // Expose fullRefresh so the Script→Video module can trigger it after
    // injecting a slide (loaded async, doesn't see this closure).
    window.__app_fullRefresh = fullRefresh;

    // Catalog of available samples — add entries here as new samples are created.
    const SAMPLES = [
      {
        file: 'samples/hyperframes-launch-v3.md',
        label: 'Storyboard v3 — Cinematic (GSAP animations)',
        desc: '10 beats, full 60s video script with self-contained GSAP compositions per slide. The original HeyGen HyperFrames launch video scaffold.',
      },
      {
        file: 'samples/hyperframes-launch.md',
        label: 'Intro Narrative — 16 slides',
        desc: '16-slide written walkthrough of the HyperFrames feature set: problem, how-it-works, benchmarks, roadmap.',
      },
      {
        file: 'samples/script-to-video-sample.txt',
        label: 'Script-to-Video sample script',
        desc: 'Plain-text TTS script for the AI-changes-software-engineering narrative (8 sentences → 8 scenes).',
        isScript: true,
      },
    ];

    const modal  = document.getElementById('sample-picker-modal');
    const list   = document.getElementById('sample-picker-list');
    const loadBtn = document.getElementById('btn-sample-picker-load');
    if (!modal || !list || !loadBtn) return;

    // Build radio list
    list.innerHTML = SAMPLES.map((s, i) => `
      <label style="display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:8px;
                    border:1px solid var(--border,#444);cursor:pointer;transition:background .15s;"
             onmouseover="this.style.background='var(--hover-bg,rgba(255,255,255,.05))'"
             onmouseout="this.style.background=''">
        <input type="radio" name="sample-pick" value="${i}" ${i === 0 ? 'checked' : ''}
               style="margin-top:3px;flex-shrink:0;">
        <div>
          <div style="font-weight:600;font-size:14px;">${s.label}</div>
          <div style="font-size:12px;color:var(--text-muted,#9aa);margin-top:2px;">${s.desc}</div>
        </div>
      </label>`).join('');

    // Open picker
    btn.addEventListener('click', () => {
      modal.classList.remove('hidden');
    });

    // Close on overlay / close button (generic modal-close handler picks this up already)
    modal.querySelector('.modal-overlay')?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.querySelectorAll('.modal-close[data-close]').forEach(b =>
      b.addEventListener('click', () => modal.classList.add('hidden')));

    // Load selected
    loadBtn.addEventListener('click', async () => {
      const checked = list.querySelector('input[name="sample-pick"]:checked');
      if (!checked) return;
      const sample = SAMPLES[parseInt(checked.value, 10)];
      if (!sample) return;

      if (!confirm(`Replace the current deck with:\n"${sample.label}"?`)) return;

      modal.classList.add('hidden');
      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = '⏳ Loading…';

      try {
        const res = await fetch(sample.file, { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();

        if (sample.isScript) {
          // Open the Script→Video modal pre-filled instead of replacing the deck
          const s2vBtn = document.getElementById('btn-script-to-video');
          const s2vText = document.getElementById('s2v-text');
          if (s2vText) s2vText.value = text.trim();
          s2vBtn?.click();
          toast('Script loaded into Script→Video');
        } else {
          window.VisualBuilder.loadFromMarkdown(text);
          window.DirectivesPanel.setGlobalDirectives({ theme: 'default', paginate: true });
          fullRefresh();
          const slideCount = text.split(/^---$/m).filter(s => s.trim()).length;
          toast(`Loaded "${sample.label}" — ${slideCount} slides`);
        }
      } catch (e) {
        console.error('[Sample Loader] failed:', e);
        alert(`Could not load ${sample.file}.\n\nMake sure the project is served (e.g. localhost:8080).\n\n${e && e.message || e}`);
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });
  }

  // ===== Script → Video (OmniVoice TTS + HyperFrames composition) =====
  function setupScriptToVideo() {
    const btnOpen = document.getElementById('btn-script-to-video');
    const modal = document.getElementById('s2v-modal');
    if (!btnOpen || !modal) return;
    const elText = modal.querySelector('#s2v-text');
    const elFile = modal.querySelector('#s2v-file');
    const elVoice = modal.querySelector('#s2v-voice');
    const elRef = modal.querySelector('#s2v-ref');
    const elServerMode = modal.querySelector('#s2v-server-mode');
    const elServer = modal.querySelector('#s2v-server');
    const elLog = modal.querySelector('#s2v-log');
    const btnGo = modal.querySelector('#s2v-go');
    const btnCancel = modal.querySelector('#s2v-cancel');
    const btnSample = modal.querySelector('#s2v-load-sample');

    function log(msg) {
      const ts = new Date().toLocaleTimeString();
      elLog.textContent += `\n[${ts}] ${msg}`;
      elLog.scrollTop = elLog.scrollHeight;
    }
    function open() {
      modal.classList.remove('hidden');
      elText.focus();
    }
    function close() { modal.classList.add('hidden'); }

    btnOpen.addEventListener('click', open);
    btnCancel.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    elVoice.addEventListener('change', () => {
      modal.dataset.voice = elVoice.value;
    });

    function applyServerMode() {
      const m = elServerMode.value;
      modal.dataset.server = m;
      if (m === 'hf') { elServer.style.display = 'none'; elServer.value = ''; }
      else if (m === 'local') { elServer.style.display = 'block'; elServer.value = 'http://localhost:8001'; }
      else { elServer.style.display = 'block'; if (!elServer.value) elServer.value = 'http://'; elServer.focus(); }
    }
    elServerMode.addEventListener('change', applyServerMode);

    // ---- server status ping ----
    const elStatus = modal.querySelector('#s2v-server-status');
    function setStatus(state) {
      if (!elStatus) return;
      if (state === 'checking') {
        elStatus.style.display = 'inline';
        elStatus.textContent = '⏳ checking…';
        elStatus.style.background = '#333'; elStatus.style.color = '#aaa';
      } else if (state === 'up') {
        elStatus.style.display = 'inline';
        elStatus.textContent = '🟢 server running';
        elStatus.style.background = '#1a3a1a'; elStatus.style.color = '#6c6';
      } else if (state === 'down') {
        elStatus.style.display = 'inline';
        elStatus.textContent = '🔴 not reachable';
        elStatus.style.background = '#3a1a1a'; elStatus.style.color = '#c66';
      } else {
        elStatus.style.display = 'none';
      }
    }
    async function pingServer(url) {
      setStatus('checking');
      try {
        const r = await fetch(url.replace(/\/$/, '') + '/', { method: 'GET', mode: 'no-cors', cache: 'no-cache', signal: AbortSignal.timeout(4000) });
        // no-cors always returns opaque response — if we get here without throw the port is open
        setStatus('up');
        // Auto-switch to local mode when local server is confirmed up
        if (url.includes('localhost:8001') && elServerMode.value === 'hf') {
          elServerMode.value = 'local';
          applyServerMode();
        }
      } catch {
        setStatus('down');
      }
    }
    function maybePing() {
      const m = elServerMode.value;
      if (m === 'local') pingServer('http://localhost:8001');
      else if (m === 'custom' && elServer.value.startsWith('http')) pingServer(elServer.value.trim());
      // Always probe localhost:8001 on open to auto-switch if running
      else pingServer('http://localhost:8001');
    }
    elServerMode.addEventListener('change', maybePing);
    elServer.addEventListener('change', maybePing);
    // ping when modal opens if local is pre-selected
    btnOpen.addEventListener('click', () => setTimeout(maybePing, 50));

    elFile.addEventListener('change', async () => {
      const f = elFile.files?.[0];
      if (!f) return;
      elText.value = await f.text();
    });

    // ---- AI topic → script ----
    const btnGenScript = modal.querySelector('#s2v-generate-script');
    const elOpenAIKey = modal.querySelector('#s2v-openai-key');
    // Restore saved key
    if (elOpenAIKey) {
      const saved = localStorage.getItem('s2v_openai_key');
      if (saved) elOpenAIKey.value = saved;
      elOpenAIKey.addEventListener('input', () => {
        const v = elOpenAIKey.value.trim();
        if (v) localStorage.setItem('s2v_openai_key', v);
        else localStorage.removeItem('s2v_openai_key');
      });
    }
    if (btnGenScript) {
      btnGenScript.addEventListener('click', async () => {
        const key   = (elOpenAIKey?.value || '').trim();
        const aiModel = modal.querySelector('#s2v-openai-model')?.value || 'gpt-4o-mini';
        const topic = (modal.querySelector('#s2v-topic')?.value || '').trim();
        const n     = parseInt(modal.querySelector('#s2v-sentences')?.value || '8', 10);
        if (!key)   { alert('Enter your OpenAI API key first.'); return; }
        if (!topic) { alert('Enter a topic first.'); return; }

        btnGenScript.disabled = true;
        btnGenScript.textContent = '✨ Generating…';
        log('Calling OpenAI to generate script for: ' + topic);
        try {
          const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
            body: JSON.stringify({
              model: aiModel,
              temperature: 0.7,
              messages: [{
                role: 'system',
                content: 'You write short video scripts. Output ONLY a YAML front-matter block followed by exactly the requested number of plain sentences — no headings, no lists, no markdown, no extra commentary. Format:\n---\ntitle: <title>\ntheme: shadow-cut\nvoice: auto\n---\nSentence one.\nSentence two.'
              }, {
                role: 'user',
                content: `Topic: ${topic}\nSentences: ${n}\n\nWrite the script now.`
              }],
            }),
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err?.error?.message || 'HTTP ' + resp.status);
          }
          const data = await resp.json();
          const text = data.choices?.[0]?.message?.content?.trim() || '';
          if (!text) throw new Error('OpenAI returned empty content');
          elText.value = text;
          log('✅ Script generated — review it then click Generate Video.');
        } catch (e) {
          log('❌ OpenAI error: ' + (e?.message || e));
        } finally {
          btnGenScript.disabled = false;
          btnGenScript.textContent = '✨ Generate Script';
        }
      });
    }

    btnSample.addEventListener('click', async () => {
      try {
        const r = await fetch('samples/script-to-video-sample.txt', { cache: 'no-cache' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        elText.value = await r.text();
      } catch (e) {
        alert('Could not load samples/script-to-video-sample.txt — make sure the dev server is running.\n\n' + e.message);
      }
    });

    btnGo.addEventListener('click', async () => {
      const script = elText.value.trim();
      if (!script) { alert('Please paste a script first.'); return; }
      if (!window.ScriptToVideo) { alert('Script-to-Video module did not load.'); return; }
      const voice = elVoice.value;
      const refFile = voice === 'clone' ? elRef.files?.[0] : null;
      if (voice === 'clone' && !refFile) { alert('Clone mode needs a reference audio file.'); return; }
      const sentenceCount = script.replace(/---[\s\S]*?---\s*/, '').split(/(?<=[.!?])\s+(?=[A-Z0-9"“'])/).filter(Boolean).length;
      if (elServerMode.value === 'local' && sentenceCount > 2) {
        const ok = confirm(`Local CPU OmniVoice is slow. This script has ${sentenceCount} sentences and may take several minutes. Continue?`);
        if (!ok) return;
      }

      btnGo.disabled = true;
      const oldLabel = btnGo.textContent;
      btnGo.textContent = 'Working…';
      elLog.textContent = 'Starting…';
      try {
        const result = await window.ScriptToVideo.run({
          scriptText: script,
          voice,
          refAudioFile: refFile,
          server: (elServer.value || '').trim() || null,
          onProgress: log,
        });
        log(`✅ Slide added with ${result.scenes.length} scenes (${result.totalDuration.toFixed(1)}s).`);
        toast('Script→Video: slide added — open the new last slide.');
        // Offer WAV download
        const a = document.createElement('a');
        a.href = result.audioBlobUrl;
        a.download = (result.slug || 'voiceover') + '.wav';
        a.textContent = '⬇ Download WAV';
        a.style.cssText = 'display:inline-block;margin-top:8px;color:#9bd;text-decoration:underline;';
        elLog.appendChild(document.createElement('br'));
        elLog.appendChild(a);
      } catch (e) {
        console.error('[script-to-video] failed', e);
        log('❌ ' + (e?.message || e));
      } finally {
        btnGo.disabled = false;
        btnGo.textContent = oldLabel;
      }
    });
  }

  /** Parse a template's markdown into element array + per-slide directives */
  function parseTemplateToElements(markdown) {
    // Remove front matter if any
    let body = markdown.replace(/^---[\s\S]*?---/, '').trim();
    // Remove leading slide separator
    body = body.replace(/^---\s*$/m, '').trim();

    // Extract per-slide directives from HTML comments
    const directives = {};
    const commentRe = /<!--\s*([\s\S]*?)\s*-->/g;
    let cm;
    while ((cm = commentRe.exec(body)) !== null) {
      cm[1].split('\n').forEach(line => {
        const kv = line.match(/^\s*([\w-]+)\s*:\s*(.+)\s*$/);
        if (kv) directives[kv[1].trim()] = kv[2].trim();
      });
    }

    // Strip HTML comments before parsing content
    const clean = body.replace(/<!--[\s\S]*?-->/g, '').trim();

    // Parse clean markdown into elements using VisualBuilder's parser
    const elements = window.VisualBuilder.parseMarkdownToElements(clean);

    return { elements, directives };
  }

  // ===== Presenter =====
  function setupPresenter() {
    document.getElementById('btn-present')?.addEventListener('click', () => {
      const parsedSlides = buildParsedSlides();
      if (parsedSlides.length === 0) return;
      window.Presenter.enter(parsedSlides, window.VisualBuilder.activeSlideIndex);
    });
  }

  // ===== Keyboard Shortcuts =====
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const presenterMode = document.getElementById('presenter-mode');
      if (presenterMode && !presenterMode.classList.contains('hidden')) {
        return;
      }

      // Don't capture when in text inputs
      const tag = e.target.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // F5 = Present
      if (e.key === 'F5') {
        e.preventDefault();
        document.getElementById('btn-present')?.click();
        return;
      }

      // Ctrl+S = Save / export markdown
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProject();
        toast('Saved');
        return;
      }

      if (isInput) return;

      // Delete/Backspace = delete selected element
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (window.VisualBuilder.selectedElementId) {
          e.preventDefault();
          window.VisualBuilder.deleteElement(window.VisualBuilder.selectedElementId);
        }
      }

      // Alt+Up / Alt+Down = move selected element
      if (e.altKey && e.key === 'ArrowUp') {
        if (window.VisualBuilder.selectedElementId) {
          e.preventDefault();
          window.VisualBuilder.moveElement(window.VisualBuilder.selectedElementId, -1);
        }
      }
      if (e.altKey && e.key === 'ArrowDown') {
        if (window.VisualBuilder.selectedElementId) {
          e.preventDefault();
          window.VisualBuilder.moveElement(window.VisualBuilder.selectedElementId, 1);
        }
      }

      // Arrow keys for slide navigation when no element selected
      if (!window.VisualBuilder.selectedElementId) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          document.getElementById('btn-prev-slide')?.click();
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          document.getElementById('btn-next-slide')?.click();
        }
      }

      // Ctrl+D = duplicate slide
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        window.VisualBuilder.duplicateSlide(window.VisualBuilder.activeSlideIndex);
      }

      // Escape = deselect
      if (e.key === 'Escape') {
        window.VisualBuilder.selectElement(null);
        renderPropertiesPanel();
      }
    });
  }

  // ===== Persistence =====
  function saveProject() {
    const data = {
      version: 2,
      activeSlideIndex: window.VisualBuilder.activeSlideIndex,
      slideModels: window.VisualBuilder.slideModels,
      globalDirectives: window.DirectivesPanel.getGlobalDirectives(),
      images: window.ImageManager.getImages(),
      mode: currentMode,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Auto-save failed:', e);
    }
  }

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || data.version !== 2) return;

      window.VisualBuilder.slideModels = data.slideModels || [];
      window.VisualBuilder.activeSlideIndex = data.activeSlideIndex || 0;
      window.DirectivesPanel.setGlobalDirectives(data.globalDirectives || {});
      window.ImageManager.setImages(data.images || []);

      // Restore element ID counters
      let maxElId = 0;
      let maxSlideId = 0;
      window.VisualBuilder.slideModels.forEach(s => {
        if (s.id > maxSlideId) maxSlideId = s.id;
        s.elements.forEach(e => { if (e.id > maxElId) maxElId = e.id; });
      });
      // Can't set counters directly, but they auto-increment so it's ok

      if (data.mode) setMode(data.mode);
    } catch (e) {
      console.warn('Load failed, starting fresh:', e);
    }
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveProject, AUTOSAVE_DELAY);
  }

  // ===== Full Refresh =====
  function fullRefresh() {
    window.VisualBuilder.renderCanvas();
    window.VisualBuilder.renderSlideThumbnails();
    renderPropertiesPanel();
    window.DirectivesPanel.renderGlobalDirectives();
    window.DirectivesPanel.renderSlideDirectives();
    updateSlideIndicator();

    if (currentMode === 'markdown' || currentMode === 'split') {
      syncVisualToMarkdown();
    }
  }

  // ===== Toast =====
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }
})();
