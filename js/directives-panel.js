/**
 * directives-panel.js — Controller for the Marp/Marpit directives UI panel.
 *
 * Reads directive values from the right-panel form controls, applies them
 * to the current slide model, and renders the current state back into the UI.
 */
window.DirectivesPanel = (function () {
  'use strict';

  let onChangeCallback = null;
  let globalDirectives = {
    theme: 'default',
    paginate: true,
    header: '',
    footer: '',
    class: '',
    logo: '',
    backgroundColor: '',
    color: '',
  };

  // ===== Init =====
  function init(onChange) {
    onChangeCallback = onChange;
    bindGlobalControls();
    bindSlideControls();
    bindStyleEditor();
  }

  // ===== Global Directives =====
  function bindGlobalControls() {
    const themeSelect = document.getElementById('dir-theme');
    const paginate    = document.getElementById('dir-paginate');
    const headerInput = document.getElementById('dir-header');
    const footerInput = document.getElementById('dir-footer');
    const globalClass = document.getElementById('dir-global-class');

    if (themeSelect) themeSelect.addEventListener('change', () => { globalDirectives.theme = themeSelect.value; notifyChange(); });
    if (paginate)   paginate.addEventListener('change', () => { globalDirectives.paginate = paginate.checked; notifyChange(); });
    if (headerInput) headerInput.addEventListener('input', () => { globalDirectives.header = headerInput.value; notifyChange(); });
    if (footerInput) footerInput.addEventListener('input', () => { globalDirectives.footer = footerInput.value; notifyChange(); });
    if (globalClass) globalClass.addEventListener('input', () => { globalDirectives.class = globalClass.value; notifyChange(); });

    const logoInput = document.getElementById('dir-logo');
    if (logoInput) {
      logoInput.addEventListener('input', () => {
        globalDirectives.logo = logoInput.value.trim();
        const preview = document.getElementById('logo-preview');
        if (preview) {
          preview.innerHTML = globalDirectives.logo
            ? '<img src="' + encodeURI(globalDirectives.logo) + '" style="max-height:32px;border-radius:3px" onerror="this.style.display=\'none\'">'
            : '';
        }
        notifyChange();
      });
    }
  }

  // ===== Per-slide Directives =====
  function bindSlideControls() {
    const ids = [
      'dir-bg-color', 'dir-bg-color-text', 'dir-text-color', 'dir-text-color-text',
      'dir-bg-image', 'dir-bg-size', 'dir-class', 'dir-slide-header', 'dir-slide-footer',
    ];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      const eventType = (el.type === 'checkbox') ? 'change' : 'input';

      el.addEventListener(eventType, () => {
        applySlideDirectives();
        notifyChange();
      });
    });

    // Color picker sync
    setupColorSync('dir-bg-color-text', 'dir-bg-color');
    setupColorSync('dir-text-color-text', 'dir-text-color');
  }

  function setupColorSync(textId, pickerId) {
    const text = document.getElementById(textId);
    const picker = document.getElementById(pickerId);
    if (!text || !picker) return;

    picker.addEventListener('input', () => {
      text.value = picker.value;
      text.dispatchEvent(new Event('input'));
    });
    text.addEventListener('input', () => {
      if (text.value.match(/^#[0-9a-f]{3,8}$/i)) {
        picker.value = text.value;
      }
    });
  }

  function applySlideDirectives() {
    const slide = window.VisualBuilder.getActiveSlide();
    if (!slide) return;

    const dirs = slide.directives || {};

    const bgColor  = document.getElementById('dir-bg-color-text');
    const txtColor = document.getElementById('dir-text-color-text');
    const bgImage  = document.getElementById('dir-bg-image');
    const bgSize   = document.getElementById('dir-bg-size');
    const cls      = document.getElementById('dir-class');
    const hdr      = document.getElementById('dir-slide-header');
    const ftr      = document.getElementById('dir-slide-footer');

    if (bgColor)  dirs.backgroundColor = bgColor.value.trim();
    if (txtColor) dirs.color = txtColor.value.trim();
    if (bgImage)  dirs.backgroundImage = bgImage.value.trim();
    if (bgSize)   dirs.backgroundSize = bgSize.value.trim();
    if (cls)      dirs.class = cls.value.trim();
    if (hdr)      dirs.header = hdr.value.trim();
    if (ftr)      dirs.footer = ftr.value.trim();

    slide.directives = dirs;
  }

  // ===== Custom Style Editor =====
  function bindStyleEditor() {
    const area = document.getElementById('custom-css-editor');
    if (!area) return;

    area.addEventListener('input', () => {
      globalDirectives.customStyle = area.value;
      notifyChange();
    });
  }

  // ===== Render panel from model =====
  function renderGlobalDirectives() {
    setValue('dir-theme', globalDirectives.theme || 'default');
    setChecked('dir-paginate', globalDirectives.paginate !== false);
    setValue('dir-header', globalDirectives.header || '');
    setValue('dir-footer', globalDirectives.footer || '');
    setValue('dir-global-class', globalDirectives.class || '');
    setValue('dir-logo', globalDirectives.logo || '');
    setValue('custom-css-editor', globalDirectives.customStyle || '');
  }

  function renderSlideDirectives() {
    const slide = window.VisualBuilder.getActiveSlide();
    const dirs = slide?.directives || {};

    setValue('dir-bg-color-text', dirs.backgroundColor || '');
    setValue('dir-text-color-text', dirs.color || '');
    setValue('dir-bg-image', dirs.backgroundImage || '');
    setValue('dir-bg-size', dirs.backgroundSize || '');
    setValue('dir-class', dirs.class || '');
    setValue('dir-slide-header', dirs.header || '');
    setValue('dir-slide-footer', dirs.footer || '');

    // Sync pickers
    const bgPicker = document.getElementById('dir-bg-color');
    const txtPicker = document.getElementById('dir-text-color');
    if (bgPicker && dirs.backgroundColor?.match(/^#/)) bgPicker.value = dirs.backgroundColor;
    if (txtPicker && dirs.color?.match(/^#/)) txtPicker.value = dirs.color;
  }

  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function setChecked(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  }

  // ===== Getters / Setters =====
  function getGlobalDirectives() {
    return { ...globalDirectives };
  }

  function setGlobalDirectives(dirs) {
    globalDirectives = { ...globalDirectives, ...dirs };
    renderGlobalDirectives();
  }

  function notifyChange() {
    if (typeof onChangeCallback === 'function') onChangeCallback();
  }

  return {
    init, renderGlobalDirectives, renderSlideDirectives,
    getGlobalDirectives, setGlobalDirectives,
  };
})();
