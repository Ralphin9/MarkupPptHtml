/* ============================================================
 * Script-to-Video module
 * ------------------------------------------------------------
 * Browser-only pipeline inspired by:
 *   - https://huggingface.co/spaces/k2-fsa/OmniVoice  (TTS)
 *   - https://github.com/pjecuacion/script-to-video-skill (workflow)
 *
 * INPUT
 *   A plain script (string or .txt file) with optional YAML
 *   front-matter:
 *     ---
 *     title: My video
 *     theme: shadow-cut          # visual identity — one of 10 bundled themes
 *     voice: auto                # "auto" or "clone"
 *     ref_text: ""               # transcript of ref_audio (clone mode)
 *     ---
 *     The opening sentence.
 *     The second sentence — etc.
 *
 * PIPELINE
 *   1. parseScript()        → { meta, sentences[] }
 *   2. ttsViaOmniVoice()    → WAV Blob via @gradio/client
 *   3. estimateTimings()    → per-sentence start/duration
 *      (skips Whisper — distributes total audio duration by char-count)
 *   4. assignSceneTypes()   → no-repeat scene picker from a built-in subset
 *      of the script-to-video catalog
 *   5. buildHyperframeHTML()→ a single 1920×1080 composition with
 *      one .clip div per sentence + GSAP timeline + <audio data:wav>
 *   6. injectIntoDeck()     → adds a new slide containing one HyperFrame
 *      element bearing the composition
 *
 * OUTPUT
 *   - 1 new slide appended to the current deck
 *   - WAV blob is also offered for direct download
 * ============================================================ */
