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
 *     theme: shadow-cut          # visual identity (only "shadow-cut" implemented)
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

  async function predictViaLocalGradio(target, apiName, args) {
    const base = target.replace(/\/+$/, '');
    const endpoint = apiName.replace(/^\//, '');
    const post = await fetch(`${base}/gradio_api/call/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: args }),
    });
    if (!post.ok) throw new Error(`OmniVoice call failed: HTTP ${post.status}`);

    const body = await post.json();
    if (!body?.event_id) throw new Error('OmniVoice returned no event id');

    const stream = await fetch(`${base}/gradio_api/call/${endpoint}/${body.event_id}`);
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
  async function ttsViaOmniVoice({ text, voice, refAudioFile, refText, server, onProgress }) {
    const target = (server && server.trim()) || OMNIVOICE_SPACE;
    const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\/?/i.test(target);
    const steps = isLocalTarget ? 4 : 32;
    const duration = null;

    const cloneArgs = [
      text, 'Auto', refAudioFile, refText || '', '', steps, 2.0, true, 1.0, duration, true, true,
    ];
    const designArgs = [
      text, 'Auto', steps, 2.0, true, 1.0, duration, true, true,
      'Auto', 'Auto', 'Auto', 'Auto', 'Auto', 'Auto',
    ];
    const randomArgs = {
      text, language: 'Auto',
      instruct: '', ns: steps, gs: 2.0, dn: true, sp: 1.0, du: duration,
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
      result = await predictViaLocalGradio(target, '/_design_fn', designArgs);
    } else {
      onProgress?.('Loading OmniVoice client…');
      const mod = await loadGradio();
      const Client = mod.Client || mod.default?.Client || mod.default;
      if (!Client) throw new Error('@gradio/client did not expose Client');

      onProgress?.(`Connecting to ${target}…`);
      const app = await Client.connect(target);
      onProgress?.('Synthesizing audio (this can take 10-60s on free tier)…');

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
    const r = await fetch(audioRef);
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

  // ---------------------------------------------------------- 6. scene HTML/JS templates
  // Each renderer returns { html, gsap } where {{ID}}/{{T}}/{{D}}/{{TEXT}} are
  // template tokens replaced by buildHyperframeHTML. All templates use the
  // shadow-cut palette (#0a0a0a bg, #e2e2e2 text, #c0392b accent).
  const SCENE = {
    'title-card': (s) => ({
      html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:center;text-align:center;">
    <h1 id="s${s.id}-t" style="font-family:Outfit,sans-serif;font-weight:900;font-size:130px;color:#e2e2e2;line-height:1.05;">${esc(s.sentence)}</h1>
    <div id="s${s.id}-bar" style="width:0px;height:6px;background:#c0392b;margin-top:36px;"></div>
  </div>
</div>`,
      gsap: `tl.from('#s${s.id}-t',{y:60,opacity:0,duration:0.7,ease:'power3.out'},${s.startTime}+0.2);
tl.to('#s${s.id}-bar',{width:'320px',duration:0.7,ease:'power2.inOut'},${s.startTime}+0.6);`,
    }),
    'kinetic-text': (s) => ({
      html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:flex-start;">
    <div id="s${s.id}-k" style="font-family:Outfit,sans-serif;font-weight:900;font-size:88px;color:#e2e2e2;line-height:1.1;max-width:1500px;">${splitWords(s.sentence, s.id)}</div>
  </div>
</div>`,
      gsap: `tl.from('#s${s.id}-k .kw',{y:80,opacity:0,duration:0.45,ease:'power3.out',stagger:{each:0.06,from:'start'}},${s.startTime}+0.1);`,
    }),
    'callout': (s) => ({
      html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:center;text-align:center;">
    <div id="s${s.id}-c" style="font-family:Outfit,sans-serif;font-weight:900;font-size:104px;color:#e2e2e2;max-width:1400px;line-height:1.15;">${esc(s.sentence)}</div>
  </div>
</div>`,
      gsap: `tl.fromTo('#s${s.id}-c',{scale:0.85,opacity:0},{scale:1,opacity:1,duration:0.6,ease:'back.out(1.5)'},${s.startTime}+0.1);`,
    }),
    'stat-reveal': (s) => {
      const num = (s.sentence.match(/\d+(?:\.\d+)?/) || ['0'])[0];
      const label = s.sentence.replace(num, '').replace(/[%.]/g, '').trim().toUpperCase().slice(0, 60);
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:center;text-align:center;">
    <div id="s${s.id}-num" style="font-family:Outfit,sans-serif;font-weight:900;font-size:200px;color:#e2e2e2;line-height:1;">${esc(num)}<span style="color:#c0392b;">%</span></div>
    <div id="s${s.id}-lbl" style="font-family:Outfit,sans-serif;font-weight:500;font-size:42px;color:#8899aa;letter-spacing:0.08em;margin-top:24px;">${esc(label)}</div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-num',{scale:0.6,opacity:0,duration:0.6,ease:'back.out(2)'},${s.startTime}+0.15);
tl.from('#s${s.id}-lbl',{y:30,opacity:0,duration:0.4,ease:'power2.out'},${s.startTime}+0.55);`,
      };
    },
    'quote-card': (s) => ({
      html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:flex-start;justify-content:center;">
    <div id="s${s.id}-q" style="background:#111;padding:60px 80px;border-left:8px solid #c0392b;max-width:1400px;position:relative;">
      <div style="position:absolute;top:-30px;left:56px;font-family:Outfit,sans-serif;font-size:180px;color:#c0392b;line-height:1;">"</div>
      <blockquote style="font-family:Outfit,sans-serif;font-weight:400;font-size:48px;color:#e2e2e2;line-height:1.5;padding-top:36px;margin:0;">${esc(s.sentence)}</blockquote>
    </div>
  </div>
</div>`,
      gsap: `tl.fromTo('#s${s.id}-q',{opacity:0,y:30},{opacity:1,y:0,duration:0.6,ease:'power2.out'},${s.startTime}+0.15);`,
    }),
    'list-reveal': (s) => {
      const items = s.sentence.split(/[,;]|\band\b/i).map(x => x.trim()).filter(Boolean).slice(0, 5);
      const lis = items.map((t, i) => `<li id="s${s.id}-li${i}" style="font-family:Outfit,sans-serif;font-weight:500;font-size:54px;color:#e2e2e2;display:flex;align-items:center;gap:24px;"><span style="width:14px;height:14px;border-radius:50%;background:#c0392b;flex-shrink:0;"></span>${esc(t)}</li>`).join('');
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
    'comparison': (s) => {
      const parts = s.sentence.split(/\bvs\.?\b|\bversus\b|\bcompared to\b/i);
      const a = (parts[0] || 'Before').trim().slice(0, 60);
      const b = (parts[1] || 'After').trim().slice(0, 60);
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="flex-direction:row;gap:60px;align-items:stretch;">
    <div id="s${s.id}-a" style="flex:1;background:#111;border-radius:16px;padding:60px;border:2px solid #222;display:flex;align-items:center;justify-content:center;">
      <div style="font-family:Outfit,sans-serif;font-weight:700;font-size:46px;color:#8899aa;text-align:center;">${esc(a)}</div>
    </div>
    <div id="s${s.id}-vs" style="align-self:center;font-family:Outfit,sans-serif;font-weight:900;font-size:52px;color:#c0392b;">VS</div>
    <div id="s${s.id}-b" style="flex:1;background:#150909;border-radius:16px;padding:60px;border:2px solid #c0392b;display:flex;align-items:center;justify-content:center;">
      <div style="font-family:Outfit,sans-serif;font-weight:700;font-size:46px;color:#e2e2e2;text-align:center;">${esc(b)}</div>
    </div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-a',{x:-80,opacity:0,duration:0.6,ease:'expo.out'},${s.startTime}+0.2);
tl.from('#s${s.id}-vs',{scale:0.5,opacity:0,duration:0.4,ease:'back.out(3)'},${s.startTime}+0.55);
tl.from('#s${s.id}-b',{x:80,opacity:0,duration:0.6,ease:'expo.out'},${s.startTime}+0.7);`,
      };
    },
    'flow-steps': (s) => {
      const steps = s.sentence.split(/[,;]|\bthen\b|\bfinally\b/i).map(x => x.trim()).filter(Boolean).slice(0, 3);
      while (steps.length < 3) steps.push('—');
      const cells = steps.map((t, i) => `
        <div id="s${s.id}-st${i}" style="background:#111;padding:48px;flex:1;text-align:center;">
          <div style="font-size:52px;font-weight:900;color:#c0392b;margin-bottom:12px;">${i + 1}</div>
          <div style="font-size:30px;font-weight:700;color:#e2e2e2;line-height:1.3;">${esc(t)}</div>
        </div>${i < steps.length - 1 ? `<div id="s${s.id}-arr${i}" style="font-size:60px;color:#6b7280;padding:0 16px;align-self:center;">→</div>` : ''}`).join('');
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
    'outro-card': (s) => ({
      html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:center;text-align:center;gap:28px;">
    <div id="s${s.id}-lbl" style="font-size:22px;font-weight:700;letter-spacing:8px;color:#c0392b;text-transform:uppercase;">THANKS FOR WATCHING</div>
    <div id="s${s.id}-t" style="font-family:Outfit,sans-serif;font-weight:900;font-size:120px;color:#e2e2e2;line-height:1.05;">${esc(s.sentence)}</div>
    <div id="s${s.id}-rule" style="width:0px;height:3px;background:#c0392b;"></div>
  </div>
</div>`,
      gsap: `tl.from('#s${s.id}-lbl',{y:-20,opacity:0,duration:0.4,ease:'power2.out'},${s.startTime}+0.2);
tl.from('#s${s.id}-t',{y:60,opacity:0,duration:0.7,ease:'power3.out'},${s.startTime}+0.45);
tl.to('#s${s.id}-rule',{width:'280px',duration:0.7,ease:'power2.inOut'},${s.startTime}+0.95);`,
    }),
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
  function buildHyperframeHTML(meta, scenes, audioDataUrl, totalDuration) {
    const slug = (meta.title || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'video';
    const sceneBlocks = scenes.map(s => SCENE[s.type]?.(s) || SCENE['kinetic-text'](s));
    const sceneHTML = sceneBlocks.map(b => b.html).join('\n');
    const sceneJS = sceneBlocks.map(b => b.gsap).join('\n');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=1920, height=1080">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"><\/script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1920px; height:1080px; overflow:hidden; background:#000; }
  [data-composition-id] { position:absolute; inset:0; overflow:hidden; }
  .clip { position:absolute; inset:0; }
  .scene-bg { position:absolute; inset:0; background:#0a0a0a; }
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
  async function run({ scriptText, voice, refAudioFile, server, onProgress }) {
    onProgress?.('Parsing script…');
    const { meta, sentences } = parseScript(scriptText);
    if (sentences.length < 2) throw new Error('Need at least 2 sentences. Got ' + sentences.length);
    if (voice) meta.voice = voice;

    onProgress?.(`Synthesizing ${sentences.length} sentences (~${scriptText.length} chars)…`);
    const fullText = sentences.join(' ');
    const wavBlob = await ttsViaOmniVoice({
      text: fullText,
      voice: meta.voice,
      refAudioFile,
      refText: meta.ref_text,
      server,
      onProgress,
    });

    onProgress?.('Measuring audio…');
    const totalDuration = await audioDuration(wavBlob);

    onProgress?.('Estimating per-sentence timings…');
    const timed = estimateTimings(sentences, totalDuration);

    onProgress?.('Assigning scene types…');
    const scenes = assignSceneTypes(timed);

    onProgress?.('Encoding WAV → data URL…');
    const audioDataUrl = await blobToDataURL(wavBlob);
    if (audioDataUrl.length > 4_500_000) {
      console.warn('[script-to-video] audio data URL is', Math.round(audioDataUrl.length / 1024), 'KB — localStorage may overflow.');
    }

    onProgress?.('Building HyperFrame composition…');
    const html = buildHyperframeHTML(meta, scenes, audioDataUrl, totalDuration);

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

  window.ScriptToVideo = { run, parseScript, assignSceneTypes, estimateTimings };
})();
