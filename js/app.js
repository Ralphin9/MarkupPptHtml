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
    setupPresenter();
    setupThemeSelect();
    setupCustomCSS();
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

    const visualCanvas = document.getElementById('visual-canvas-wrapper');
    const markdownPanel = document.getElementById('markdown-panel');
    const visualToolbar = document.getElementById('visual-toolbar-area');

    if (mode === 'visual') {
      visualCanvas.classList.remove('hidden');
      markdownPanel.classList.add('hidden');
      visualToolbar.classList.remove('hidden');
      visualCanvas.classList.remove('split-mode');
      markdownPanel.classList.remove('split-mode');
    } else if (mode === 'markdown') {
      visualCanvas.classList.add('hidden');
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

    // Image Grid fields
    const gridUrls = document.getElementById('prop-grid-urls');
    const gridCaptions = document.getElementById('prop-grid-captions');
    const syncGrid = () => {
      const elId = window.VisualBuilder.selectedElementId;
      if (!elId) return;
      const urls = (gridUrls?.value || '').split('\n').filter(u => u.trim());
      const caps = (gridCaptions?.value || '').split('\n');
      const images = urls.map((url, i) => ({ url: url.trim(), caption: (caps[i] || '').trim() }));
      window.VisualBuilder.updateElement(elId, { images });
    };
    if (gridUrls) gridUrls.addEventListener('input', syncGrid);
    if (gridCaptions) gridCaptions.addEventListener('input', syncGrid);

    // Drag-and-drop zones for image compare (left & right)
    setupImageDropTarget('drop-compare-left', 'prop-compare-left', 'preview-compare-left');
    setupImageDropTarget('drop-compare-right', 'prop-compare-right', 'preview-compare-right');

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
    const urlsArea = document.getElementById('prop-grid-urls');
    if (!zone || !urlsArea) return;

    zone.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; zone.classList.add('drag-hover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-hover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-hover');

      const addUrl = (url) => {
        const current = urlsArea.value.trim();
        urlsArea.value = current ? current + '\n' + url : url;
        urlsArea.dispatchEvent(new Event('input'));
        refreshGridPreviews();
      };

      const url = e.dataTransfer.getData('image-url');
      if (url) {
        addUrl(url);
      } else if (e.dataTransfer.files?.length) {
        Array.from(e.dataTransfer.files).forEach(file => {
          if (!file.type.startsWith('image/')) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            window.ImageManager.addImageDirect(file.name, ev.target.result);
            addUrl(ev.target.result);
          };
          reader.readAsDataURL(file);
        });
      }
    });
  }

  function refreshGridPreviews() {
    const container = document.getElementById('grid-drop-previews');
    const urlsArea = document.getElementById('prop-grid-urls');
    if (!container || !urlsArea) return;
    const urls = urlsArea.value.split('\n').filter(u => u.trim());
    container.innerHTML = urls.map(u => '<img src="' + encodeURI(u.trim()) + '" alt="">').join('');
    const zone = document.getElementById('drop-grid-images');
    if (zone) zone.classList.toggle('has-image', urls.length > 0);
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
    if (el.type === 'imageGrid') {
      const imgs = el.images || [];
      setValue('prop-grid-urls', imgs.map(i => i.url).join('\n'));
      setValue('prop-grid-captions', imgs.map(i => i.caption || '').join('\n'));
      refreshGridPreviews();
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

  // ===== Theme Select (header) =====
  function setupThemeSelect() {
    const sel = document.getElementById('theme-select');
    if (!sel) return;
    sel.addEventListener('change', () => {
      const theme = sel.value;
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
        sel.value = dirTheme.value;
        window.DirectivesPanel.setGlobalDirectives({ theme: dirTheme.value });
        onDirectivesChange();
      });
    }
  }

  // ===== Custom CSS =====
  function setupCustomCSS() {
    document.getElementById('btn-apply-css')?.addEventListener('click', () => {
      const css = document.getElementById('custom-css-editor')?.value;
      if (!css) return;
      let existing = document.getElementById('custom-user-css');
      if (!existing) {
        existing = document.createElement('style');
        existing.id = 'custom-user-css';
        document.head.appendChild(existing);
      }
      existing.textContent = css;
      toast('Custom CSS applied');
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
          };
        }
      });

      return {
        type,
        html,
        theme,
        directives: { ...slide.directives },
        bgImage,
      };
    });
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
            const elements = window.VisualBuilder.constructor === Object ? [] :
              parseTemplateToElements(tpl.markdown);
            elements.forEach(el => {
              slide.elements.push(el);
            });
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

  /** Parse a template's markdown into element array */
  function parseTemplateToElements(markdown) {
    // Remove front matter if any
    let body = markdown.replace(/^---[\s\S]*?---/, '').trim();
    // Remove leading slide separator
    body = body.replace(/^---\s*$/m, '').trim();
    // Use the visual builder's markdown parser
    const tempSlides = [];
    const raw = body.split(/^---$/m);
    const elements = [];
    raw.forEach(chunk => {
      const parsed = window.VisualBuilder.constructor; // We'll use the internal parser
      // Actually, re-use loadFromMarkdown temporarily
    });
    // Simpler approach: use the parser from visual builder
    // Create a temp markdown and parse
    const tempMd = '---\nmarp: true\ntheme: default\n---\n' + body;
    const savedModels = window.VisualBuilder.slideModels;
    const savedIdx = window.VisualBuilder.activeSlideIndex;
    const savedSel = window.VisualBuilder.selectedElementId;

    window.VisualBuilder.loadFromMarkdown(tempMd);
    const newElements = window.VisualBuilder.slideModels.length > 0
      ? window.VisualBuilder.slideModels[0].elements
      : [];

    // Restore
    window.VisualBuilder.slideModels = savedModels;
    window.VisualBuilder.activeSlideIndex = savedIdx;
    window.VisualBuilder.selectedElementId = savedSel;

    return newElements;
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
