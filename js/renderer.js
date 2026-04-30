/**
 * renderer.js — Renders parsed slides into the preview DOM.
 *
 * Combines the Marp approach (theme classes, directives) with the Python
 * approach (type-specific rendering: title, code, table, image, content).
 * Includes terminal-style code blocks, syntax highlighting, and branding.
 */
window.SlideRenderer = (function () {
  'use strict';

  /** Build the theme class name */
  function themeClass(theme) {
    return 'slide-theme-' + (theme || 'default');
  }

  /** Build inline styles from per-slide directives */
  function buildInlineStyles(dirs) {
    const styles = [];
    if (dirs.backgroundColor) styles.push('background:' + dirs.backgroundColor);
    if (dirs.color) styles.push('color:' + dirs.color);
    if (dirs.backgroundImage) {
      styles.push('background-image:url(' + dirs.backgroundImage + ')');
      styles.push('background-size:cover');
      styles.push('background-position:center');
    }
    return styles.join(';');
  }

  /** Add syntax highlighting to code blocks */
  function highlightCode(container) {
    if (typeof hljs === 'undefined') return;
    container.querySelectorAll('pre code').forEach(block => {
      hljs.highlightElement(block);
      // Add language badge
      const lang = block.className.match(/language-(\w+)/);
      if (lang) {
        block.parentElement.setAttribute('data-lang', lang[1]);
      }
    });
  }

  /** Detect if theme uses a gradient background */
  function isGradientTheme(theme) {
    return theme === 'gradient';
  }

  /** Build header/footer/logo overlays HTML */
  function buildOverlaysHTML(slide, slideNumber, totalSlides) {
    let overlays = '';
    if (slide.header) {
      overlays += `<div class="slide-header-overlay">${renderInlineMarkdown(slide.header)}</div>`;
    }
    if (slide.footer) {
      overlays += `<div class="slide-footer-overlay">${renderInlineMarkdown(slide.footer)}</div>`;
    }
    if (slide.logo) {
      overlays += `<img class="slide-logo-overlay" src="${encodeURI(slide.logo)}" alt="logo" onerror="this.style.display='none'">`;
    }
    if (slide.paginate !== false) {
      overlays += `<span class="slide-number">${slideNumber} / ${totalSlides}</span>`;
    }
    overlays += `<div class="slide-progress" style="width:${(slideNumber / totalSlides) * 100}%"></div>`;
    return overlays;
  }

  /** Escape HTML for safe text rendering */
  function escapeHTML(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Render inline markdown used by header/footer directives. */
  function renderInlineMarkdown(text) {
    const src = String(text ?? '').trim();
    if (!src) return '';
    if (typeof marked !== 'undefined' && typeof marked.parseInline === 'function') {
      return marked.parseInline(src);
    }
    return escapeHTML(src);
  }

  /** Render a single slide to HTML string */
  function renderSlideHTML(slide, slideNumber, totalSlides) {
    const theme = slide.theme;
    const dirs = slide.directives || {};
    const inlineStyle = buildInlineStyles(dirs);
    const bgClass = isGradientTheme(theme) ? 'bg-gradient' : 'bg-solid';
    const directiveClasses = String(dirs.class || '').split(/\s+/).filter(Boolean).join(' ');

    let typeClass = 'slide-type-' + slide.type;
    let extraClass = '';

    // Check for background image
    if (slide.bgImage) {
      if (slide.bgImage.position === 'left' || slide.bgImage.position === 'right') {
        typeClass = '';
        extraClass = 'split-left';
      } else {
        extraClass = 'bg-image';
      }
    }

    // Keep existing visual behavior for invert/lead presets.
    if (directiveClasses.split(/\s+/).some(c => c === 'invert' || c === 'lead')) {
      extraClass += ' slide-invert';
    }

    let content = slide.html;
    const overlays = buildOverlaysHTML(slide, slideNumber, totalSlides);

    // For split-layout (bg left/right)
    if (slide.bgImage && (slide.bgImage.position === 'left' || slide.bgImage.position === 'right')) {
      const imgSide = `<img class="split-image" src="${encodeURI(slide.bgImage.url)}" alt="slide image">`;
      const textSide = `<div class="split-content">${slide.html}</div>`;
      content = slide.bgImage.position === 'left'
        ? imgSide + textSide
        : textSide + imgSide;
    }

    // For bg-image (cover/contain/fit)
    if (slide.bgImage && !['left', 'right'].includes(slide.bgImage.position)) {
      const position = (slide.bgImage.position || 'cover').toLowerCase();
      const sizing = (slide.bgImage.sizing || '').toLowerCase();
      let bgSize = 'cover';
      if (sizing) {
        if (sizing === 'fit') bgSize = '100% 100%';
        else if (['cover', 'contain', 'auto'].includes(sizing) || sizing.includes('%') || sizing.includes('px')) bgSize = sizing;
      } else if (position === 'contain') {
        bgSize = 'contain';
      } else if (position === 'fit') {
        bgSize = '100% 100%';
      }

      const bgPos = position === 'left' ? 'left center' : position === 'right' ? 'right center' : 'center';
      const existingStyle = inlineStyle ? inlineStyle + ';' : '';
      return `<div class="slide-frame ${themeClass(theme)} ${bgClass} ${typeClass} ${directiveClasses} bg-image ${extraClass}"
        style="${existingStyle}background-image:url('${encodeURI(slide.bgImage.url)}');background-size:${bgSize};background-position:${bgPos};background-repeat:no-repeat;">
        ${content}
        ${overlays}
      </div>`;
    }

    return `<div class="slide-frame ${themeClass(theme)} ${bgClass} ${typeClass} ${directiveClasses} ${extraClass}"
      style="${inlineStyle}">
      ${content}
      ${overlays}
    </div>`;
  }

  /**
   * Re-execute <script> tags inside a freshly-injected innerHTML region.
   *
   * Browsers do NOT execute <script> nodes that are inserted via .innerHTML.
   * This helper replaces each inert <script> with a freshly-created one so
   * inline JS in `.el-html` blocks (e.g. GSAP timelines authored as raw
   * components) actually runs in the live preview / presenter.
   *
   * Hyperframe elements are rendered as <iframe srcdoc="..."> so they get
   * full, sandboxed execution automatically and don't need this pass.
   */
  function activateScripts(root) {
    if (!root) return;
    const scripts = root.querySelectorAll('.el-html script');
    scripts.forEach(old => {
      const s = document.createElement('script');
      // Copy attributes (src, type, async, defer, etc.)
      for (const attr of old.attributes) s.setAttribute(attr.name, attr.value);
      if (!old.src) s.textContent = old.textContent;
      old.replaceWith(s);
    });
  }

  /** Render one slide into a container element */
  function renderSlide(container, slide, slideNumber, totalSlides) {
    container.innerHTML = renderSlideHTML(slide, slideNumber, totalSlides);
    highlightCode(container);
    activateScripts(container);
  }

  /** Render the grid view */
  function renderGrid(gridContainer, slides) {
    gridContainer.innerHTML = '';
    slides.forEach((slide, i) => {
      const card = document.createElement('div');
      card.className = 'grid-slide';
      card.dataset.index = i;

      // Create a mini-slide inside
      const mini = document.createElement('div');
      mini.style.cssText = 'transform:scale(0.25);transform-origin:top left;width:960px;height:540px;pointer-events:none;';
      mini.innerHTML = renderSlideHTML(slide, i + 1, slides.length);
      highlightCode(mini);

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'width:100%;height:100%;overflow:hidden;position:relative;';
      wrapper.appendChild(mini);

      const num = document.createElement('span');
      num.className = 'grid-slide-number';
      num.textContent = i + 1;

      card.appendChild(wrapper);
      card.appendChild(num);
      gridContainer.appendChild(card);
    });
  }

  return { renderSlide, renderGrid, renderSlideHTML, highlightCode, activateScripts };
})();