(function () {
  'use strict';

  const OMNIVOICE_SPACE = 'k2-fsa/OmniVoice';   // default: HF Space
  // Local install: `pip install omnivoice && omnivoice-demo --ip 0.0.0.0 --port 8001`
  // then pass server: 'http://localhost:8001' to run().
  const GRADIO_CDN = 'https://cdn.jsdelivr.net/npm/@gradio/client@1.7.1/dist/index.min.js';

  let _gradioPromise = null;
  function loadGradio() {
    if (_gradioPromise) return _gradioPromise;
    _gradioPromise = import(GRADIO_CDN).catch(err => {
      _gradioPromise = null;
      throw new Error('Failed to load @gradio/client from CDN: ' + err.message);
    });
    return _gradioPromise;
  }

  async function predictViaLocalGradio(target, apiName, args, signal) {
    const base = target.replace(/\/+$/, '');
    const endpoint = apiName.replace(/^\//, '');
    const post = await fetch(`${base}/gradio_api/call/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: args }),
      signal,
    });
    if (!post.ok) throw new Error(`OmniVoice call failed: HTTP ${post.status}`);

    const body = await post.json();
    if (!body?.event_id) throw new Error('OmniVoice returned no event id');

    const stream = await fetch(`${base}/gradio_api/call/${endpoint}/${body.event_id}`, { signal });
    if (!stream.ok) throw new Error(`OmniVoice stream failed: HTTP ${stream.status}`);
    const text = await stream.text();
    const errorMatch = text.match(/event:\s*error\s*\ndata:\s*([\s\S]*?)(?:\n\n|$)/);
    if (errorMatch) throw new Error(`OmniVoice error: ${errorMatch[1].trim()}`);

    const completeMatch = text.match(/event:\s*complete\s*\ndata:\s*([\s\S]*?)(?:\n\n|$)/);
    if (!completeMatch) throw new Error('OmniVoice stream ended without a complete event');
    return { data: JSON.parse(completeMatch[1]) };
  }

  function sanitizeExportFileName(inputName, fallbackBaseName, fallbackExt) {
    const raw = String(inputName || '').trim();
    const fallbackBase = String(fallbackBaseName || 'media').trim() || 'media';
    const fallbackExtension = String(fallbackExt || 'bin').trim().replace(/^\./, '') || 'bin';
    const splitAt = raw.lastIndexOf('.');
    const rawBase = splitAt > 0 ? raw.slice(0, splitAt) : raw;
    const rawExt = splitAt > 0 ? raw.slice(splitAt + 1) : fallbackExtension;
    const safeBase = (rawBase || fallbackBase)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || fallbackBase;
    const safeExt = (rawExt || fallbackExtension)
      .replace(/[^a-zA-Z0-9]+/g, '')
      .toLowerCase() || fallbackExtension;
    return `${safeBase}.${safeExt}`;
  }

  function sanitizeExportHtml(html) {
    return String(html || '')
      .replace(/<img\b[^>]*\bsrc="\/media\/doodles\/[^">]+"[^>]*>\s*/g, '')
      .replace(/<img\b[^>]*\bsrc="\/media\/doodles\/fffuel\/[^">]+"[^>]*>\s*/g, '');
  }

  // ---------------------------------------------------------- 1. parse script
  function parseScript(raw) {
    let meta = { title: '', theme: 'shadow-cut', voice: 'auto', ref_text: '' };
    let body = raw;
    const fm = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (fm) {
      fm[1].split('\n').forEach(line => {
        const kv = line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);
        if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
      });
      body = fm[2];
    }
    const sentences = body
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'])/)
      .map(s => s.trim())
      .filter(Boolean);
    if (!meta.title && sentences.length) {
      // synthesise a title from first 6 words
      meta.title = sentences[0].split(/\s+/).slice(0, 6).join(' ').replace(/[.!?,]+$/, '');
    }
    return { meta, sentences };
  }

  // ---------------------------------------------------------- 2. TTS
  async function ttsViaOmniVoice({ text, voice, refAudioFile, refText, server, onProgress, signal }) {
    const target = (server && server.trim()) || OMNIVOICE_SPACE;
    const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\/?/i.test(target);
    const steps = isLocalTarget ? 4 : 50;
    const duration = null;

    const cloneArgs = [
      text, 'Auto', refAudioFile, refText || '', '', steps, 2.0, true, 1.0, duration, true, true,
    ];
    const designArgs = [
      text, 'Auto', steps, 3.5, true, 1.0, duration, true, true,
      'Auto', 'Auto', 'Auto', 'Auto', 'Auto', 'Auto',
    ];
    const randomArgs = {
      text, language: 'Auto',
      instruct: '', ns: steps, gs: 3.5, dn: true, sp: 1.0, du: duration,
      pp: true, po: true,
    };

    const attempts = voice === 'clone'
      ? [{ apiName: '/_clone_fn', args: cloneArgs }]
      : [
          { apiName: '/_design_fn', args: designArgs },
          { apiName: '/_random_fn', args: randomArgs },
        ];

    let result;
    let lastError;

    if (isLocalTarget && voice !== 'clone') {
      onProgress?.(`Connecting to ${target}…`);
      onProgress?.(`Synthesizing audio locally with ${steps} steps. CPU can take a few minutes on Windows…`);
      result = await predictViaLocalGradio(target, '/_design_fn', designArgs, signal);
    } else {
      onProgress?.('Loading OmniVoice client…');
      const mod = await loadGradio();
      const Client = mod.Client || mod.default?.Client || mod.default;
      if (!Client) throw new Error('@gradio/client did not expose Client');

      onProgress?.(`Connecting to ${target}…`);
      const app = await Client.connect(target);
      onProgress?.('Synthesizing audio (this can take 10-60s on HF free tier)…');

      for (const attempt of attempts) {
        try {
          result = await app.predict(attempt.apiName, attempt.args);
          lastError = null;
          break;
        } catch (error) {
          const message = String(error?.message || error || '');
          const canTryLegacyRandom = attempt.apiName === '/_design_fn'
            && /endpoint|fn_index|not found|404/i.test(message);
          if (!canTryLegacyRandom) throw error;
          lastError = error;
        }
      }
    }
    if (lastError) throw lastError;
    // result.data shape: typically [{ url, path, ... }, "Done."]
    const data = Array.isArray(result?.data) ? result.data : result;
    let audioRef = Array.isArray(data) ? data[0] : data;
    if (audioRef && typeof audioRef === 'object' && 'url' in audioRef) audioRef = audioRef.url;
    if (!audioRef || typeof audioRef !== 'string') {
      throw new Error('OmniVoice returned no audio (response: ' + JSON.stringify(data).slice(0, 240) + ')');
    }

    onProgress?.('Downloading WAV…');
    const r = await fetch(audioRef, { signal });
    if (!r.ok) throw new Error('WAV download failed: HTTP ' + r.status);
    return await r.blob();
  }

  // ---------------------------------------------------------- 3. measure WAV duration
  function audioDuration(blob) {
    return new Promise((resolve, reject) => {
      const a = new Audio();
      const url = URL.createObjectURL(blob);
      a.src = url;
      a.addEventListener('loadedmetadata', () => {
        const d = a.duration;
        URL.revokeObjectURL(url);
        if (!isFinite(d) || d <= 0) reject(new Error('Could not read audio duration'));
        else resolve(d);
      }, { once: true });
      a.addEventListener('error', () => { URL.revokeObjectURL(url); reject(new Error('Audio decode failed')); }, { once: true });
    });
  }

  // ---------------------------------------------------------- 4. timing estimation
  function estimateTimings(sentences, totalDuration) {
    const weights = sentences.map(s => Math.max(8, s.length));
    const sum = weights.reduce((a, b) => a + b, 0);
    let t = 0;
    return sentences.map((sentence, i) => {
      const dur = (weights[i] / sum) * totalDuration;
      const out = { sentence, startTime: +t.toFixed(3), endTime: +(t + dur).toFixed(3), duration: +dur.toFixed(3) };
      t += dur;
      return out;
    });
  }

  // ---------------------------------------------------------- 5. scene picker
  // Content-signal rules from script-to-video-skill SKILL.md -- full catalog.
  // Priority: fixed anchors first (title/outro), then content signals, then pool rotation.
  function assignSceneTypes(items) {
    // Pool cycles for variety when no specific signal matches
    const POOL = [
      'kinetic-text','callout','stat-reveal','quote-card','list-reveal',
      'comparison','flow-steps','kinetic-impact','counter-up','progress-ring',
      'bar-chart','doodle-split','cta-callout','split-layout','threejs-object',
    ];
    const out = [];
    let poolIdx = 0;
    items.forEach((it, i) => {
      const s = it.sentence;
      let type;
      if (i === 0) {
        type = 'title-card';
      } else if (i === items.length - 1) {
        type = 'outro-card';
      } else if (/\b(subscribe|download|start free|get started|sign up|join now|try it|buy now|watch now|learn more|click here|register now)\b/i.test(s)) {
        type = 'cta-callout';
      } else if (/\bvs\.?\b|\bversus\b|\bcompared to\b/i.test(s)) {
        type = 'comparison';
      } else if (/\b\d+(?:\.\d+)?\s*%.*\b\d+(?:\.\d+)?\s*%/i.test(s)) {
        type = 'bar-chart';
      } else if (/\b\d+(?:\.\d+)?\s*%/.test(s) && /\b(grew|increased|reached|hit|surpassed|achieved|represents|makes up|accounts for|are|is)\b/i.test(s)) {
        type = 'progress-ring';
      } else if (/\b\d+(?:\.\d+)?\s*%/.test(s)) {
        type = 'stat-reveal';
      } else if (/\b(grew|increased|jumped|reached|hit|surpassed|doubled|tripled)\b.*\b\d+\b|\b\d+\b.*\b(users|customers|subscribers|downloads|sales|visits|followers|views|installs)\b/i.test(s)) {
        type = 'counter-up';
      } else if (/^["\u201C\u201D]/.test(s) || /\bsaid\b|\bsays\b|\baccording to\b/i.test(s)) {
        type = 'quote-card';
      } else if (/\bfirst\b.*\bsecond\b|\bthen\b.*\bfinally\b|\bstep\b|\bphase\b|\bstage\b/i.test(s)) {
        type = 'flow-steps';
      } else if (/(\w+,\s*\w+,\s*(?:and\s+)?\w+)/.test(s) && s.split(/[,;]/).length >= 3) {
        type = 'list-reveal';
      } else if (/\b(3D|three\.?js|rendering|geometry|polygon|mesh|sphere|torus|rotating object)\b/i.test(s)) {
        type = 'threejs-object';
      } else if (s.replace(/[^a-z0-9\s]/gi, '').split(/\s+/).length <= 7) {
        type = 'kinetic-impact';
      } else if (/\b(imagine|picture|think of|consider|what if|here's the thing|the key|the truth|the secret|the real)\b/i.test(s)) {
        type = 'doodle-split';
      } else {
        type = POOL[poolIdx % POOL.length];
        poolIdx++;
      }
      // No-repeat rule -- pick next-best from pool if same type as previous
      const prev = out.length ? out[out.length - 1].type : null;
      if (prev === type && !['title-card', 'outro-card'].includes(type)) {
        const alts = POOL.filter(t => t !== type && t !== prev);
        type = alts.length ? alts[poolIdx % alts.length] : POOL[(poolIdx + 1) % POOL.length];
        poolIdx++;
      }
      out.push({ ...it, id: i + 1, type });
    });
    return out;
  }
  // ---------------------------------------------------------- theme catalog
  // All 10 themes from https://github.com/pjecuacion/script-to-video-skill/tree/master/themes
  // Each entry now includes:
  //   typography.sizes  — per-theme headline/body/sub font sizes
  //   signaturePatterns — decorative elements that define each theme's visual identity
  //     headlineTextShadow : CSS text-shadow for headline elements (glow themes)
  //     sceneBgExtraCss    : extra CSS appended to .scene-bg (grid overlays etc.)
  //     sceneDecorHTML     : HTML injected after .scene-bg in every .clip (corner brackets etc.)
  //     specBox            : true → blueprint title-card uses spec-sheet dashed-box layout
  //     glassmorphism      : true → frost surfaces use backdrop-filter blur panels
  const THEMES = {
    'shadow-cut': {
      id:'shadow-cut', name:'Shadow Cut',
      colors:{bg:'#0a0a0a',surface:'#111111',text:'#e2e2e2',muted:'#8899aa',accent:'#c0392b',accentAlt:'#e74c3c'},
      typography:{fontFamily:"'Outfit',sans-serif", googleFonts:'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700;900&display=swap', weights:{headline:900,body:400}, sizes:{headline:'120px',body:'88px',sub:'52px'}},
      captions:{color:'#fff',textShadow:'0 2px 14px rgba(0,0,0,.95)'},
      signaturePatterns:null,
    },
    'neon-tokyo': {
      id:'neon-tokyo', name:'Neon Tokyo',
      colors:{bg:'#06061a',surface:'#0d0d2b',text:'#e8e8ff',muted:'#7b7ba8',accent:'#00f5ff',accentAlt:'#ff2d78'},
      typography:{fontFamily:"'JetBrains Mono',monospace", googleFonts:'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap', weights:{headline:800,body:400}, sizes:{headline:'110px',body:'82px',sub:'48px'}},
      captions:{color:'#00f5ff',textShadow:'0 0 16px rgba(0,245,255,0.7)'},
      signaturePatterns:{ headlineTextShadow:'0 0 40px rgba(0,245,255,0.25)' },
    },
    'blueprint': {
      id:'blueprint', name:'Blueprint',
      colors:{bg:'#0a1628',surface:'#0d1f3c',text:'#e8f0ff',muted:'#4d6a99',accent:'#4da6ff',accentAlt:'#ffffff'},
      typography:{fontFamily:"'IBM Plex Mono',monospace", googleFonts:'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap', weights:{headline:700,body:400}, sizes:{headline:'100px',body:'76px',sub:'46px'}},
      captions:{color:'#4da6ff',textShadow:'0 0 12px rgba(77,166,255,0.5)'},
      signaturePatterns:{
        sceneBgExtraCss:'background-image:repeating-linear-gradient(0deg,rgba(77,106,153,0.12) 0px,rgba(77,106,153,0.12) 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,rgba(77,106,153,0.12) 0px,rgba(77,106,153,0.12) 1px,transparent 1px,transparent 60px);',
        sceneDecorHTML:'<div style="position:absolute;top:36px;left:36px;width:40px;height:40px;border-top:3px solid #4da6ff;border-left:3px solid #4da6ff;pointer-events:none;"></div><div style="position:absolute;bottom:36px;right:36px;width:40px;height:40px;border-bottom:3px solid #4da6ff;border-right:3px solid #4da6ff;pointer-events:none;"></div>',
        specBox:true,
      },
    },
    'broadsheet': {
      id:'broadsheet', name:'Broadsheet',
      colors:{bg:'#f5f0e8',surface:'#ede8de',text:'#1c1c1c',muted:'#6b6055',accent:'#1c1c1c',accentAlt:'#8b0000'},
      typography:{fontFamily:"'Playfair Display',serif", googleFonts:'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap', weights:{headline:900,body:400}, sizes:{headline:'120px',body:'88px',sub:'52px'}},
      captions:{color:'#1c1c1c',textShadow:'none'},
      signaturePatterns:null,
    },
    'brutalist': {
      id:'brutalist', name:'Brutalist',
      colors:{bg:'#ffffff',surface:'#f0f0f0',text:'#000000',muted:'#444444',accent:'#ff0000',accentAlt:'#000000'},
      typography:{fontFamily:"'Bebas Neue',sans-serif", googleFonts:'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap', weights:{headline:400,body:400}, sizes:{headline:'140px',body:'100px',sub:'56px'}},
      captions:{color:'#000000',textShadow:'none'},
      signaturePatterns:null,
    },
    'dusk-gradient': {
      id:'dusk-gradient', name:'Dusk Gradient',
      colors:{bg:'#1a0533',surface:'#2d0a4e',text:'#fff4e6',muted:'#c49a7a',accent:'#ff6b35',accentAlt:'#ffd166'},
      bgStyle:'linear-gradient(135deg,#1a0533 0%,#6b1a5c 50%,#c0392b 80%,#ff6b35 100%)',
      typography:{fontFamily:"'Syne',sans-serif", googleFonts:'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap', weights:{headline:800,body:400}, sizes:{headline:'118px',body:'86px',sub:'52px'}},
      captions:{color:'#fff4e6',textShadow:'0 2px 14px rgba(0,0,0,0.8)'},
      signaturePatterns:null,
    },
    'frost': {
      id:'frost', name:'Frost',
      colors:{bg:'#ffffff',surface:'#f0f4f8',text:'#0f172a',muted:'#64748b',accent:'#1e3a5f',accentAlt:'#3b82f6'},
      typography:{fontFamily:"'Inter',sans-serif", googleFonts:'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap', weights:{headline:700,body:400}, sizes:{headline:'112px',body:'84px',sub:'50px'}},
      captions:{color:'#0f172a',textShadow:'none'},
      signaturePatterns:{ glassmorphism:true },
    },
    'open-page': {
      id:'open-page', name:'Open Page',
      colors:{bg:'#ffffff',surface:'#f5f5f0',text:'#1a1a1a',muted:'#6b7280',accent:'#e63946',accentAlt:'#c1121f'},
      typography:{fontFamily:"'Patrick Hand',cursive", googleFonts:'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap', weights:{headline:400,body:400}, sizes:{headline:'120px',body:'88px',sub:'52px'}},
      captions:{color:'#1a1a1a',textShadow:'none'},
      signaturePatterns:null,
    },
    'terminal-green': {
      id:'terminal-green', name:'Terminal Green',
      colors:{bg:'#0d0d0d',surface:'#111111',text:'#00ff41',muted:'#2a7a3a',accent:'#00ff41',accentAlt:'#39ff14'},
      typography:{fontFamily:"'JetBrains Mono',monospace", googleFonts:'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap', weights:{headline:700,body:400}, sizes:{headline:'100px',body:'76px',sub:'48px'}},
      captions:{color:'#00ff41',textShadow:'0 0 10px rgba(0,255,65,0.8)'},
      signaturePatterns:{ headlineTextShadow:'0 0 20px rgba(0,255,65,0.5)' },
    },
    'velvet-standard': {
      id:'velvet-standard', name:'Velvet Standard',
      colors:{bg:'#0a0a0a',surface:'#111111',text:'#f8f8f8',muted:'#888888',accent:'#c9a84c',accentAlt:'#e8c96a'},
      typography:{fontFamily:"'Cormorant Garamond',serif", googleFonts:'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600;700&display=swap', weights:{headline:300,body:400}, sizes:{headline:'130px',body:'92px',sub:'54px'}},
      captions:{color:'#c9a84c',textShadow:'0 2px 12px rgba(0,0,0,0.9)'},
      signaturePatterns:null,
    },
  };
  function getTheme(id) { return THEMES[id] || THEMES['shadow-cut']; }

  // ---------------------------------------------------------- doodle library
  // Sources (all free / open-licensed):
  //   Open Doodles (Pablo Stanley) — CC0  — /media/doodles/*.svg
  //   fffuel dddoodle pack (Syntax.fm) — CC-BY 4.0 — /media/doodles/fffuel/*.svg
  //
  // Character doodles: right-side decoration per scene type (Open Doodles).
  // Accent doodles   : small decorative scribbles injected around content (fffuel).
  //
  // Dark themes  → invert(1) brightness(1.8) + low opacity so line-art reads on dark bg.
  // Light themes → natural color at slightly higher opacity.

  // Per-scene-type character: main large illustration placed bottom-right
  const DOODLES_CHAR = {
    'title-card':   ['/media/doodles/float.svg', '/media/doodles/levitate.svg', '/media/doodles/groovy.svg'],
    'outro-card':   ['/media/doodles/jumping.svg', '/media/doodles/dancing.svg', '/media/doodles/moshing.svg'],
    'quote-card':   ['/media/doodles/sitting-reading.svg', '/media/doodles/reading.svg', '/media/doodles/reading-side.svg'],
    'callout':      ['/media/doodles/meditating.svg', '/media/doodles/chilling.svg', '/media/doodles/sitting.svg'],
    'list-reveal':  ['/media/doodles/unboxing.svg', '/media/doodles/strolling.svg', '/media/doodles/plant.svg'],
    'comparison':   ['/media/doodles/sitting.svg', '/media/doodles/clumsy.svg', '/media/doodles/selfie.svg'],
    'flow-steps':   ['/media/doodles/running.svg', '/media/doodles/sprinting.svg', '/media/doodles/roller-skating.svg'],
    'stat-reveal':  ['/media/doodles/jumping.svg', '/media/doodles/ballet.svg', '/media/doodles/dog-jump.svg'],
    'kinetic-text': ['/media/doodles/reading.svg', '/media/doodles/coffee.svg', '/media/doodles/petting.svg'],
    // New scene types
    'kinetic-impact':['/media/doodles/sprinting.svg', '/media/doodles/jumping.svg', '/media/doodles/moshing.svg'],
    'counter-up':   ['/media/doodles/ballet.svg', '/media/doodles/dog-jump.svg', '/media/doodles/levitate.svg'],
    'progress-ring':['/media/doodles/float.svg', '/media/doodles/groovy.svg', '/media/doodles/roller-skating.svg'],
    'bar-chart':    ['/media/doodles/unboxing.svg', '/media/doodles/chilling.svg', '/media/doodles/strolling.svg'],
    'doodle-split': ['/media/doodles/loving.svg', '/media/doodles/swinging.svg', '/media/doodles/dancing.svg'],
    'cta-callout':  ['/media/doodles/zombieing.svg', '/media/doodles/moshing.svg', '/media/doodles/jumping.svg'],
    'split-layout': ['/media/doodles/sitting.svg', '/media/doodles/reading.svg', '/media/doodles/coffee.svg'],
    'threejs-object':[],
  };

  // Per-scene-type accent: small fffuel scribble near the content
  const DOODLES_ACCENT = {
    'title-card':   '/media/doodles/fffuel/misc-3.svg',   // star burst
    'outro-card':   '/media/doodles/fffuel/misc-7.svg',   // heart scribble
    'quote-card':   '/media/doodles/fffuel/misc-12.svg',  // underline
    'callout':      '/media/doodles/fffuel/circle-1.svg', // circle emphasis
    'list-reveal':  '/media/doodles/fffuel/arrow-3.svg',  // arrow pointing in
    'comparison':      '/media/doodles/fffuel/arrow-15.svg', // double arrow
    'flow-steps':      '/media/doodles/fffuel/arrow-1.svg',  // flowing arrow
    'stat-reveal':     '/media/doodles/fffuel/misc-1.svg',   // underline emphasis
    'kinetic-text':    '/media/doodles/fffuel/line-2.svg',   // scribble underline
    // New scene types
    'kinetic-impact':  '/media/doodles/fffuel/line-5.svg',   // bold underline
    'counter-up':      '/media/doodles/fffuel/misc-20.svg',  // starburst
    'progress-ring':   '/media/doodles/fffuel/circle-8.svg', // circle emphasis
    'bar-chart':       '/media/doodles/fffuel/arrow-8.svg',  // upward arrow
    'doodle-split':    '/media/doodles/fffuel/misc-5.svg',   // scribble dot
    'cta-callout':     '/media/doodles/fffuel/arrow-12.svg', // pointing arrow
    'split-layout':    '/media/doodles/fffuel/line-4.svg',   // horizontal rule
    'threejs-object':  '/media/doodles/fffuel/circle-12.svg',// orbit circle
  };

  // Pick a character for this scene: rotate through the 3 variants using scene id
  function doodleImg(sceneType, T, sceneId) {
    const variants = DOODLES_CHAR[sceneType];
    if (!variants) return '';
    const src = variants[(sceneId || 0) % variants.length];
    const dark = ['shadow-cut','neon-tokyo','blueprint','dusk-gradient','terminal-green','velvet-standard'].includes(T.id);
    const filter = dark ? 'invert(1) brightness(1.8)' : 'none';
    const opacity = dark ? '0.12' : '0.18';
    return `<img src="${src}" alt="" aria-hidden="true" style="position:absolute;right:80px;bottom:40px;height:500px;width:auto;opacity:${opacity};filter:${filter};pointer-events:none;user-select:none;">`;
  }

  // Small accent scribble: top-left or near headline
  function doodleAccent(sceneType, T) {
    const src = DOODLES_ACCENT[sceneType];
    if (!src) return '';
    const dark = ['shadow-cut','neon-tokyo','blueprint','dusk-gradient','terminal-green','velvet-standard'].includes(T.id);
    // Tint accent doodles to the theme accent color via SVG filter trick (sepia+saturate)
    const filter = dark ? `invert(1) sepia(1) saturate(5) hue-rotate(160deg) opacity(0.35)` : `sepia(1) saturate(3) hue-rotate(300deg) opacity(0.3)`;
    return `<img src="${src}" alt="" aria-hidden="true" style="position:absolute;left:120px;top:100px;height:110px;width:auto;filter:${filter};pointer-events:none;user-select:none;">`;
  }

  // ---------------------------------------------------------- 6. scene HTML/JS templates
  // Each renderer receives (s, T) where T = getTheme(themeId). Colors, fonts and
  // weights are injected from the active theme so every scene respects the chosen palette.
  const SCENE = {
    'title-card': (s, T) => {
      const sp = T.signaturePatterns;
      const hl = T.typography.sizes?.headline || '120px';
      const ts = sp?.headlineTextShadow ? `;text-shadow:${sp.headlineTextShadow}` : '';
      if (sp?.specBox) {
        // Blueprint: annotation label above a dashed spec-sheet box
        const annotation = '// ' + s.sentence.replace(/[^a-z0-9 ]/gi, '').split(' ').slice(0, 4).join('_').toUpperCase();
        return {
          html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:flex-start;justify-content:center;">
    <div id="s${s.id}-pre" style="font-family:${T.typography.fontFamily};font-size:28px;color:${T.colors.muted};letter-spacing:4px;margin-bottom:16px;">${esc(annotation)}</div>
    <div id="s${s.id}-box" style="border:2px dashed rgba(77,106,153,0.4);background:${T.colors.surface};padding:40px 48px;max-width:1400px;">
      <h1 id="s${s.id}-t" style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:${hl};color:${T.colors.text};line-height:1.05${ts};">${esc(s.sentence)}</h1>
    </div>
  </div>
</div>`,
          gsap: `tl.from('#s${s.id}-pre',{y:-20,opacity:0,duration:0.4,ease:'power2.out'},${s.startTime}+0.1);
tl.from('#s${s.id}-box',{opacity:0,y:30,duration:0.6,ease:'power2.out'},${s.startTime}+0.3);`,
        };
      }
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleImg('title-card', T, s.id)}
  ${doodleAccent('title-card', T)}
  <div class="scene-content" style="align-items:center;text-align:center;">
    <h1 id="s${s.id}-t" style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:${hl};color:${T.colors.text};line-height:1.05${ts};">${esc(s.sentence)}</h1>
    <div id="s${s.id}-bar" style="width:0px;height:6px;background:${T.colors.accent};margin-top:36px;"></div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-t',{y:60,opacity:0,duration:0.7,ease:'power3.out'},${s.startTime}+0.2);
tl.to('#s${s.id}-bar',{width:'320px',duration:0.7,ease:'power2.inOut'},${s.startTime}+0.6);`,
      };
    },
    'kinetic-text': (s, T) => {
      const sp = T.signaturePatterns;
      const sz = T.typography.sizes?.body || '88px';
      const ts = sp?.headlineTextShadow ? `;text-shadow:${sp.headlineTextShadow}` : '';
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleImg('kinetic-text', T, s.id)}
  ${doodleAccent('kinetic-text', T)}
  <div class="scene-content" style="align-items:flex-start;">
    <div id="s${s.id}-k" style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:${sz};color:${T.colors.text};line-height:1.1;max-width:1500px${ts};">${splitWords(s.sentence, s.id)}</div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-k .kw',{y:80,opacity:0,duration:0.45,ease:'power3.out',stagger:{each:0.06,from:'start'}},${s.startTime}+0.1);`,
      };
    },
    'callout': (s, T) => {
      const sp = T.signaturePatterns;
      const sz = T.typography.sizes?.body || '88px';
      const ts = sp?.headlineTextShadow ? `;text-shadow:${sp.headlineTextShadow}` : '';
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleImg('callout', T, s.id)}
  ${doodleAccent('callout', T)}
  <div class="scene-content" style="align-items:center;text-align:center;">
    <div id="s${s.id}-c" style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:${sz};color:${T.colors.text};max-width:1400px;line-height:1.15${ts};">${esc(s.sentence)}</div>
  </div>
