# MarkupPptHtml

This repository contains **two independent projects**:

1. **`index.html`** — A browser-based Markdown presentation builder
2. **`media/sick_animationX.py`** — A collection of standalone [Manim](https://www.manim.community/) animation scripts

---

## Project 1 — Markdown Presentation Builder (`index.html`)

**Create beautiful presentations from Markdown — export to HTML, PDF, PPTX, and PNG.**

A browser-based presentation builder that combines the simplicity of Marp-style Markdown authoring with rich slide generation (code highlighting, math, tables, images, multi-column layouts).

### Features

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

### Quick Start

```bash
# Option 1: Static serve
npx serve . -p 3000

# Option 2: Just open directly
# Open index.html in your browser
```

### Markdown Syntax

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

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Navigate slides (when not in editor) |
| `F5` / `Ctrl+Enter` | Enter presenter mode |
| `Escape` | Exit presenter mode |
| `G` | Toggle grid view |
| `Ctrl+E` | Toggle export menu |

### Architecture

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

### Dependencies (CDN)

- [marked](https://github.com/markedjs/marked) — Markdown parsing
- [highlight.js](https://highlightjs.org/) — Syntax highlighting
- [KaTeX](https://katex.org/) — Math rendering
- [PptxGenJS](https://github.com/gitbrent/PptxGenJS) — PPTX generation
- [html2canvas](https://html2canvas.hertzen.com/) — PNG export

### 🎤 Script → Video (OmniVoice + HyperFrames)

Toolbar button **🎤 Script→Video** opens a modal that runs a fully browser-side
pipeline inspired by:

- [k2-fsa/OmniVoice](https://huggingface.co/spaces/k2-fsa/OmniVoice) — TTS HF Space
- [pjecuacion/script-to-video-skill](https://github.com/pjecuacion/script-to-video-skill) — sentence → scene workflow

**Input file** — a `.txt` script with optional YAML front-matter:

```
---
title: My video title         # optional, derived from sentence 1 if omitted
theme: shadow-cut             # currently only shadow-cut is implemented
voice: auto                   # "auto" (random voice) or "clone"
ref_text: ""                  # transcript of reference audio (clone mode)
---
The opening hook sentence.
The second sentence flows in.
Did you know 76% of devs use AI?
Closing thought.
```

A bundled example lives at [samples/script-to-video-sample.txt](samples/script-to-video-sample.txt) — click **Load sample** in the modal.

**Pipeline** (all client-side):

| Step | What happens |
|---|---|
| 1. Parse | Front-matter + sentence split (regex on `.!?` boundaries). |
| 2. TTS | `@gradio/client` calls `k2-fsa/OmniVoice` → returns WAV. |
| 3. Measure | Decode WAV in-browser to read total duration. |
| 4. Time | Per-sentence start/duration estimated by character-count weight (skips Whisper transcription). |
| 5. Map | Each sentence → a scene type (title-card, kinetic-text, stat-reveal, callout, quote-card, list-reveal, comparison, flow-steps, outro-card) with no two consecutive scenes sharing a type. |
| 6. Compose | One 1920×1080 HyperFrame composition with `<audio>` data URL + GSAP timeline. |
| 7. Inject | A new slide is appended to the deck containing the HyperFrame element. |

**Outputs:**

- A new slide added to the current deck (auto-saved to localStorage).
- A direct **⬇ Download WAV** link in the modal log so you can keep the synthesized audio.
- The HyperFrame iframe plays audio + animation on click (browsers block autoplay with sound).

**Limits / notes:**

- Audio is embedded as a base64 data URL inside the slide's HyperFrame. Scripts longer than ~45 s may exceed the 5 MB localStorage cap — use **Download WAV** to keep the audio out-of-deck if needed.
- The OmniVoice HF Space runs on a free-tier ZeroGPU, so synthesis can take 10–60 s and may queue.
- Clone mode requires a reference audio file (≤30 s, clear voice) — upload it in the modal.

#### 🖥️ Run OmniVoice locally (free, offline, no rate limits)

OmniVoice is **Apache-2.0 open source** ([k2-fsa/OmniVoice](https://github.com/k2-fsa/OmniVoice)).
Run it on your own machine and the modal will hit `http://localhost:8001` instead of the HF Space.

**PowerShell / Windows launcher** (same idea as the Manim runner):

```powershell
.\run-omnivoice-local.ps1
# or
.\run-omnivoice-local.bat
```

That creates/uses a dedicated `.venv-omnivoice` environment, installs `torch`, `torchaudio`, and [requirements-omnivoice.txt](requirements-omnivoice.txt), then starts:

```
omnivoice-demo --ip 0.0.0.0 --port 8001
```

**Manual install:**

```powershell
py -3.12 -m venv .venv-omnivoice   # or py -3.11 / py -3.10
.\.venv-omnivoice\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements-omnivoice.txt
omnivoice-demo --ip 0.0.0.0 --port 8001
```

Python 3.12 is recommended on Windows. If Python 3.10-3.12 is not registered with `py.exe`, the launcher will use `uv` to install Python 3.12 automatically when available. NVIDIA GPU is faster; the launcher installs CPU PyTorch by default for compatibility.

Then in the modal: set **OmniVoice server** → **Local install (http://localhost:8001)** → Generate.

---

## Project 2 — Manim Animation Scripts (`media/`)

A series of standalone Python scripts that use the [Manim Community](https://www.manim.community/) library to produce mathematical/graphical animations.

### Scripts overview

| File | Scene class | What it demos |
|------|-------------|---------------|
| `sick_animation0.py` | `Test` | Circle, arc, text — Manim basics |
| `sick_animation1.py` | `demo1` | VGroup, dynamic arrows (`always_redraw`), transformations |
| `sick_animation2.py` | `demo2` | LaTeX (`Tex`), shapes, `Swap`, `Rotate` |
| `sick_animation3.py` | `valuetracker` | `ValueTracker` + `DecimalNumber` with live update |
| `sick_animation4.py` | `axes` | `Axes`, coordinate-to-point mapping (`c2p`) |
| `sick_animation5.py` | `axes2` | Labeled axes, dot tracking, group scaling |
| `sick_animation6.py` | `things` | `TransformMatchingShapes` text morphing |
| `sick_animation7.py` | `demonstration3` | Circles, rectangles, VGroup composition, big bang finish |

### Input files

No external input files are required. Each `.py` script is self-contained — all objects are defined programmatically inside the `construct()` method.

> `sick_animation7.py` uses the font **Sentient**. Make sure it is installed on the system, or replace the `font=` argument with another available font.

### Output location

Manim writes rendered frames and final videos under `media/`:

```
media/
├── videos/
│   └── sick_animationX/
│       └── 1080p60/                  # default quality
│           ├── <ClassName>.mp4       # final rendered video
│           └── partial_movie_files/  # intermediate section clips
├── images/
│   └── sick_animationX/              # static frame exports (if any)
└── Tex/                              # compiled LaTeX fragment cache
```

### Running the animations

**PowerShell (recommended):**
```powershell
# Renders the last script (sick_animation7.py) — edit the script path as needed
.\run_sick_animation.ps1
```

**Manual — render any script/scene:**
```powershell
# Activate the virtual environment first
.\.venv\Scripts\Activate.ps1

# Then run manim against the chosen file
python -m manim render media\sick_animation0.py Test
python -m manim render media\sick_animation1.py demo1
# ... etc.
```

**Quality flags:**
```powershell
python -m manim render -ql media\sick_animation0.py   # 480p (low, fast preview)
python -m manim render -qh media\sick_animation0.py   # 1080p (default)
python -m manim render -qk media\sick_animation0.py   # 4K
```

### Requirements

- Python 3.10+
- Manim Community (`pip install manim`) — see `requirements.txt`
- LaTeX distribution (e.g. MiKTeX) for `Tex`/`MathTex` scenes
- Virtual environment at `.venv/` (used by the run scripts)

## License

MIT
