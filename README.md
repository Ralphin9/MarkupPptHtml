# MarkupPptHtml

**Create beautiful presentations from Markdown — export to HTML, PDF, PPTX, and PNG.**

A browser-based presentation builder that combines the simplicity of Marp-style Markdown authoring with rich slide generation (code highlighting, math, tables, images, multi-column layouts).

## Features

- **Markdown Editor** with live slide preview
- **Marp-compatible directives** — `theme`, `backgroundColor`, `color`, `backgroundImage`, `class: invert`
- **Slide types**: Title, Content, Code, Table, Image, Split-layout, Two-column, Math, Quote, Fit-heading
- **5 built-in themes**: Default, Dark, Gaia, Uncover, Gradient
- **Syntax highlighting** (via Highlight.js) for 180+ languages
- **Math typesetting** (via KaTeX) — inline `$...$` and block `$$...$$`
- **Emoji shortcodes** — `:rocket:` → 🚀
- **Template gallery** — 18 ready-to-use slide templates
- **Export to**:
  - **HTML** — standalone interactive presentation with keyboard navigation
  - **PDF** — via browser print dialog
  - **PPTX** — real PowerPoint file (via PptxGenJS)
  - **PNG** — individual slide images (via html2canvas)
- **Presenter mode** — fullscreen with keyboard controls
- **Grid view** — thumbnail overview of all slides
- **Auto-save** — content persists in localStorage

## Quick Start

```bash
# Option 1: Static serve
npx serve . -p 3000

# Option 2: Just open directly
# Open index.html in your browser
```

## Markdown Syntax

Slides are separated by `---` (horizontal rule). Add a front-matter block at the top for global settings:

```markdown
---
marp: true
theme: default
paginate: true
---

# Title Slide

Subtitle here

---

## Content Slide

- Bullet points
- With **bold** and *italic*

---

## Code Block

```python
print("Hello!")
```

---

## Table

| Col A | Col B |
|-------|-------|
| 1     | 2     |
```

### Per-slide directives (HTML comments)

```markdown
<!-- backgroundColor: #000 -->
<!-- color: #fff -->
# Dark Slide
```

### Background images (Marp-style)

```markdown
![bg left](image.png)

- Text on the right side
```

### Math (KaTeX)

```markdown
Inline: $E = mc^2$

Block:
$$\int_0^\infty e^{-x} dx = 1$$
```

### Two columns

```html
<div class="columns">
<div class="col">

### Left
- A
- B

</div>
<div class="col">

### Right
- X
- Y

</div>
</div>
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Navigate slides (when not in editor) |
| `F5` / `Ctrl+Enter` | Enter presenter mode |
| `Escape` | Exit presenter mode |
| `G` | Toggle grid view |
| `Ctrl+E` | Toggle export menu |

## Architecture

```
MarkupPptHtml/
├── index.html          # Entry point
├── css/
│   ├── app.css         # Layout, editor, header, modals
│   ├── themes.css      # 5 slide theme definitions
│   └── slides.css      # Slide rendering styles
├── js/
│   ├── parser.js       # Markdown → HTML → slide objects
│   ├── renderer.js     # Slide objects → DOM rendering
│   ├── templates.js    # Pre-built slide templates
│   ├── exporter.js     # HTML/PDF/PPTX/PNG export
│   ├── presenter.js    # Fullscreen presenter mode
│   └── app.js          # Main controller
└── README.md
```

## Dependencies (CDN)

- [marked](https://github.com/markedjs/marked) — Markdown parsing
- [highlight.js](https://highlightjs.org/) — Syntax highlighting
- [KaTeX](https://katex.org/) — Math rendering
- [PptxGenJS](https://github.com/gitbrent/PptxGenJS) — PPTX generation
- [html2canvas](https://html2canvas.hertzen.com/) — PNG export

## License

MIT