</div>`,
        gsap: `tl.fromTo('#s${s.id}-c',{scale:0.85,opacity:0},{scale:1,opacity:1,duration:0.6,ease:'back.out(1.5)'},${s.startTime}+0.1);`,
      };
    },
    'stat-reveal': (s, T) => {
      const num = (s.sentence.match(/\d+(?:\.\d+)?/) || ['0'])[0];
      const label = s.sentence.replace(num, '').replace(/[%.]/g, '').trim().toUpperCase().slice(0, 60);
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleImg('stat-reveal', T, s.id)}
  ${doodleAccent('stat-reveal', T)}
  <div class="scene-content" style="align-items:center;text-align:center;">
    <div id="s${s.id}-num" style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:200px;color:${T.colors.text};line-height:1;">${esc(num)}<span style="color:${T.colors.accent};">%</span></div>
    <div id="s${s.id}-lbl" style="font-family:${T.typography.fontFamily};font-weight:500;font-size:42px;color:${T.colors.muted};letter-spacing:0.08em;margin-top:24px;">${esc(label)}</div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-num',{scale:0.6,opacity:0,duration:0.6,ease:'back.out(2)'},${s.startTime}+0.15);
tl.from('#s${s.id}-lbl',{y:30,opacity:0,duration:0.4,ease:'power2.out'},${s.startTime}+0.55);`,
      };
    },
    'quote-card': (s, T) => {
      const sp = T.signaturePatterns;
      const surfaceStyle = sp?.glassmorphism
        ? `background:rgba(255,255,255,0.7);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.9);border-radius:20px;`
        : `background:${T.colors.surface};`;
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleImg('quote-card', T, s.id)}
  ${doodleAccent('quote-card', T)}
  <div class="scene-content" style="align-items:flex-start;justify-content:center;">
    <div id="s${s.id}-q" style="${surfaceStyle}padding:60px 80px;border-left:8px solid ${T.colors.accent};max-width:1200px;position:relative;">
      <div style="position:absolute;top:-30px;left:56px;font-family:${T.typography.fontFamily};font-size:180px;color:${T.colors.accent};line-height:1;">&ldquo;</div>
      <blockquote style="font-family:${T.typography.fontFamily};font-weight:400;font-size:48px;color:${T.colors.text};line-height:1.5;padding-top:36px;margin:0;">${esc(s.sentence)}</blockquote>
    </div>
  </div>
