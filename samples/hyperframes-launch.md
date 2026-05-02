---
theme: default
paginate: true
---

# HyperFrames
## Animated Video — From Plain Text

The fastest way to turn a script into a kinetic video presentation.
No timeline editor. No keyframe hell. Just write.

---

# The Problem

Creating polished video content has always been painful.

- Professional motion graphics: **days of work**
- Stock video + voiceover: **expensive and generic**
- Screen recordings: **low energy, low impact**
- Slide decks: **static and forgettable**

> "We need video for everything — social, docs, sales — but we can't afford a studio for every update."

---

# There Had to Be a Better Way

What if you could write a script and get a **professionally animated video** in minutes?

No Premiere. No After Effects. No Lottie wrangling.

Just a text editor and one click.

---

# Introducing HyperFrames

## Write a script → Get a video

HyperFrames is a browser-native engine that turns plain text scripts into **timed, animated video compositions** — complete with AI voiceover, kinetic typography, and scene choreography.

---

# How It Works

Four steps. Fully automatic.

1. **Write** — paste your script (sentences become scenes)
2. **Synthesize** — AI voice reads each line with natural prosody
3. **Choreograph** — GSAP animates text, images, and overlays per scene
4. **Embed** — the composition drops straight into your slide as a live iframe

---

# Step 1 — Write Your Script

Any plain text works. One sentence = one visual beat.

```
AI is changing how we ship software.
Today, 76% of developers use AI tools every week.
The old workflow was slow — the new one is instant.
Three things matter: clear intent, fast feedback, human judgement.
The future is collaborative: humans and AI, building together.
```

That's five scenes. Ready to animate.

---

# Step 2 — AI Voice Synthesis

HyperFrames uses **OmniVoice** — a state-of-the-art diffusion TTS model.

- Natural prosody, not robotic monotone
- Zero-shot voice cloning from a reference clip
- Runs fully **offline** on your machine
- Or routes to the HF Space when local isn't available

> The same engine used in production AI avatar pipelines — running in your browser.

---

# Step 3 — Scene Choreography

Every sentence gets its own visual scene, auto-timed to the audio.

- GSAP `gsap.timeline()` drives every animation
- Scenes fade in and out at exact audio timestamps
- Kinetic text, particle backgrounds, glow effects
- All encoded in a single self-contained HTML string

No video files. No render queues. **Just HTML.**

---

# Step 4 — Embed & Present

The finished composition is a **live `<iframe>`** inside your slide.

- Press play — audio starts, scenes animate in sync
- Export the slide deck as HTML — video travels with it
- Download the WAV audio separately if needed
- MP4 export: record the iframe with `MediaRecorder`

One deck. Zero external dependencies.

---

# Under the Hood

HyperFrames is built on two primitives.

| Layer | Technology |
|-------|------------|
| Animation | GSAP 3 (`gsap.timeline`) |
| Timing | Web Audio API timestamps |
| Voice | OmniVoice diffusion TTS |
| Transport | `srcdoc` iframe (sandboxed) |
| No build step | Vanilla ES modules |

Everything runs at **60 fps** in the browser.

---

# Voice Quality — Before & After

The difference between "meh" and "wow" is inference quality.

- **Before** — 32 diffusion steps, guidance 2.0 → robotic, flat
- **After** — 50 diffusion steps, guidance 3.5 → natural, expressive

> "It sounds like a real presenter, not a screen reader."

The model is `kokoro` — fast enough for real-time preview, good enough for production.

---

# What You Can Build

HyperFrames fits anywhere you need motion.

- **Product demos** — feature walkthroughs with narration
- **Training videos** — step-by-step with animated callouts
- **Social clips** — punchy 15-second kinetic text videos
- **Sales decks** — leave-behinds that actually play
- **Technical docs** — animated architecture diagrams

If it fits in a slide, HyperFrames can animate it.

---

# The Numbers

Real benchmarks on a mid-range laptop.

| Metric | Value |
|--------|-------|
| Script → audio | ~38 seconds (8 scenes) |
| Audio length | ~45 seconds of narration |
| HTML payload | ~12 KB (no external assets) |
| First paint | < 200 ms |
| Voice model load | ~16 seconds (cached) |

**From idea to playing video in under a minute.**

---

# Getting Started

Three things to set up once.

1. **Clone the repo** — `git clone github.com/your-org/markupppthtml`
2. **Start OmniVoice** — `.\run-omnivoice-local.ps1` (auto-downloads model)
3. **Open Script→Video** — click the 🎬 button, paste your script, hit Go

The local server auto-detects on modal open.
No API keys required for voice. OpenAI key optional for AI script generation.

---

# What's Next

The roadmap is short and focused.

- **MP4 export** — `MediaRecorder` captures iframe to downloadable video
- **Avatar overlay** — pipe OmniVoice audio into a lip-sync layer
- **Multi-voice** — different speakers per scene
- **Live preview** — see animation as you type the script
- **Templates** — one-click branded motion styles

> The goal: every slide deck ships with a video version. Always.

---

# HyperFrames

## Start building — today.

Open the app, click **Script→Video**, and paste any script.
Your first animated video will be ready before your next meeting.

- Local TTS: `localhost:8001` (OmniVoice)
- Slide server: `localhost:8080`
- Source: `js/script-to-video.js`

**Write. Synthesize. Animate. Ship.**
