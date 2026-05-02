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
  // Based on type-assignment rules from script-to-video-skill SKILL.md
  function assignSceneTypes(items) {
    const out = [];
    items.forEach((it, i) => {
      const s = it.sentence;
      let type;
      if (i === 0) type = 'title-card';
      else if (i === items.length - 1) type = 'outro-card';
      else if (/\b\d+(\.\d+)?\s*%/.test(s)) type = 'stat-reveal';
      else if (/^["“]/.test(s) || /\bsaid\b|\bsays\b/.test(s)) type = 'quote-card';
      else if (/\bvs\.?\b|\bcompared to\b|\bversus\b/i.test(s)) type = 'comparison';
      else if (/(\w+,\s*\w+,\s*(?:and\s+)?\w+)/.test(s)) type = 'list-reveal';
      else if (/\bfirst\b.*\bsecond\b|\bthen\b.*\bfinally\b|\bstep\b/i.test(s)) type = 'flow-steps';
      else type = (i % 2 === 0) ? 'kinetic-text' : 'callout';
      // No-repeat rule
      if (out.length && out[out.length - 1].type === type) {
        const fallbacks = ['kinetic-text', 'callout', 'stat-reveal', 'quote-card'];
        type = fallbacks.find(f => f !== type) || type;
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
  <div class="scene-content" style="align-items:flex-start;justify-content:center;">
    <div id="s${s.id}-q" style="${surfaceStyle}padding:60px 80px;border-left:8px solid ${T.colors.accent};max-width:1400px;position:relative;">
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
  };

  function splitWords(text, sceneId) {
    return text.split(/\s+/).map(w => `<span class="kw">${esc(w)}</span>`).join(' ');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---------------------------------------------------------- 7. compose iframe HTML
  function buildHyperframeHTML(meta, scenes, audioDataUrl, totalDuration, themeId) {
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

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=1920, height=1080">
${fontLink}
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"><\/script>
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
  <audio id="main-audio" data-start="0" data-duration="${totalDuration}" data-track-index="0" data-main-audio src="${audioDataUrl}"></audio>
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
  window.__timelines[${JSON.stringify(slug)}] = tl;

  // Standalone preview: play audio + timeline together
  var au = document.getElementById('main-audio');
  function start(){ try{ au.play(); }catch(e){} tl.play(); }
  // Click-to-start (browsers block autoplay with audio)
  document.body.addEventListener('click', start, { once:true });
  // Try autoplay anyway (works if iframe was user-activated)
  setTimeout(start, 100);
<\/script>
</body></html>`;
  }

  // ---------------------------------------------------------- 8. inject into deck
  function injectIntoDeck(meta, hyperframeHTML, audioBlobUrl) {
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
    if (workflow === 'catalog-showcase') {
      if (!catalogFile) throw new Error('Catalog showcase mode needs an audio or video file.');
      onProgress?.(`Using provided file: ${catalogFile.name}…`);
      wavBlob = catalogFile;
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

    onProgress?.('Encoding audio → data URL…');
    const audioDataUrl = await blobToDataURL(wavBlob);
    if (audioDataUrl.length > 4_500_000) {
      console.warn('[script-to-video] audio data URL is', Math.round(audioDataUrl.length / 1024), 'KB — localStorage may overflow.');
    }

    onProgress?.(`Building HyperFrame composition (theme: ${meta.theme})…`);
    const html = buildHyperframeHTML(meta, scenes, audioDataUrl, totalDuration, meta.theme);

    onProgress?.('Injecting slide into deck…');
    const audioBlobUrl = URL.createObjectURL(wavBlob);
    injectIntoDeck(meta, html, audioBlobUrl);

    onProgress?.(`Done — ${scenes.length} scenes, ${totalDuration.toFixed(1)}s.`);
    return {
      slug: (meta.title || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      scenes, totalDuration, wavBlob, audioBlobUrl, html,
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