</div>`,
        gsap: `tl.fromTo('#s${s.id}-q',{opacity:0,y:30},{opacity:1,y:0,duration:0.6,ease:'power2.out'},${s.startTime}+0.15);`,
      };
    },
    'list-reveal': (s, T) => {
      const items = s.sentence.split(/[,;]|\band\b/i).map(x => x.trim()).filter(Boolean).slice(0, 5);
      const lis = items.map((t, i) => `<li id="s${s.id}-li${i}" style="font-family:${T.typography.fontFamily};font-weight:500;font-size:54px;color:${T.colors.text};display:flex;align-items:center;gap:24px;"><span style="width:14px;height:14px;border-radius:50%;background:${T.colors.accent};flex-shrink:0;"></span>${esc(t)}</li>`).join('');
      const stagger = items.map((_, i) => `tl.from('#s${s.id}-li${i}',{x:-60,opacity:0,duration:0.4,ease:'power2.out'},${s.startTime}+${(0.3 + i * 0.18).toFixed(2)});`).join('\n');
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleImg('list-reveal', T, s.id)}
  ${doodleAccent('list-reveal', T)}
  <div class="scene-content">
    <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:24px;">${lis}</ul>
  </div>
</div>`,
        gsap: stagger,
      };
    },
    'comparison': (s, T) => {
      const sp = T.signaturePatterns;
      const panelStyle = sp?.glassmorphism
        ? `background:rgba(255,255,255,0.6);backdrop-filter:blur(16px);border-radius:20px;border:1px solid rgba(255,255,255,0.9);`
        : `background:${T.colors.surface};border-radius:16px;border:2px solid ${T.colors.muted};`;
      const panelBStyle = sp?.glassmorphism
        ? `background:rgba(255,255,255,0.6);backdrop-filter:blur(16px);border-radius:20px;border:2px solid ${T.colors.accent};`
        : `background:${T.colors.surface};border-radius:16px;border:2px solid ${T.colors.accent};`;
      const parts = s.sentence.split(/\bvs\.?\b|\bversus\b|\bcompared to\b/i);
      const a = (parts[0] || 'Before').trim().slice(0, 60);
      const b = (parts[1] || 'After').trim().slice(0, 60);
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleAccent('comparison', T)}
  <div class="scene-content" style="flex-direction:row;gap:60px;align-items:stretch;">
    <div id="s${s.id}-a" style="flex:1;${panelStyle}padding:60px;display:flex;align-items:center;justify-content:center;">
      <div style="font-family:${T.typography.fontFamily};font-weight:700;font-size:46px;color:${T.colors.muted};text-align:center;">${esc(a)}</div>
    </div>
    <div id="s${s.id}-vs" style="align-self:center;font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:52px;color:${T.colors.accent};">VS</div>
    <div id="s${s.id}-b" style="flex:1;${panelBStyle}padding:60px;display:flex;align-items:center;justify-content:center;">
      <div style="font-family:${T.typography.fontFamily};font-weight:700;font-size:46px;color:${T.colors.text};text-align:center;">${esc(b)}</div>
    </div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-a',{x:-80,opacity:0,duration:0.6,ease:'expo.out'},${s.startTime}+0.2);
