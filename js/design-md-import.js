/**
 * design-md-import.js — Import a DESIGN.md (Google Labs design-token spec) and
 * convert its YAML front-matter to a Marp theme injected via the global
 * `style:` directive.
 *
 * Spec: https://github.com/google-labs-code/design.md
 *
 * Supports the alpha-version token sections we can meaningfully map onto a
 * slide deck: colors, typography, rounded, spacing. Token references like
 * `{colors.primary}` are resolved against the same document. Unknown sections
 * are preserved (per spec) but ignored for theme generation.
 */
window.DesignMdImport = (function () {
  'use strict';

  // ---------- Tiny YAML subset parser ----------------------------------
  // DESIGN.md front-matter is a strict, indentation-based subset of YAML
  // (key/value, nested maps, quoted strings). A full js-yaml dependency is
  // overkill; the parser below handles exactly the shapes the spec defines.
  function parseYaml(text) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const root = {};
    const stack = [{ indent: -1, node: root }];

    const stripQuotes = (v) => {
      const s = v.trim();
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
      }
      return s;
    };

    for (let raw of lines) {
      // Strip comments (only when '#' is preceded by whitespace or starts the line)
      raw = raw.replace(/\s+#.*$/, '');
      if (!raw.trim()) continue;

      const indentMatch = raw.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      const line = raw.slice(indent);

      // Pop stack until we find the parent at lower indent
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
      const parent = stack[stack.length - 1].node;

      const m = line.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2];

      if (val === '' || val === null) {
        // Open new map
        const child = {};
        parent[key] = child;
        stack.push({ indent, node: child });
      } else {
        parent[key] = stripQuotes(val);
      }
    }
    return root;
  }

  // ---------- Front-matter extraction ---------------------------------
  function splitFrontMatter(md) {
    const text = String(md || '');
    const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n([\s\S]*))?$/);
    if (!m) return { tokens: {}, body: text };
    return { tokens: parseYaml(m[1]), body: m[2] || '' };
  }

  // ---------- Token reference resolution ------------------------------
  function resolveRef(value, root) {
    if (typeof value !== 'string') return value;
    const m = value.match(/^\{([\w.\-]+)\}$/);
    if (!m) return value;
    const path = m[1].split('.');
    let cur = root;
    for (const seg of path) {
      if (cur && typeof cur === 'object' && seg in cur) cur = cur[seg];
      else return value; // leave unresolved literally
    }
    return typeof cur === 'string' ? cur : value;
  }

  function deepResolve(node, root) {
    if (typeof node === 'string') return resolveRef(node, root);
    if (!node || typeof node !== 'object') return node;
    const out = Array.isArray(node) ? [] : {};
    for (const k of Object.keys(node)) out[k] = deepResolve(node[k], root);
    return out;
  }

  // ---------- CSS generation ------------------------------------------
  /** Map DESIGN.md tokens to a Marp theme. Outputs CSS suitable for the
   *  global `style:` directive (root `:root` vars + `section` overrides).
   *  Spec: https://github.com/google-labs-code/design.md/blob/main/docs/spec.md */
  function tokensToCss(rawTokens) {
    const tokens = deepResolve(rawTokens, rawTokens);
    const lines = [];
    const name = tokens.name || 'design-md';
    const warnings = [];

    if (tokens.version && tokens.version !== 'alpha') {
      warnings.push('Unknown DESIGN.md version "' + tokens.version + '" — parsing as alpha.');
    }

    lines.push('/* Generated from DESIGN.md (' + name + ') */');
    lines.push(':root {');

    // ---- Colors --------------------------------------------------------
    if (tokens.colors && typeof tokens.colors === 'object') {
      for (const [k, v] of Object.entries(tokens.colors)) {
        if (typeof v !== 'string') continue;
        if (!/^#[0-9a-fA-F]{3,8}$/.test(v)) {
          warnings.push('colors.' + k + ' is not a valid #hex color: ' + v);
        }
        lines.push('  --color-' + k + ': ' + v + ';');
      }
    }
    // ---- Rounded -------------------------------------------------------
    if (tokens.rounded && typeof tokens.rounded === 'object') {
      for (const [k, v] of Object.entries(tokens.rounded)) {
        lines.push('  --rounded-' + k + ': ' + v + ';');
      }
    }
    // ---- Spacing -------------------------------------------------------
    if (tokens.spacing && typeof tokens.spacing === 'object') {
      for (const [k, v] of Object.entries(tokens.spacing)) {
        const val = /^[0-9.]+$/.test(String(v)) ? v + 'px' : v;
        lines.push('  --space-' + k + ': ' + val + ';');
      }
    }
    lines.push('}');
    lines.push('');

    // Recommended-token-aware role assignment (spec § Recommended Token Names).
    const c = tokens.colors || {};
    const surface  = c.surface || c.neutral || c.background || '#ffffff';
    const onSurf   = c['on-surface'] || c.primary || c.text || '#1a1c1e';
    const heading  = c.primary || onSurf;
    const accent   = c.tertiary || c.accent || c.secondary || '#0366d6';
    const error    = c.error || '#d32f2f';

    // ---- Slide base ---------------------------------------------------
    lines.push('section {');
    lines.push('  background: ' + surface + ';');
    lines.push('  color: ' + onSurf + ';');
    if (tokens.spacing && tokens.spacing.lg) lines.push('  padding: ' + tokens.spacing.lg + ';');
    const body = (tokens.typography && (tokens.typography['body-md'] || tokens.typography['body-lg'] || tokens.typography.body)) || null;
    if (body) appendTypography(lines, body, '  ');
    lines.push('}');

    // ---- Headings -----------------------------------------------------
    const headingMap = {
      'h1': tokens.typography && (tokens.typography.h1 || tokens.typography['headline-lg'] || tokens.typography['headline-display']),
      'h2': tokens.typography && (tokens.typography.h2 || tokens.typography['headline-md']),
      'h3': tokens.typography && (tokens.typography.h3 || tokens.typography['headline-sm'] || tokens.typography['title-lg']),
    };
    for (const [sel, t] of Object.entries(headingMap)) {
      if (!t) continue;
      lines.push('section ' + sel + ' {');
      lines.push('  color: ' + heading + ';');
      appendTypography(lines, t, '  ');
      lines.push('}');
    }

    // ---- Label / caption typography (mapped to <small> + figcaption) --
    const label = tokens.typography && (tokens.typography['label-md'] || tokens.typography['label-caps'] || tokens.typography['label-sm']);
    if (label) {
      lines.push('section small, section figcaption {');
      lines.push('  color: ' + (c.secondary || onSurf) + ';');
      appendTypography(lines, label, '  ');
      lines.push('}');
    }

    // ---- Accent-driven elements ---------------------------------------
    lines.push('section a { color: ' + accent + '; }');
    lines.push('section ul li::marker { color: ' + accent + '; }');
    lines.push('section blockquote { border-left: 4px solid ' + accent + '; padding-left: 12px; color: ' + (c.secondary || onSurf) + '; }');
    lines.push('section table th { background: ' + accent + '; color: ' + surface + '; }');
    lines.push('section .error, section [data-error] { color: ' + error + '; }');

    if (tokens.rounded && (tokens.rounded.md || tokens.rounded.sm)) {
      const r = tokens.rounded.md || tokens.rounded.sm;
      lines.push('section pre, section code, section img { border-radius: ' + r + '; }');
    }

    // ---- Components (spec § Components) -------------------------------
    // Each component becomes a `.<name>` class that authors can use in
    // raw HTML or via Marp's directive syntax.
    if (tokens.components && typeof tokens.components === 'object') {
      lines.push('');
      lines.push('/* Components */');
      for (const [compName, props] of Object.entries(tokens.components)) {
        if (!props || typeof props !== 'object') continue;
        lines.push('section .' + compName + ', section [data-component="' + compName + '"] {');
        if (props.backgroundColor) lines.push('  background-color: ' + props.backgroundColor + ';');
        if (props.textColor)       lines.push('  color: ' + props.textColor + ';');
        if (props.rounded)         lines.push('  border-radius: ' + props.rounded + ';');
        if (props.padding)         lines.push('  padding: ' + props.padding + ';');
        if (props.size)            lines.push('  width: ' + props.size + '; height: ' + props.size + ';');
        if (props.height)          lines.push('  height: ' + props.height + ';');
        if (props.width)           lines.push('  width: ' + props.width + ';');
        if (props.typography && typeof props.typography === 'object') {
          appendTypography(lines, props.typography, '  ');
        }
        // Warn on unknown component properties (spec: accept with warning).
        const validProps = new Set(['backgroundColor', 'textColor', 'typography', 'rounded', 'padding', 'size', 'height', 'width']);
        for (const k of Object.keys(props)) {
          if (!validProps.has(k)) warnings.push('Component "' + compName + '" has unknown property "' + k + '" (accepted but ignored).');
        }
        lines.push('}');
      }
    }

    return { css: lines.join('\n'), warnings };
  }

  /** Emit Typography token properties as CSS declarations. */
  function appendTypography(lines, t, indent) {
    if (!t || typeof t !== 'object') return;
    if (t.fontFamily)     lines.push(indent + "font-family: '" + t.fontFamily + "', system-ui, sans-serif;");
    if (t.fontSize)       lines.push(indent + 'font-size: ' + t.fontSize + ';');
    if (t.fontWeight !== undefined && t.fontWeight !== '') lines.push(indent + 'font-weight: ' + t.fontWeight + ';');
    if (t.lineHeight !== undefined && t.lineHeight !== '') lines.push(indent + 'line-height: ' + t.lineHeight + ';');
    if (t.letterSpacing)  lines.push(indent + 'letter-spacing: ' + t.letterSpacing + ';');
    if (t.fontFeature)    lines.push(indent + 'font-feature-settings: ' + t.fontFeature + ';');
    if (t.fontVariation)  lines.push(indent + 'font-variation-settings: ' + t.fontVariation + ';');
  }

  // ---------- Public API ---------------------------------------------
  /** Parse a raw DESIGN.md string. Returns { tokens, css, name, summary, warnings }. */
  function importString(md) {
    const { tokens } = splitFrontMatter(md);
    const { css, warnings } = tokensToCss(tokens);
    const counts = {
      colors: tokens.colors ? Object.keys(tokens.colors).length : 0,
      typography: tokens.typography ? Object.keys(tokens.typography).length : 0,
      rounded: tokens.rounded ? Object.keys(tokens.rounded).length : 0,
      spacing: tokens.spacing ? Object.keys(tokens.spacing).length : 0,
      components: tokens.components ? Object.keys(tokens.components).length : 0,
    };
    return {
      tokens,
      css,
      name: tokens.name || 'design-md',
      summary: counts,
      warnings,
    };
  }

  return { importString, tokensToCss, parseYaml, splitFrontMatter };
})();
