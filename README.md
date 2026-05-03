# MarkupPptHtml

This repository contains **two independent projects**:

1. **`index.html`** — A browser-based Markdown presentation builder with Script→Video and HyperFrames export
2. **`media/sick_animationX.py`** — A collection of standalone [Manim](https://www.manim.community/) animation scripts

### Environment compatibility

| Feature | Windows | macOS | Linux |
|---|---|---|---|
| Presentation builder (`index.html`) | ✅ | ✅ | ✅ |
| Script→Video (TTS + HyperFrames) | ✅ | ✅ | ✅ |
| Local OmniVoice server | ✅ (`.ps1` / `.bat`) | ✅ (bash) | ✅ (bash) |
| HyperFrames CLI render | ✅ Node ≥22 + FFmpeg | ✅ | ✅ |
| Manim animations | ✅ (MiKTeX) | ✅ (MacTeX) | ✅ (TeX Live) |

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
# Option 1: Static serve (cross-platform)
npx serve . -p 3000

# Option 2: Open directly in browser
# Double-click index.html  (or right-click → Open with browser)
```

**Windows — built-in server launcher:**

```powershell
.\run-server.ps1        # PowerShell
.\run-server.bat        # CMD / Explorer double-click
```

The server runs on `http://localhost:8080` by default.

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
| 6. Compose | One 1920×1080 HyperFrame composition with `<audio>` or `<video>` + GSAP timeline. |
| 7. Inject | A new slide is appended to the deck containing the HyperFrame element. |

**Outputs per run:**

| Download link | What you get |
|---|---|
| ⬇ Download source video / audio | The raw media file (video MP4 or synthesized WAV). |
| ↗ Open video link | Opens the blob URL directly in a new tab. |
| ⬇ Download HyperFrames index.html | Render-safe composition for `npx hyperframes render`. References `assets/<file>` — no embedded data URLs. |
| ⬇ Download browser preview HTML | Same composition but with muted autoplay + click-to-unmute. Open directly from `file://` with the media file beside it under `assets/`. |
| 📋 Copy HyperFrames CLI Steps | Copies the exact PowerShell commands to set up the project and render to MP4. |

**HyperFrames CLI workflow (render to MP4):**

> **Prerequisites:** Node.js ≥ 22, FFmpeg on PATH.

```powershell
# Windows — copy the downloaded files into a new HyperFrames project
npx hyperframes init my-video
cd my-video
New-Item -ItemType Directory -Force ".\assets" | Out-Null
Copy-Item "C:/Users/<you>/Downloads/<slug>-hyperframes-index.html" ".\index.html"
Copy-Item "C:/Users/<you>/Downloads/<slug>-source-video.mp4" ".\assets\<slug>-source-video.mp4"
npx hyperframes preview         # opens http://localhost:3002 for QA
npx hyperframes render --output output.mp4
```

```bash
# macOS / Linux
npx hyperframes init my-video
cd my-video
mkdir -p assets
cp ~/Downloads/<slug>-hyperframes-index.html index.html
cp ~/Downloads/<slug>-source-video.mp4 assets/
npx hyperframes preview
npx hyperframes render --output output.mp4
```

**Browser preview (no CLI needed):**

```
Downloads/
├── <slug>-browser-preview.html     # open this in browser
└── assets/
    └── <slug>-source-video.mp4     # media must live here
```

**Limits / notes:**

- Audio/video is referenced by a relative `assets/<file>` path in exported HTML — no base64 data URLs. This avoids the HyperFrames linter `RangeError: Maximum call stack size exceeded` that occurs with multi-MB inline data.
- The OmniVoice HF Space runs on a free-tier ZeroGPU. Synthesis can take 10–60 s and may queue.
- Local CPU OmniVoice is slower than the HF/GPU path. On a Windows CPU test two short sentences took ~3 min; longer narration can take several minutes.
- Clone mode requires a reference audio file (≤30 s, clear voice) — upload it in the modal.
- Talking-cut mode requires a `.mp4` video file; the face-cam stays visible under kinetic-text overlays.

#### 🖥️ Run OmniVoice locally (free, offline, no rate limits)

OmniVoice is **Apache-2.0 open source** ([k2-fsa/OmniVoice](https://github.com/k2-fsa/OmniVoice)).
Run it on your own machine and the modal will automatically detect `http://localhost:8001`.

**Windows — launcher scripts (recommended):**

```powershell
.\run-omnivoice-local.ps1   # PowerShell — creates .venv-omnivoice if absent, then starts server
.\run-omnivoice-local.bat   # CMD / Explorer double-click equivalent
```

The launchers inject a `sitecustomize.py` patch under `tools/omnivoice_sitecustomize/` that
silently suppresses Windows-specific `ConnectionResetError (WinError 10054)` noise in the terminal.

**macOS / Linux — manual setup (no launcher script yet):**

```bash
python3 -m venv .venv-omnivoice
source .venv-omnivoice/bin/activate
pip install --upgrade pip
# CPU-only PyTorch (replace with +cu121 URL for NVIDIA GPU)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-omnivoice.txt
omnivoice-demo --ip 0.0.0.0 --port 8001 --no-asr
```

**Windows — manual setup:**

```powershell
py -3.12 -m venv .venv-omnivoice   # py -3.11 or py -3.10 also work
.\.venv-omnivoice\Scripts\Activate.ps1
python -m pip install --upgrade pip
# CPU-only (default — change URL for CUDA):
python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
# NVIDIA GPU (CUDA 12.1):
# python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
python -m pip install -r requirements-omnivoice.txt
omnivoice-demo --ip 0.0.0.0 --port 8001 --no-asr
```

Python 3.12 is recommended on Windows. If Python 3.10-3.12 is not registered with `py.exe`,
the launcher will use `uv` to install Python 3.12 automatically when available.
NVIDIA GPU is faster; the launcher installs CPU PyTorch by default for maximum compatibility.
The browser integration uses 4 inference steps for `localhost` to keep CPU runs as short as OmniVoice allows.

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

- **Python 3.10+** (3.12 recommended on Windows)
- **Manim Community** — `pip install manim` (see `requirements.txt`)
- **LaTeX distribution** for `Tex`/`MathTex` scenes:
  - Windows: [MiKTeX](https://miktex.org/) — install with "Install missing packages automatically" enabled
  - macOS: [MacTeX](https://www.tug.org/mactex/) — `brew install --cask mactex`
  - Linux: `sudo apt install texlive-full` (Debian/Ubuntu) or `sudo dnf install texlive-scheme-full` (Fedora)
- **Cairo / Pango** (required by Manim):
  - Windows: bundled with MiKTeX; otherwise install via [MSYS2](https://www.msys2.org/)
  - macOS: `brew install cairo pango`
  - Linux: `sudo apt install libcairo2-dev libpango1.0-dev`
- Virtual environment at `.venv/` (used by the run scripts)

**Windows run scripts:**

```powershell
.\run_sick_animation.ps1    # renders sick_animation7.py by default
.\run_sick_animation.bat    # CMD equivalent
```

**Manual render (any platform):**

```bash
# Activate venv first
# Windows: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate

python -m manim render media/sick_animation0.py Test
python -m manim render media/sick_animation1.py demo1
# etc.
```

**Quality flags:**

```powershell
python -m manim render -ql media\sick_animation0.py   # 480p  — fast preview
python -m manim render -qh media\sick_animation0.py   # 1080p — default
python -m manim render -qk media\sick_animation0.py   # 4K
```

**Manim virtualenv setup:**

```powershell
# Windows
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

```bash
# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## License

MIT