tl.from('#s${s.id}-vs',{scale:0.5,opacity:0,duration:0.4,ease:'back.out(3)'},${s.startTime}+0.55);
tl.from('#s${s.id}-b',{x:80,opacity:0,duration:0.6,ease:'expo.out'},${s.startTime}+0.7);`,
      };
    },
    'flow-steps': (s, T) => {
      const steps = s.sentence.split(/[,;]|\bthen\b|\bfinally\b/i).map(x => x.trim()).filter(Boolean).slice(0, 3);
      while (steps.length < 3) steps.push('—');
      const cells = steps.map((t, i) => `
        <div id="s${s.id}-st${i}" style="background:${T.colors.surface};padding:48px;flex:1;text-align:center;">
          <div style="font-size:52px;font-weight:${T.typography.weights.headline};color:${T.colors.accent};margin-bottom:12px;">${i + 1}</div>
          <div style="font-size:30px;font-weight:700;color:${T.colors.text};line-height:1.3;">${esc(t)}</div>
        </div>${i < steps.length - 1 ? `<div id="s${s.id}-arr${i}" style="font-size:60px;color:${T.colors.muted};padding:0 16px;align-self:center;">→</div>` : ''}`).join('');
      const tweens = steps.map((_, i) => `tl.from('#s${s.id}-st${i}',{y:30,opacity:0,duration:0.4,ease:'power2.out'},${s.startTime}+${(0.3 + i * 0.4).toFixed(2)});`).join('\n');
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleAccent('flow-steps', T)}
  <div class="scene-content" style="align-items:center;">
    <div style="display:flex;align-items:stretch;justify-content:center;width:100%;">${cells}</div>
  </div>
</div>`,
        gsap: tweens,
      };
    },
    'outro-card': (s, T) => {
      const sp = T.signaturePatterns;
      const hl = T.typography.sizes?.headline || '120px';
      const ts = sp?.headlineTextShadow ? `;text-shadow:${sp.headlineTextShadow}` : '';
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleImg('outro-card', T, s.id)}
  ${doodleAccent('outro-card', T)}
  <div class="scene-content" style="align-items:center;text-align:center;gap:28px;">
    <div id="s${s.id}-lbl" style="font-size:22px;font-weight:700;letter-spacing:8px;color:${T.colors.accent};text-transform:uppercase;">THANKS FOR WATCHING</div>
    <div id="s${s.id}-t" style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:${hl};color:${T.colors.text};line-height:1.05${ts};">${esc(s.sentence)}</div>
    <div id="s${s.id}-rule" style="width:0px;height:3px;background:${T.colors.accent};"></div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-lbl',{y:-20,opacity:0,duration:0.4,ease:'power2.out'},${s.startTime}+0.2);
tl.from('#s${s.id}-t',{y:60,opacity:0,duration:0.7,ease:'power3.out'},${s.startTime}+0.45);
tl.to('#s${s.id}-rule',{width:'280px',duration:0.7,ease:'power2.inOut'},${s.startTime}+0.95);`,
      };
    },

    // ── New scene types ────────────────────────────────────────────────────────

    // kinetic-impact: one short punchy phrase dominates the canvas
    'kinetic-impact': (s, T) => {
      const sp = T.signaturePatterns;
      const words = s.sentence.replace(/[.!?,]+$/, '').split(/\s+/);
      const impactWords = words.slice(-Math.min(3, words.length));
      const prefix = words.length > impactWords.length ? words.slice(0, words.length - impactWords.length).join(' ') : '';
      const impact = impactWords.join(' ').toUpperCase();
      const ts = sp?.headlineTextShadow ? `;text-shadow:${sp.headlineTextShadow}` : '';
      const impactSize = impact.length > 20 ? '110px' : impact.length > 12 ? '140px' : '180px';
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleAccent('kinetic-impact', T)}
  <div class="scene-content" style="align-items:center;text-align:center;gap:20px;">
    ${prefix ? `<div id="s${s.id}-pre" style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.body};font-size:44px;color:${T.colors.muted};letter-spacing:0.04em;">${esc(prefix)}</div>` : ''}
    <div id="s${s.id}-imp" style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:${impactSize};color:${T.colors.accent};line-height:1;letter-spacing:-0.02em${ts};">${esc(impact)}</div>
    <div id="s${s.id}-line" style="width:0;height:4px;background:${T.colors.text};"></div>
  </div>
</div>`,
        gsap: `${prefix ? `tl.from('#s${s.id}-pre',{y:-30,opacity:0,duration:0.4,ease:'power2.out'},${s.startTime}+0.1);` : ''}
tl.fromTo('#s${s.id}-imp',{scale:1.4,opacity:0},{scale:1,opacity:1,duration:0.5,ease:'expo.out'},${s.startTime}+${prefix ? 0.3 : 0.15});
tl.to('#s${s.id}-line',{width:'400px',duration:0.6,ease:'power2.inOut'},${s.startTime}+0.65);`,
      };
    },

    // counter-up: big number animated from zero using GSAP
    'counter-up': (s, T) => {
      const numMatch = s.sentence.match(/\b(\d[\d,]*(?:\.\d+)?)\b/);
      const num = numMatch ? parseFloat(numMatch[1].replace(/,/g, '')) : 100;
      const suffix = /\s*%/.test(s.sentence) ? '%' : /\bx\b/i.test(s.sentence) ? '\u00d7' : '';
      const label = s.sentence.replace(numMatch ? numMatch[0] : '', '').replace(/[.!?,]+/g, ' ').trim().toUpperCase().slice(0, 80);
      const sp = T.signaturePatterns;
      const ts = sp?.headlineTextShadow ? `;text-shadow:${sp.headlineTextShadow}` : '';
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleImg('counter-up', T, s.id)}
  ${doodleAccent('counter-up', T)}
  <div class="scene-content" style="align-items:center;text-align:center;">
    <div id="s${s.id}-num" style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:200px;color:${T.colors.text};line-height:1${ts};">0${esc(suffix)}</div>
    <div id="s${s.id}-lbl" style="font-family:${T.typography.fontFamily};font-weight:500;font-size:42px;color:${T.colors.muted};letter-spacing:0.08em;margin-top:24px;">${esc(label)}</div>
  </div>
</div>`,
        gsap: `var _o${s.id}={val:0};
tl.to(_o${s.id},{val:${num},duration:1.4,ease:'power2.out',onUpdate:function(){var el=document.getElementById('s${s.id}-num');if(el)el.textContent=Math.round(_o${s.id}.val).toLocaleString()+'${esc(suffix)}'}},${s.startTime}+0.3);
tl.from('#s${s.id}-lbl',{y:30,opacity:0,duration:0.4,ease:'power2.out'},${s.startTime}+0.15);`,
      };
    },

    // progress-ring: SVG animated arc showing a percentage
    'progress-ring': (s, T) => {
      const pctRaw = (s.sentence.match(/\b(\d+(?:\.\d+)?)\s*%/) || ['', '75'])[1];
      const pct = Math.min(100, Math.max(1, parseFloat(pctRaw)));
      const label = s.sentence.replace(/\d+(?:\.\d+)?\s*%/g, '').replace(/[.!?,]+/g, ' ').trim().slice(0, 100);
      const r = 160, cx = 200;
      const circ = +(2 * Math.PI * r).toFixed(1);
      const offset = +(circ * (1 - pct / 100)).toFixed(1);
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleAccent('progress-ring', T)}
  <div class="scene-content" style="align-items:center;text-align:center;flex-direction:row;gap:100px;padding:80px 160px;">
    <svg id="s${s.id}-svg" width="360" height="360" viewBox="0 0 400 400" style="flex-shrink:0;opacity:0;">
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${T.colors.surface}" stroke-width="22"/>
      <circle id="s${s.id}-ring" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${T.colors.accent}"
        stroke-width="22" stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
        transform="rotate(-90 ${cx} ${cx})" stroke-linecap="round"/>
      <text x="${cx}" y="${cx + 12}" text-anchor="middle" dominant-baseline="middle"
        font-family="${T.typography.fontFamily}" font-size="72" font-weight="${T.typography.weights.headline}"
        fill="${T.colors.text}">${pct}%</text>
    </svg>
    <div id="s${s.id}-lbl" style="font-family:${T.typography.fontFamily};font-weight:500;font-size:52px;color:${T.colors.muted};max-width:800px;text-align:left;line-height:1.35;">${esc(label)}</div>
  </div>
</div>`,
        gsap: `tl.to('#s${s.id}-svg',{opacity:1,duration:0.4,ease:'power2.out'},${s.startTime}+0.2);
