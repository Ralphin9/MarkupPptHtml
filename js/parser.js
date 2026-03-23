/**
 * parser.js — Full Marpit-spec parser.
 *
 * Supports:
 * - Front-matter global directives (theme, paginate, header, footer, class, etc.)
 * - Local/spot directives via HTML comments and underscore prefix
 * - Marp image syntax: ![bg left 50%](url), ![w:200](url), filters
 * - Fragmented lists (* vs -)
 * - Math (KaTeX): $inline$ and $$block$$
 * - Emoji shortcodes
 * - Fit heading: # <!-- fit --> text
 * - Scoped style blocks
 */
window.SlideParser = (function () {
  'use strict';

  const SLIDE_SEPARATOR = /^---$/m;

  // ===== Emoji map =====
  const EMOJI_MAP = {
    rocket:'🚀',star:'⭐',fire:'🔥',heart:'❤️',check:'✅',x:'❌',
    warning:'⚠️',info:'ℹ️',bulb:'💡',tada:'🎉',thumbsup:'👍',
    thumbsdown:'👎',eyes:'👀',wave:'👋',sparkles:'✨',zap:'⚡',
    gear:'⚙️',lock:'🔒',key:'🔑',book:'📖',chart:'📊',link:'🔗',
    pin:'📌',memo:'📝','package':'📦',wrench:'🔧',hammer:'🔨',
    shield:'🛡️',globe:'🌍',sun:'☀️',moon:'🌙',cloud:'☁️',
    rainbow:'🌈',python:'🐍',js:'📜',coffee:'☕','100':'💯',
    muscle:'💪',brain:'🧠',computer:'💻',pizza:'🍕',
  };

  // ===== Front-matter =====
  function parseFrontMatter(raw) {
    const defaults = {
      marp: false, theme: 'default', paginate: true,
      header: '', footer: '', math: 'katex', class: '', style: '',
      headingDivider: false, size: '16:9',
    };
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return { directives: defaults, bodyStart: 0 };

    const block = match[1];
    const directives = { ...defaults };
    block.split('\n').forEach(line => {
      const kv = line.match(/^\s*([\w-]+)\s*:\s*(.+)\s*$/);
      if (kv) {
        let val = kv[2].trim();
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        directives[kv[1].trim()] = val;
      }
    });

    return { directives, bodyStart: match[0].length };
  }

  // ===== Spot directives (per-slide HTML comments + underscore) =====
  function parseSpotDirectives(raw) {
    const dirs = {};
    // <!-- key: value --> style
    const commentRe = /<!--\s*([\s\S]*?)\s*-->/g;
    let m;
    while ((m = commentRe.exec(raw)) !== null) {
      m[1].split('\n').forEach(line => {
        const kv = line.match(/^\s*([\w-]+)\s*:\s*(.+)\s*$/);
        if (kv) dirs[kv[1].trim()] = kv[2].trim();
      });
    }
    // _key: value style (Marpit scoped local directives)
    const underRe = /^_(\w[\w-]*)\s*:\s*(.+)$/gm;
    while ((m = underRe.exec(raw)) !== null) {
      dirs[m[1].trim()] = m[2].trim();
    }
    return dirs;
  }

  function stripDirectives(raw) {
    return raw
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^_\w[\w-]*\s*:\s*.+$/gm, '')
      .trim();
  }

  // ===== Marpit Image Syntax =====
  // ![alt w:200 h:100 bg left blur sepia](url)
  function parseImageSyntax(md) {
    const images = [];
    const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let m;
    while ((m = imgRe.exec(md)) !== null) {
      const alt = m[1];
      const url = m[2];
      const tokens = alt.split(/\s+/);
      const img = { url, alt: '', bg: false, position: '', sizing: '', filters: [], width: '', height: '' };

      tokens.forEach(tok => {
        const lower = tok.toLowerCase();
        if (lower === 'bg') img.bg = true;
        else if (['left','right','center','top','bottom'].includes(lower)) img.position = lower;
        else if (['contain','cover','fit','auto'].includes(lower)) img.sizing = lower;
        else if (['vertical'].includes(lower)) img.position = lower;
        else if (lower.match(/^w:\d/)) img.width = tok.slice(2);
        else if (lower.match(/^h:\d/)) img.height = tok.slice(2);
        else if (['blur','brightness','contrast','grayscale','invert','opacity','saturate','sepia','drop-shadow','hue-rotate'].includes(lower)) img.filters.push(lower);
        else if (lower.match(/^\d+%?$/) || lower.match(/^\d+px$/)) img.sizing = tok;
        else img.alt += (img.alt ? ' ' : '') + tok;
      });

      images.push(img);
    }
    return images;
  }

  // ===== Detect slide type =====
  function detectSlideType(html, rawMd) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const hasH1 = !!tmp.querySelector('h1');
    const hasPre = !!tmp.querySelector('pre');
    const hasTable = !!tmp.querySelector('table');
    const hasImg = !!tmp.querySelector('img');
    const hasList = !!tmp.querySelector('ul, ol');
    const childCount = tmp.children.length;

    if (rawMd.match(/^#+\s*<!--\s*fit\s*-->/m)) return 'fit';
    if (hasH1 && childCount <= 3 && !hasPre && !hasTable && !hasImg && !hasList) return 'title';
    if (hasPre && !hasTable) return 'code';
    if (hasTable) return 'table';
    if (hasImg && childCount <= 3) return 'image';
    return 'content';
  }

  // ===== Process math =====
  function processMath(html) {
    if (typeof katex === 'undefined') return html;
    // Block math
    html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
      try { return '<div class="katex-display">' + katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false }) + '</div>'; }
      catch { return '<div class="katex-display">' + expr + '</div>'; }
    });
    // Inline math
    html = html.replace(/\$([^\$\n]+?)\$/g, (_, expr) => {
      try { return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false }); }
      catch { return expr; }
    });
    return html;
  }

  // ===== Process emoji =====
  function processEmoji(html) {
    return html.replace(/:(\w+):/g, (match, name) => EMOJI_MAP[name] || match);
  }

  // ===== Fragmented lists: * items become class="fragment" =====
  function processFragments(html, rawMd) {
    // Check if any lines start with * (not **)
    if (!rawMd.match(/^\*\s+[^\*]/m)) return html;
    // Wrap <li> items that came from * in fragment class
    return html.replace(/<li>/g, '<li class="fragment">');
  }

  // ===== Handle bg images from Marpit syntax =====
  function extractBgImage(images) {
    const bg = images.find(i => i.bg);
    if (!bg) return null;
    return {
      url: bg.url,
      position: bg.position || 'cover',
      sizing: bg.sizing || '',
      filters: bg.filters || [],
    };
  }

  // ===== Main parse =====
  function parse(markdown) {
    if (!markdown || !markdown.trim()) return [];

    const { directives, bodyStart } = parseFrontMatter(markdown);
    const body = markdown.slice(bodyStart).trim();
    const rawSlides = body.split(SLIDE_SEPARATOR).filter(s => s.trim());

    // Configure marked
    if (typeof marked !== 'undefined') {
      marked.setOptions({ gfm: true, breaks: false, pedantic: false });
    }

    return rawSlides.map((raw, index) => {
      const spotDirs = parseSpotDirectives(raw);
      const cleanMd = stripDirectives(raw);
      const images = parseImageSyntax(cleanMd);
      const bgImage = extractBgImage(images);

      let html = '';
      if (typeof marked !== 'undefined') {
        html = marked.parse(cleanMd);
      } else {
        html = '<p>' + cleanMd.replace(/\n/g, '<br>') + '</p>';
      }

      html = processMath(html);
      html = processEmoji(html);
      html = processFragments(html, cleanMd);

      const type = detectSlideType(html, cleanMd);
      const slideDirectives = { ...directives, ...spotDirs };

      return {
        index, rawMarkdown: raw, cleanMarkdown: cleanMd,
        html, type, directives: slideDirectives,
        bgImage, images,
        theme: slideDirectives.theme || directives.theme || 'default',
      };
    });
  }

  // ===== generateMarkdown: slide data model → Markdown (reverse) =====
  function generateMarkdown(slideModels, globalDirectives) {
    const lines = [];

    // Front matter
    lines.push('---');
    lines.push('marp: true');
    if (globalDirectives.theme) lines.push('theme: ' + globalDirectives.theme);
    if (globalDirectives.paginate !== undefined) lines.push('paginate: ' + globalDirectives.paginate);
    if (globalDirectives.header) lines.push('header: ' + globalDirectives.header);
    if (globalDirectives.footer) lines.push('footer: ' + globalDirectives.footer);
    if (globalDirectives.math) lines.push('math: ' + globalDirectives.math);
    if (globalDirectives.style) lines.push('style: |\n  ' + globalDirectives.style.replace(/\n/g, '\n  '));
    lines.push('---');
    lines.push('');

    slideModels.forEach((slide, si) => {
      if (si > 0) {
        lines.push('');
        lines.push('---');
        lines.push('');
      }

      // Slide directives
      if (slide.directives) {
        const d = slide.directives;
        if (d.backgroundColor) lines.push('<!-- backgroundColor: ' + d.backgroundColor + ' -->');
        if (d.color) lines.push('<!-- color: ' + d.color + ' -->');
        if (d.backgroundImage) lines.push('<!-- backgroundImage: ' + d.backgroundImage + ' -->');
        if (d.backgroundSize) lines.push('<!-- backgroundSize: ' + d.backgroundSize + ' -->');
        if (d.class) lines.push('<!-- class: ' + d.class + ' -->');
        if (Object.keys(d).some(k => !['backgroundColor','color','backgroundImage','backgroundSize','class'].includes(k))) {
          // Other custom directives
          Object.keys(d).forEach(k => {
            if (!['backgroundColor','color','backgroundImage','backgroundSize','class'].includes(k)) {
              lines.push('<!-- ' + k + ': ' + d[k] + ' -->');
            }
          });
        }
      }

      // Elements
      if (slide.elements) {
        slide.elements.forEach(el => {
          lines.push('');
          lines.push(elementToMarkdown(el));
        });
      }
    });

    return lines.join('\n');
  }

  // ===== Element → Markdown =====
  function elementToMarkdown(el) {
    switch (el.type) {
      case 'heading': {
        const prefix = '#'.repeat(el.level || 1);
        const fit = el.fit ? ' <!-- fit -->' : '';
        return prefix + fit + ' ' + (el.content || 'Heading');
      }
      case 'fittext': {
        return '# <!-- fit --> ' + (el.content || 'BIG TEXT');
      }
      case 'text':
        return el.content || 'Text content';
      case 'bullets': {
        const items = (el.content || 'Item 1\nItem 2\nItem 3').split('\n');
        return items.map(i => '- ' + i.replace(/^[-*]\s*/, '')).join('\n');
      }
      case 'numbered': {
        const items = (el.content || 'First\nSecond\nThird').split('\n');
        return items.map((it, idx) => (idx + 1) + '. ' + it.replace(/^\d+\.\s*/, '')).join('\n');
      }
      case 'fragments': {
        const items = (el.content || 'Step 1\nStep 2\nStep 3').split('\n');
        return items.map(i => '* ' + i.replace(/^[*-]\s*/, '')).join('\n');
      }
      case 'code': {
        const lang = el.language || '';
        return '```' + lang + '\n' + (el.content || '// code') + '\n```';
      }
      case 'table': {
        return el.content || '| Col A | Col B |\n|-------|-------|\n| 1     | 2     |';
      }
      case 'image': {
        let alt = el.alt || '';
        if (el.bgMode) alt = el.bgMode + (el.sizing ? ' ' + el.sizing : '') + (alt ? ' ' + alt : '');
        if (el.width) alt += ' w:' + el.width;
        if (el.height) alt += ' h:' + el.height;
        if (el.filters && el.filters.length) alt += ' ' + el.filters.join(' ');
        return '![' + alt.trim() + '](' + (el.url || 'https://via.placeholder.com/600x300') + ')';
      }
      case 'quote':
        return (el.content || 'Quote text').split('\n').map(l => '> ' + l).join('\n');
      case 'math':
        return '$$\n' + (el.content || 'E = mc^2') + '\n$$';
      case 'columns': {
        const left = el.leftContent || '### Left\n- A\n- B';
        const right = el.rightContent || '### Right\n- X\n- Y';
        return '<div class="columns">\n<div class="col">\n\n' + left + '\n\n</div>\n<div class="col">\n\n' + right + '\n\n</div>\n</div>';
      }
      case 'hr':
        return '---';
      case 'imageCompare': {
        const left = el.leftImage || 'https://via.placeholder.com/400x250?text=Before';
        const right = el.rightImage || 'https://via.placeholder.com/400x250?text=After';
        const ll = el.leftLabel || 'Before';
        const rl = el.rightLabel || 'After';
        return '<div class="image-compare-container">\n<div class="ic-side"><img src="' + left + '" alt="' + ll + '"><span class="ic-label">' + ll + '</span></div>\n<div class="ic-arrow"><span class="ic-arrow-icon">⟷</span></div>\n<div class="ic-side"><img src="' + right + '" alt="' + rl + '"><span class="ic-label">' + rl + '</span></div>\n</div>';
      }
      case 'imageGrid': {
        const imgs = el.images || [];
        const items = imgs.map(img => '<div class="ig-item"><img src="' + (img.url || '') + '" alt="' + (img.caption || '') + '"><span class="ig-caption">' + (img.caption || '') + '</span></div>').join('\n');
        return '<div class="image-grid-container">\n' + items + '\n</div>';
      }
      default:
        return el.content || '';
    }
  }

  return { parse, parseFrontMatter, parseImageSyntax, generateMarkdown, elementToMarkdown };
})();