tl.to('#s${s.id}-ring',{strokeDashoffset:${offset},duration:1.4,ease:'power2.out'},${s.startTime}+0.3);
tl.from('#s${s.id}-lbl',{x:60,opacity:0,duration:0.6,ease:'power2.out'},${s.startTime}+0.5);`,
      };
    },

    // bar-chart: horizontal bars, values parsed from sentence or illustrative fallback
    'bar-chart': (s, T) => {
      const parsed = [...s.sentence.matchAll(/(\b[A-Za-z][A-Za-z0-9\s]{1,18}?)\s*[:\-–]\s*(\d+(?:\.\d+)?)/g)]
        .slice(0, 4).map(m => ({ label: m[1].trim(), val: parseFloat(m[2]) }));
      const nums = [...s.sentence.matchAll(/\b(\d+(?:\.\d+)?)\s*%?/g)].map(m => parseFloat(m[1]));
      const bars = parsed.length >= 2 ? parsed
        : nums.length >= 2 ? nums.slice(0, 4).map((v, i) => ({ label: ['Q1','Q2','Q3','Q4'][i], val: v }))
        : [{ label:'Q1',val:42 },{ label:'Q2',val:67 },{ label:'Q3',val:85 },{ label:'Q4',val:73 }];
      const maxVal = Math.max(...bars.map(b => b.val));
      const barHTML = bars.map((b, i) => `<div id="s${s.id}-row${i}" style="display:flex;align-items:center;gap:24px;margin-bottom:24px;">
      <div style="font-family:${T.typography.fontFamily};font-size:30px;color:${T.colors.muted};width:150px;text-align:right;flex-shrink:0;">${esc(b.label)}</div>
      <div style="flex:1;height:50px;background:${T.colors.surface};border-radius:6px;overflow:hidden;">
        <div id="s${s.id}-fill${i}" style="width:0%;height:100%;background:${T.colors.accent};border-radius:6px;"></div>
      </div>
      <div style="font-family:${T.typography.fontFamily};font-size:30px;font-weight:700;color:${T.colors.text};width:70px;flex-shrink:0;">${b.val}</div>
    </div>`).join('');
      const tweens = bars.map((b, i) => {
        const pctW = (b.val / maxVal * 100).toFixed(1);
        return `tl.from('#s${s.id}-row${i}',{x:-50,opacity:0,duration:0.4,ease:'power2.out'},${s.startTime}+${(0.2 + i * 0.15).toFixed(2)});
tl.to('#s${s.id}-fill${i}',{width:'${pctW}%',duration:0.9,ease:'power2.out'},${s.startTime}+${(0.3 + i * 0.15).toFixed(2)});`;
      }).join('\n');
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleAccent('bar-chart', T)}
  <div class="scene-content" style="justify-content:center;">
    <div style="width:100%;max-width:1400px;">${barHTML}</div>
  </div>
</div>`,
        gsap: tweens,
      };
    },

    // doodle-split: prominent character illustration right, text left
    'doodle-split': (s, T) => {
      const sp = T.signaturePatterns;
      const sz = T.typography.sizes?.body || '88px';
      const ts = sp?.headlineTextShadow ? `;text-shadow:${sp.headlineTextShadow}` : '';
      const variants = DOODLES_CHAR['doodle-split'];
      const charSrc = variants && variants.length ? variants[(s.id || 0) % variants.length] : '';
      const dark = ['shadow-cut','neon-tokyo','blueprint','dusk-gradient','terminal-green','velvet-standard'].includes(T.id);
      const charFilter = dark ? 'invert(1) brightness(1.8)' : 'none';
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleAccent('doodle-split', T)}
  <div class="scene-content" style="flex-direction:row;gap:80px;align-items:center;padding:80px 120px;">
    <div id="s${s.id}-txt" style="flex:1;">
      <div style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:${sz};color:${T.colors.text};line-height:1.2${ts};">${esc(s.sentence)}</div>
    </div>
    <div id="s${s.id}-img" style="flex:0 0 480px;display:flex;align-items:center;justify-content:center;">
      ${charSrc ? `<img src="${charSrc}" alt="" aria-hidden="true" style="height:580px;width:auto;opacity:${dark ? '0.85' : '0.9'};filter:${charFilter};">` : ''}
    </div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-txt',{x:-80,opacity:0,duration:0.6,ease:'expo.out'},${s.startTime}+0.2);
tl.from('#s${s.id}-img',{x:80,opacity:0,duration:0.6,ease:'expo.out'},${s.startTime}+0.35);`,
      };
    },

    // cta-callout: call-to-action with accent pill button
    'cta-callout': (s, T) => {
      const sp = T.signaturePatterns;
      const ts = sp?.headlineTextShadow ? `;text-shadow:${sp.headlineTextShadow}` : '';
      const actionMatch = s.sentence.match(/\b(subscribe|download|start|try|get started|join|sign up|click|buy|register|learn more|watch now|start free)\b/i);
      const btnLabel = actionMatch ? actionMatch[0].toUpperCase() : 'GET STARTED';
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleImg('cta-callout', T, s.id)}
  ${doodleAccent('cta-callout', T)}
  <div class="scene-content" style="align-items:center;text-align:center;gap:48px;">
    <div id="s${s.id}-t" style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:72px;color:${T.colors.text};max-width:1300px;line-height:1.2${ts};">${esc(s.sentence)}</div>
    <div id="s${s.id}-btn" style="background:${T.colors.accent};color:#ffffff;font-family:${T.typography.fontFamily};font-weight:700;font-size:36px;letter-spacing:0.12em;padding:28px 80px;border-radius:8px;display:inline-block;">
      ${esc(btnLabel)} &#8594;
    </div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-t',{y:40,opacity:0,duration:0.5,ease:'power2.out'},${s.startTime}+0.2);
tl.fromTo('#s${s.id}-btn',{scale:0.8,opacity:0},{scale:1,opacity:1,duration:0.5,ease:'back.out(1.8)'},${s.startTime}+0.6);`,
      };
    },

    // split-layout: two-column — text left, decorative panel right
    'split-layout': (s, T) => {
      const sp = T.signaturePatterns;
      const sz = T.typography.sizes?.sub || '52px';
      const ts = sp?.headlineTextShadow ? `;text-shadow:${sp.headlineTextShadow}` : '';
      const panelStyle = sp?.glassmorphism
        ? `background:rgba(255,255,255,0.7);backdrop-filter:blur(16px);border-radius:20px;border:1px solid rgba(255,255,255,0.9);`
        : `background:${T.colors.surface};border-radius:16px;border:1px solid ${T.colors.accent}33;`;
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  ${doodleAccent('split-layout', T)}
  <div class="scene-content" style="flex-direction:row;gap:80px;align-items:center;padding:80px 120px;">
    <div id="s${s.id}-left" style="flex:1;">
      <div style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:${sz};color:${T.colors.text};line-height:1.35${ts};">${esc(s.sentence)}</div>
    </div>
    <div id="s${s.id}-right" style="flex:0 0 560px;height:480px;${panelStyle}display:flex;align-items:center;justify-content:center;">
      <div style="font-family:${T.typography.fontFamily};font-size:120px;font-weight:${T.typography.weights.headline};color:${T.colors.accent};opacity:0.35;user-select:none;">${doodleImg('split-layout', T, s.id) ? '' : '&#10022;'}</div>
    </div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-left',{x:-60,opacity:0,duration:0.6,ease:'power2.out'},${s.startTime}+0.2);
tl.from('#s${s.id}-right',{x:60,opacity:0,duration:0.6,ease:'power2.out'},${s.startTime}+0.35);`,
      };
    },

    // threejs-object: full 3D Three.js scene — geometry driven by sentence content
    // Three.js must be served locally at /js/three.min.js (see SKILL.md note on bundling)
    // RAF loop runs independently; HyperFrames captures frames after rAF fires.
    'threejs-object': (s, T) => {
      const sp = T.signaturePatterns;
      const sz = T.typography.sizes?.sub || '52px';
      const ts = sp?.headlineTextShadow ? `;text-shadow:${sp.headlineTextShadow}` : '';
      const accent6 = T.colors.accent.replace('#', '');
      const accentAlt6 = T.colors.accentAlt.replace('#', '');
      let geomCtor;
      if (/\bAI\b|\bneural\b|\bnetwork\b|\balgorithm\b|\bknot\b|\bcomplex\b/i.test(s.sentence)) {
        geomCtor = 'TorusKnotGeometry(1,0.35,128,16)';
      } else if (/\bglobe\b|\bworld\b|\bplanet\b|\bsphere\b|\bearth\b/i.test(s.sentence)) {
        geomCtor = 'IcosahedronGeometry(1.4,1)';
      } else if (/\bcube\b|\bbox\b|\bblock\b/i.test(s.sentence)) {
        geomCtor = 'BoxGeometry(1.5,1.5,1.5)';
      } else {
        geomCtor = 'TorusGeometry(1.2,0.4,32,80)';
      }
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <canvas id="s${s.id}-cv" style="position:absolute;inset:0;width:1920px;height:1080px;pointer-events:none;"></canvas>
  <div class="scene-content" style="align-items:flex-start;justify-content:center;">
    <div id="s${s.id}-t" style="font-family:${T.typography.fontFamily};font-weight:${T.typography.weights.headline};font-size:${sz};color:${T.colors.text};max-width:1000px;line-height:1.3;z-index:1;position:relative${ts};">${esc(s.sentence)}</div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-t',{y:40,opacity:0,duration:0.6,ease:'power2.out'},${s.startTime}+0.4);`,
        // threeInit runs once at page load; canvas renders continuously via RAF.
        threeInit: `(function(){
  if(typeof THREE==='undefined'){console.warn('[s2v] Three.js not loaded, skipping threejs-object s${s.id}');return;}
  var cv=document.getElementById('s${s.id}-cv');
  if(!cv)return;
  var W=1920,H=1080;
  var renderer=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true});
  renderer.setSize(W,H,false);renderer.setPixelRatio(1);
  var scene=new THREE.Scene();
  var cam=new THREE.PerspectiveCamera(45,W/H,0.1,1000);
  cam.position.z=4;
  var geo=new THREE.${geomCtor};
  var mat=new THREE.MeshStandardMaterial({color:0x${accent6},metalness:0.6,roughness:0.25});
  var mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(5.5,0,0);
  scene.add(mesh);
  scene.add(new THREE.AmbientLight(0xffffff,0.5));
  var dl=new THREE.DirectionalLight(0x${accentAlt6},1.4);
  dl.position.set(5,4,5);scene.add(dl);
  var dl2=new THREE.DirectionalLight(0x${accent6},0.6);
  dl2.position.set(-4,-2,3);scene.add(dl2);
  (function tick(){requestAnimationFrame(tick);mesh.rotation.x+=0.007;mesh.rotation.y+=0.011;renderer.render(scene,cam);})();
}())`,
      };
    },
  };

  function splitWords(text, sceneId) {
    return text.split(/\s+/).map(w => `<span class="kw">${esc(w)}</span>`).join(' ');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function scheduleTalkingCutScenes(scenes, totalDuration) {
    const sourceScenes = scenes
      .filter(scene => !['title-card', 'outro-card'].includes(scene.type))
      .map(scene => {
        const type = scene.type === 'threejs-object' ? 'kinetic-text' : scene.type;
        return { ...scene, type };
      });
    const selected = sourceScenes.length ? sourceScenes : scenes.slice(1, -1);
    const scheduled = [];
    let cursor = Math.min(4, Math.max(1.5, totalDuration * 0.18));
    selected.forEach((scene, index) => {
      if (cursor >= totalDuration - 1.2) return;
      const duration = clampNumber(scene.duration * 0.75, 2.6, 5.0);
      const safeDuration = Math.min(duration, Math.max(1.2, totalDuration - cursor - 0.6));
      if (safeDuration < 1.2) return;
      scheduled.push({
        ...scene,
        id: index + 1,
        startTime: +cursor.toFixed(3),
        duration: +safeDuration.toFixed(3),
        endTime: +(cursor + safeDuration).toFixed(3),
      });
      cursor += safeDuration + 3;
    });
    return scheduled;
  }

  function buildTalkingCutHTML(meta, scenes, mediaDataUrl, totalDuration, themeId, options = {}) {
    const isRotate = themeId === 'rotate';
    const themeKeys = Object.keys(THEMES);
    const sceneThemes = scenes.map((scene, index) =>
      isRotate ? THEMES[themeKeys[index % themeKeys.length]] : getTheme(themeId || meta.theme)
    );
    const primaryTheme = sceneThemes[0] || getTheme(themeId || meta.theme);
    const slug = (meta.title || 'talking-cut').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'talking-cut';
    const sceneBlocks = scenes.map((scene, index) => (SCENE[scene.type] || SCENE['kinetic-text'])(scene, sceneThemes[index] || primaryTheme));
    const sceneHTML = sceneBlocks.map((block, index) => {
      const theme = sceneThemes[index] || primaryTheme;
      const bgCss = theme.bgStyle ? `background:${theme.bgStyle};` : `background:${theme.colors.bg};`;
      const extraCss = theme.signaturePatterns?.sceneBgExtraCss || '';
      const decor = theme.signaturePatterns?.sceneDecorHTML || '';
      return block.html.replace(
        '<div class="scene-bg"></div>',
        `<div class="scene-bg" style="${bgCss}${extraCss};opacity:0.96;"></div>${decor}`
      );
    }).join('\n');
    const sceneJS = sceneBlocks.map(block => block.gsap).join('\n');
    const threeInits = sceneBlocks.map(block => block.threeInit).filter(Boolean).join('\n');
    const hasThree = threeInits.length > 0;
    const visJS = scenes.map(scene => {
      const endTime = +(scene.startTime + scene.duration).toFixed(3);
      return `tl.set('#s${scene.id}',{opacity:1},${scene.startTime});\ntl.set('#s${scene.id}',{opacity:0},${endTime});`;
    }).join('\n');
    const fontLink = isRotate
      ? [...new Set(Object.values(THEMES).map(theme => theme.typography.googleFonts).filter(Boolean))]
          .map(url => `<link rel="stylesheet" href="${url}">`).join('\n')
      : (primaryTheme.typography.googleFonts ? `<link rel="stylesheet" href="${primaryTheme.typography.googleFonts}">` : '');
    const standalonePlayback = options.standalone ? `
  var video = document.getElementById('source-video');
  video.controls = true;
  function start(){
    video.muted = false;
    video.play().catch(function(){});
    tl.play(video.currentTime || 0);
  }
  video.addEventListener('timeupdate', function(){
    if (Math.abs(tl.time() - video.currentTime) > 0.12) tl.time(video.currentTime);
  });
  video.addEventListener('click', start);
  window.addEventListener('pointerdown', start, true);
  document.body.addEventListener('click', start);
` : `
  // HyperFrames owns media playback — no imperative play/pause/currentTime here
`;

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=1920, height=1080">
${fontLink}
${hasThree ? '<script src="https://cdn.jsdelivr.net/npm/three@0.173.0/build/three.min.js"><\/script>\n' : ''}<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"><\/script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1920px; height:1080px; overflow:hidden; background:#000; }
  [data-composition-id] { position:absolute; inset:0; overflow:hidden; }
  #v-wrap { position:absolute; inset:0; z-index:1; background:#000; }
  #source-video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  #v-wrap::after { content:''; position:absolute; inset:0; background:rgba(0,0,0,0.16); pointer-events:none; }
  .clip { position:absolute; inset:0; opacity:0; z-index:2; }
  .scene-bg { position:absolute; inset:0; }
  .scene-content { position:relative; width:100%; height:100%; padding:120px 160px;
    display:flex; flex-direction:column; justify-content:center; gap:24px; box-sizing:border-box; }
  body { transform-origin: top left; }
</style>
</head><body>
<div data-composition-id="${slug}" data-start="0" data-duration="${totalDuration}" data-width="1920" data-height="1080">
  <div id="v-wrap">
    <video id="source-video" data-start="0" data-duration="${totalDuration}" data-track-index="0" data-main-audio data-has-audio="true" src="${mediaDataUrl}" playsinline></video>
  </div>
${sceneHTML}
</div>
<script>
  function fit(){
    var sx = window.innerWidth/1920, sy = window.innerHeight/1080, scale = Math.min(sx, sy);
    document.body.style.transform = 'scale('+scale+')';
  }
  fit(); window.addEventListener('resize', fit);

  window.__timelines = window.__timelines || {};
  var tl = gsap.timeline({ paused: true });
${visJS}
${sceneJS}
${threeInits}
  window.__timelines[${JSON.stringify(slug)}] = tl;
${standalonePlayback}
<\/script>
</body></html>`;
  }

  // ---------------------------------------------------------- 7. compose iframe HTML
  function buildHyperframeHTML(meta, scenes, audioDataUrl, totalDuration, themeId, options = {}) {
    const isRotate = themeId === 'rotate';
    const themeKeys = Object.keys(THEMES);

    // Per-scene theme assignment: rotate cycles all 10 in order, otherwise one theme for all
    const sceneThemes = scenes.map((s, i) =>
      isRotate ? THEMES[themeKeys[i % themeKeys.length]] : getTheme(themeId || meta.theme)
    );
    const T = sceneThemes[0]; // primary theme (body bg, font fallback)

    const slug = (meta.title || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'video';

    // Build each scene block with its assigned theme
    const sceneBlocks = scenes.map((s, i) => (SCENE[s.type] || SCENE['kinetic-text'])(s, sceneThemes[i]));

    // In rotate mode: inline bg + decor per-scene (CSS class only provides layout)
    // In normal mode: inject global decor via regex replace; bg comes from CSS class
    let sceneHTML;
    if (isRotate) {
      sceneHTML = sceneBlocks.map((b, i) => {
        const Ti = sceneThemes[i];
        const bgCss = Ti.bgStyle ? `background:${Ti.bgStyle};` : `background:${Ti.colors.bg};`;
        const extraCss = Ti.signaturePatterns?.sceneBgExtraCss || '';
        const decor = Ti.signaturePatterns?.sceneDecorHTML || '';
        return b.html.replace(
          '<div class="scene-bg"></div>',
          `<div class="scene-bg" style="${bgCss}${extraCss}"></div>${decor}`
        );
      }).join('\n');
    } else {
      const decorHTML = T.signaturePatterns?.sceneDecorHTML || '';
      const rawHTML = sceneBlocks.map(b => b.html).join('\n');
      sceneHTML = decorHTML
        ? rawHTML.replace(/<div class="scene-bg"><\/div>/g, `<div class="scene-bg"></div>${decorHTML}`)
        : rawHTML;
    }
    const sceneJS = sceneBlocks.map(b => b.gsap).join('\n');
    // Three.js init blocks (one per threejs-object scene) — run at page load via RAF
    const threeInits = sceneBlocks.map(b => b.threeInit).filter(Boolean).join('\n');
    const hasThree = threeInits.length > 0;
    // Show each clip only within its time window
    const visJS = scenes.map(s => {
      const endTime = +(s.startTime + s.duration).toFixed(3);
      return `tl.set('#s${s.id}',{opacity:1},${s.startTime});\ntl.set('#s${s.id}',{opacity:0},${endTime});`;
    }).join('\n');
    // Font links: all themes in rotate mode, single theme otherwise
    const fontLink = isRotate
      ? [...new Set(Object.values(THEMES).map(t => t.typography.googleFonts).filter(Boolean))]
          .map(u => `<link rel="stylesheet" href="${u}">`).join('\n')
      : (T.typography.googleFonts ? `<link rel="stylesheet" href="${T.typography.googleFonts}">` : '');
    // .scene-bg CSS: rotate mode omits bg (applied inline per-scene above); normal mode uses global bg
    const sceneBgCss = isRotate ? '' : (T.bgStyle ? `background:${T.bgStyle};` : `background:${T.colors.bg};`);
    const sceneBgExtraCss = isRotate ? '' : (T.signaturePatterns?.sceneBgExtraCss || '');
    const standalonePlayback = options.standalone ? `
  var au = document.getElementById('main-audio');
  au.controls = true;
  function start(){ au.play().catch(function(){}); tl.play(au.currentTime || 0); }
  au.addEventListener('timeupdate', function(){
    if (Math.abs(tl.time() - au.currentTime) > 0.12) tl.time(au.currentTime);
  });
  au.addEventListener('click', start);
  window.addEventListener('pointerdown', start, true);
  document.body.addEventListener('click', start);
` : `
  // HyperFrames owns media playback — no imperative play/pause here
`;

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=1920, height=1080">
${fontLink}
${hasThree ? '<script src="https://cdn.jsdelivr.net/npm/three@0.173.0/build/three.min.js"><\/script>\n' : ''}<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"><\/script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1920px; height:1080px; overflow:hidden; background:${T.colors.bg}; }
  [data-composition-id] { position:absolute; inset:0; overflow:hidden; }
  .clip { position:absolute; inset:0; opacity:0; }
  .scene-bg { position:absolute; inset:0; ${sceneBgCss}${sceneBgExtraCss} }
  .scene-content { position:relative; width:100%; height:100%; padding:120px 160px;
    display:flex; flex-direction:column; justify-content:center; gap:24px; box-sizing:border-box; }
  body { transform-origin: top left; }
</style>
</head><body>
<div data-composition-id="${slug}" data-start="0" data-duration="${totalDuration}" data-width="1920" data-height="1080">
  <audio id="main-audio" data-start="0" data-duration="${totalDuration}" data-main-audio src="${audioDataUrl}"></audio>
${sceneHTML}
</div>
<script>
  // Auto-fit to iframe size
  function fit(){
    var sx = window.innerWidth/1920, sy = window.innerHeight/1080, s = Math.min(sx, sy);
    document.body.style.transform = 'scale('+s+')';
  }
  fit(); window.addEventListener('resize', fit);

  window.__timelines = window.__timelines || {};
  var tl = gsap.timeline({ paused: true });
${visJS}
${sceneJS}
${threeInits}
  window.__timelines[${JSON.stringify(slug)}] = tl;
${standalonePlayback}
<\/script>
</body></html>`;
  }

  // ---------------------------------------------------------- 8. inject into deck
  function injectIntoDeck(meta, hyperframeHTML) {
    const VB = window.VisualBuilder;
    if (!VB) throw new Error('VisualBuilder not available');

    // Build a markdown slide containing one HyperFrame element. We append it
    // by re-emitting the whole deck through loadFromMarkdown so that all
    // existing wiring (parser, renderer, exporter) handles it the same way
    // as any other deck.
    const currentMd = VB.toMarkdown ? VB.toMarkdown() : '';
    const safeHtml = hyperframeHTML; // markdown preserved verbatim inside our hidden div
    const newSlide = `\n\n---\n\n# ${meta.title}\n\n<!-- el:hyperframe w=1280 h=720 -->\n<div class="el-hyperframe-src" style="display:none">\n${safeHtml}\n</div>\n\n_Click the slide preview to start the video._\n`;
    const merged = (currentMd || '').replace(/\s+$/, '') + newSlide;
    VB.loadFromMarkdown(merged);
    if (typeof window.__app_fullRefresh === 'function') window.__app_fullRefresh();
  }

  // ---------------------------------------------------------- 9. main entrypoint
  async function run({ scriptText, voice, refAudioFile, server, onProgress, signal, themeId, workflow, catalogFile }) {
    onProgress?.('Parsing script…');
    const { meta, sentences } = parseScript(scriptText);
    if (sentences.length < 2) throw new Error('Need at least 2 sentences. Got ' + sentences.length);
    if (voice) meta.voice = voice;
    if (themeId && themeId !== 'auto') meta.theme = themeId;

    let wavBlob;
    let sourceFileName = '';
    let mediaKind = 'audio';
    if (workflow === 'catalog-showcase' || workflow === 'talking-cut') {
      if (!catalogFile) throw new Error(`${workflow === 'talking-cut' ? 'Talking-cut' : 'Catalog showcase'} mode needs an audio or video file.`);
      if (workflow === 'talking-cut' && !/^video\//i.test(catalogFile.type || '')) {
        throw new Error('Talking-cut mode needs a video file so the face-cam can remain visible under the cutaways.');
      }
      onProgress?.(`Using provided file: ${catalogFile.name}…`);
      wavBlob = catalogFile;
      sourceFileName = catalogFile.name || '';
      mediaKind = /^video\//i.test(catalogFile.type || '') ? 'video' : 'audio';
    } else {
      onProgress?.(`Synthesizing ${sentences.length} sentences (~${scriptText.length} chars)…`);
      const fullText = sentences.join(' ');
      wavBlob = await ttsViaOmniVoice({
        text: fullText,
        voice: meta.voice,
        refAudioFile,
        refText: meta.ref_text,
        server,
        onProgress,
        signal,
      });
    }

    onProgress?.('Measuring audio…');
    const totalDuration = await audioDuration(wavBlob);

    onProgress?.('Estimating per-sentence timings…');
    const timed = estimateTimings(sentences, totalDuration);

    onProgress?.('Assigning scene types…');
    const scenes = assignSceneTypes(timed);

    // Blob URL for live deck preview — no base64 conversion, works same-origin in iframes
    const mediaBlobUrl = URL.createObjectURL(wavBlob);

    const slug = (meta.title || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const htmlFileName = `${slug || 'script-video'}-hyperframes-index.html`;
    // Relative asset path for the exported HTML (HyperFrames CLI compatible — no inline data URLs)
    const assetFileName = mediaKind === 'video'
      ? sanitizeExportFileName(sourceFileName, `${slug || 'script-video'}-source-video`, 'mp4')
      : `${slug || 'script-video'}-audio.wav`;
    const assetPath = `assets/${assetFileName}`;

    let finalScenes = scenes;
    let html;
    let previewHtml;
    if (workflow === 'talking-cut') {
      onProgress?.(`Scheduling talking-cut graphic overlays (theme: ${meta.theme})…`);
      finalScenes = scheduleTalkingCutScenes(scenes, totalDuration);
      // Deck preview uses blob URL; exported HTML uses relative asset path
      injectIntoDeck(meta, buildTalkingCutHTML(meta, finalScenes, mediaBlobUrl, totalDuration, meta.theme, { standalone: true }));
      html = sanitizeExportHtml(buildTalkingCutHTML(meta, finalScenes, assetPath, totalDuration, meta.theme));
      previewHtml = sanitizeExportHtml(buildTalkingCutHTML(meta, finalScenes, assetPath, totalDuration, meta.theme, { standalone: true }));
    } else {
      onProgress?.(`Building HyperFrame composition (theme: ${meta.theme})…`);
      injectIntoDeck(meta, buildHyperframeHTML(meta, scenes, mediaBlobUrl, totalDuration, meta.theme, { standalone: true }));
      html = sanitizeExportHtml(buildHyperframeHTML(meta, scenes, assetPath, totalDuration, meta.theme));
      previewHtml = sanitizeExportHtml(buildHyperframeHTML(meta, scenes, assetPath, totalDuration, meta.theme, { standalone: true }));
    }

    onProgress?.(`Done — ${finalScenes.length} scenes, ${totalDuration.toFixed(1)}s.`);
    return {
      slug,
      scenes: finalScenes, totalDuration, wavBlob, audioBlobUrl: mediaBlobUrl,
      html, previewHtml, workflow, mediaKind, sourceFileName, assetFileName, htmlFileName,
    };
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('FileReader failed'));
      r.readAsDataURL(blob);
    });
  }

  window.ScriptToVideo = { run, parseScript, assignSceneTypes, estimateTimings, THEMES };
})();
