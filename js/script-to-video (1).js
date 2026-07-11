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
  const SUPPORTED_SCENE_TYPES = [
    'title-card', 'kinetic-impact', 'kinetic-slam', 'kinetic-text', 'callout',
    'quote-card', 'stat-reveal', 'counter-up', 'progress-ring', 'list-reveal',
    'flow-steps', 'comparison', 'split-layout', 'icon-grid', 'cta-callout', 'outro-card',
  ];
  const SCENE_FALLBACKS = {
    'bar-chart': 'stat-reveal',
    'donut-chart': 'progress-ring',
    'line-chart': 'stat-reveal',
    'product-comparison': 'comparison',
    'comparison-verdict': 'comparison',
    'flow-steps-text': 'flow-steps',
    'list-reveal-words': 'list-reveal',
    'split-screen': 'split-layout',
    'doodle-split': 'split-layout',
    'threejs-object': 'split-layout',
    'canvas2d-scene': 'callout',
    'pexels-hero': 'split-layout',
    'presenter-aside': 'split-layout',
    'hud-overlay': 'split-layout',
  };

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

  async function planWithOpenAI({ scriptText, parsed, ai, onProgress }) {
    if (!ai || ai.provider !== 'openai') return null;
    const apiBase = (ai.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = ai.model || 'gpt-4o-mini';
    if (/api\.openai\.com\/v1$/i.test(apiBase) && !ai.apiKey) {
      throw new Error('OpenAI planner needs an API key, or use a local OpenAI-compatible proxy URL.');
    }

    onProgress?.(`Planning storyboard with ${model}…`);
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ai.apiKey ? { authorization: `Bearer ${ai.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        messages: [
          {
            role: 'system',
            content: [
              'You plan short HyperFrames-style script-to-video storyboards.',
              'Return strict JSON only. Do not include markdown.',
              'Use only these scene types: ' + SUPPORTED_SCENE_TYPES.join(', ') + '.',
              'One sentence equals one scene. First scene must be title-card; last scene must be outro-card.',
              'No two adjacent scenes may share a type. Keep narration natural for TTS.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'Create a title, narration, and scene plan for this script-to-video input.',
              rewriteAllowed: !!ai.rewrite,
              existingTitle: parsed.meta.title || '',
              input: scriptText,
              outputShape: {
                title: 'short title',
                theme: 'shadow-cut',
                narration: 'clean narration text; preserve meaning',
                scenes: [
                  { sentence: 'one complete spoken sentence', type: 'title-card', note: 'brief reason' },
                ],
              },
            }),
          },
        ],
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenAI planner failed: HTTP ${response.status} ${text.slice(0, 180)}`.trim());
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI planner returned no message content.');
    const plan = parseJsonObject(content);
    if (!Array.isArray(plan.scenes) || plan.scenes.length < 2) {
      throw new Error('OpenAI planner returned an invalid storyboard.');
    }
    return normalizePlan(plan, parsed);
  }

  function parseJsonObject(text) {
    const trimmed = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('Planner response did not contain JSON.');
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  function normalizePlan(plan, parsed) {
    const scenes = plan.scenes
      .map((scene, index) => ({
        sentence: String(scene.sentence || '').replace(/\s+/g, ' ').trim(),
        type: normalizeSceneType(scene.type, index, plan.scenes.length),
        note: String(scene.note || '').trim(),
      }))
      .filter(scene => scene.sentence);
    if (scenes.length >= 1) scenes[0].type = 'title-card';
    if (scenes.length >= 2) scenes[scenes.length - 1].type = 'outro-card';
    for (let i = 1; i < scenes.length; i += 1) {
      if (scenes[i].type === scenes[i - 1].type) scenes[i].type = nextBestType(scenes[i].type);
    }
    return {
      meta: {
        ...parsed.meta,
        title: String(plan.title || parsed.meta.title || '').trim() || parsed.meta.title,
        theme: String(plan.theme || parsed.meta.theme || 'shadow-cut').trim() || 'shadow-cut',
      },
      scenes,
    };
  }

  function normalizeSceneType(type, index, count) {
    if (index === 0) return 'title-card';
    if (index === count - 1) return 'outro-card';
    const raw = String(type || '').trim().toLowerCase();
    const mapped = SUPPORTED_SCENE_TYPES.includes(raw) ? raw : SCENE_FALLBACKS[raw];
    return mapped || 'kinetic-text';
  }

  function nextBestType(type) {
    const fallbacks = ['kinetic-text', 'callout', 'split-layout', 'quote-card', 'icon-grid', 'stat-reveal'];
    return fallbacks.find(candidate => candidate !== type) || 'kinetic-text';
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
      else if (/\b(click|download|try|start|install|watch|subscribe|link)\b/i.test(s)) type = 'cta-callout';
      else if (/\b\d+(\.\d+)?\s*%/.test(s)) type = 'progress-ring';
      else if (/\b\d+(\.\d+)?\b/.test(s) && /\b(up|grow|increase|count|total|million|thousand|x)\b/i.test(s)) type = 'counter-up';
      else if (/\b\d+(\.\d+)?\b/.test(s)) type = 'stat-reveal';
      else if (/^["“]/.test(s) || /\bsaid\b|\bsays\b/.test(s)) type = 'quote-card';
      else if (/\bvs\.?\b|\bcompared to\b|\bversus\b/i.test(s)) type = 'comparison';
      else if (/(\w+,\s*\w+,\s*(?:and\s+)?\w+)/.test(s)) type = 'list-reveal';
      else if (/\bfirst\b.*\bsecond\b|\bthen\b.*\bfinally\b|\bstep\b/i.test(s)) type = 'flow-steps';
      else if (/\b(agent|browser|render|framework|format|html|css|javascript|timeline|video|mp4)\b/i.test(s)) type = 'split-layout';
      else if (/\b(all|many|multiple|every|features|tools|capabilities)\b/i.test(s)) type = 'icon-grid';
      else if (s.length <= 24) type = 'kinetic-slam';
      else if (/\b(but|suddenly|because|therefore|so)\b/i.test(s)) type = 'kinetic-impact';
      else type = (i % 2 === 0) ? 'kinetic-text' : 'callout';
      // No-repeat rule
      if (out.length && out[out.length - 1].type === type) {
        type = nextBestType(type);
      }
      out.push({ ...it, id: i + 1, type });
    });
    return out;
  }

  function applyScenePlan(timed, plannedScenes) {
    return timed.map((item, index) => {
      const planned = plannedScenes?.[index] || {};
      let type = normalizeSceneType(planned.type, index, timed.length);
      if (index > 0 && plannedScenes?.[index - 1] && type === normalizeSceneType(plannedScenes[index - 1].type, index - 1, timed.length)) {
        type = nextBestType(type);
      }
      return { ...item, sentence: planned.sentence || item.sentence, id: index + 1, type, note: planned.note || '' };
    });
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
    'kinetic-impact': (s) => {
      const parts = splitImpact(s.sentence);
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:flex-start;justify-content:center;gap:22px;">
    <div id="s${s.id}-ki1" style="font-family:Outfit,sans-serif;font-weight:400;font-size:42px;color:#8899aa;">${esc(parts.pre)}</div>
    <div id="s${s.id}-ki2" style="font-family:Outfit,sans-serif;font-weight:900;font-size:112px;color:#e2e2e2;line-height:.98;">${esc(parts.main)}</div>
    <div id="s${s.id}-ki3" style="font-family:Outfit,sans-serif;font-weight:900;font-size:154px;color:#c0392b;line-height:.9;">${esc(parts.slam)}</div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-ki1',{y:40,opacity:0,duration:0.45,ease:'power2.out'},${s.startTime}+0.15);
tl.from('#s${s.id}-ki2',{y:80,opacity:0,duration:0.55,ease:'back.out(2)'},${s.startTime}+0.65);
tl.from('#s${s.id}-ki3',{y:100,opacity:0,scale:0.85,duration:0.5,ease:'back.out(2.5)'},${s.startTime}+1.15);`,
      };
    },
    'kinetic-slam': (s) => ({
      html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:center;justify-content:center;text-align:center;">
    <div id="s${s.id}-slam" style="font-family:Outfit,sans-serif;font-weight:900;font-size:210px;color:#e2e2e2;line-height:.95;">${esc(s.sentence)}</div>
  </div>
</div>`,
      gsap: `tl.fromTo('#s${s.id}-slam',{opacity:0,scale:0.7},{opacity:1,scale:1,duration:0.24,ease:'back.out(3)'},${s.startTime}+0.04);`,
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
    'counter-up': (s) => {
      const num = parseFloat((s.sentence.match(/\d+(?:\.\d+)?/) || ['100'])[0]);
      const label = s.sentence.replace(String(num), '').replace(/[%.]/g, '').trim().toUpperCase().slice(0, 56) || 'TOTAL';
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:center;text-align:center;">
    <div id="s${s.id}-counter" style="font-family:Outfit,sans-serif;font-weight:900;font-size:180px;color:#e2e2e2;font-variant-numeric:tabular-nums;">0</div>
    <div id="s${s.id}-clabel" style="font-family:Outfit,sans-serif;font-size:46px;color:#8899aa;letter-spacing:.06em;">${esc(label)}</div>
  </div>
</div>`,
        gsap: `var c${s.id}={val:0};
tl.to(c${s.id},{val:${Number.isFinite(num) ? num : 100},duration:${Math.max(0.7, s.duration * 0.65).toFixed(2)},ease:'power1.inOut',onUpdate:function(){var el=document.getElementById('s${s.id}-counter'); if(el) el.textContent=Math.round(c${s.id}.val).toLocaleString();}},${s.startTime}+0.2);
tl.from('#s${s.id}-clabel',{y:30,opacity:0,duration:0.4,ease:'power2.out'},${s.startTime}+0.35);`,
      };
    },
    'progress-ring': (s) => {
      const pct = Math.max(1, Math.min(100, parseFloat((s.sentence.match(/\d+(?:\.\d+)?/) || ['72'])[0])));
      const label = s.sentence.replace(/[\d.]+\s*%?/, '').replace(/[.]/g, '').trim() || 'progress';
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:center;text-align:center;">
    <div id="s${s.id}-prhead" style="font-family:Outfit,sans-serif;font-size:48px;color:#8899aa;margin-bottom:36px;">${esc(label)}</div>
    <div style="position:relative;width:390px;height:390px;">
      <svg width="390" height="390" viewBox="0 0 400 400"><circle cx="200" cy="200" r="160" fill="none" stroke="#1a1a1a" stroke-width="22"/><circle id="s${s.id}-ring" cx="200" cy="200" r="160" fill="none" stroke="#c0392b" stroke-width="22" stroke-dasharray="1005" stroke-dashoffset="1005" stroke-linecap="round" transform="rotate(-90 200 200)"/></svg>
      <div id="s${s.id}-rpct" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:Outfit,sans-serif;font-weight:900;font-size:88px;color:#e2e2e2;">0%</div>
    </div>
  </div>
</div>`,
        gsap: `var r${s.id}={pct:0};
tl.from('#s${s.id}-prhead',{y:-30,opacity:0,duration:0.45,ease:'power2.out'},${s.startTime}+0.15);
tl.to(r${s.id},{pct:${pct},duration:1.0,ease:'power2.inOut',onUpdate:function(){var el=document.getElementById('s${s.id}-rpct');var ring=document.getElementById('s${s.id}-ring'); if(el) el.textContent=Math.round(r${s.id}.pct)+'%'; if(ring) ring.setAttribute('stroke-dashoffset',String(1005*(1-r${s.id}.pct/100)));}},${s.startTime}+0.35);`,
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
    'split-layout': (s) => ({
      html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="flex-direction:row;align-items:center;gap:80px;">
    <div id="s${s.id}-left" style="flex:1;display:flex;flex-direction:column;gap:22px;">
      <div style="font-family:Outfit,sans-serif;font-size:24px;font-weight:700;letter-spacing:6px;color:#c0392b;text-transform:uppercase;">COMPOSE</div>
      <div style="font-family:Outfit,sans-serif;font-weight:900;font-size:82px;color:#e2e2e2;line-height:1.08;">${esc(s.sentence)}</div>
    </div>
    <div id="s${s.id}-div" style="width:4px;height:0;background:#c0392b;border-radius:2px;flex-shrink:0;"></div>
    <div id="s${s.id}-right" style="flex:1;display:flex;align-items:center;justify-content:center;font-size:210px;line-height:1;color:#c0392b;">${pickGlyph(s.sentence)}</div>
  </div>
</div>`,
      gsap: `tl.from('#s${s.id}-left',{x:-60,opacity:0,duration:0.65,ease:'expo.out'},${s.startTime}+0.2);
tl.to('#s${s.id}-div',{height:'420px',duration:0.5,ease:'power2.inOut'},${s.startTime}+0.45);
tl.from('#s${s.id}-right',{x:60,opacity:0,scale:0.85,duration:0.65,ease:'expo.out'},${s.startTime}+0.6);`,
    }),
    'icon-grid': (s) => {
      const words = keywords(s.sentence, 4);
      const cards = words.map((word, i) => `<div id="s${s.id}-ic${i}" style="background:#111;border:1px solid #222;border-radius:16px;padding:38px 24px;display:flex;flex-direction:column;align-items:center;gap:14px;"><div style="font-size:76px;color:#c0392b;line-height:1;">${['◆','✦','▲','◈'][i % 4]}</div><div style="font-family:Outfit,sans-serif;font-weight:800;font-size:34px;color:#e2e2e2;text-align:center;">${esc(word)}</div></div>`).join('');
      return {
        html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content">
    <div id="s${s.id}-ighead" style="font-family:Outfit,sans-serif;font-weight:900;font-size:72px;color:#e2e2e2;margin-bottom:34px;">${esc(shortText(s.sentence, 56))}</div>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(4, words.length)},1fr);gap:28px;">${cards}</div>
  </div>
</div>`,
        gsap: `tl.from('#s${s.id}-ighead',{y:-40,opacity:0,duration:0.55,ease:'power3.out'},${s.startTime}+0.1);
tl.from('#s${s.id} [id^="s${s.id}-ic"]',{y:60,opacity:0,scale:0.9,duration:0.5,ease:'back.out(1.8)',stagger:{each:0.15,from:'start'}},${s.startTime}+0.4);`,
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
    'cta-callout': (s) => ({
      html: `<div id="s${s.id}" class="clip" data-start="${s.startTime}" data-duration="${s.duration}" data-track-index="1">
  <div class="scene-bg"></div>
  <div class="scene-content" style="align-items:center;text-align:center;">
    <div id="s${s.id}-ctapre" style="font-size:28px;font-weight:700;letter-spacing:4px;color:#6b7280;text-transform:uppercase;margin-bottom:16px;">NEXT STEP</div>
    <div id="s${s.id}-ctamain" style="font-family:Outfit,sans-serif;font-weight:900;font-size:72px;color:#e2e2e2;max-width:1300px;line-height:1.2;">${esc(s.sentence)}</div>
    <div id="s${s.id}-ctabox" style="display:inline-flex;align-items:center;gap:22px;margin-top:40px;border:3px solid #c0392b;padding:20px 44px;"><span id="s${s.id}-ctaarr" style="font-size:56px;color:#c0392b;display:inline-block;">↓</span><span style="font-family:Outfit,sans-serif;font-weight:900;font-size:36px;color:#e2e2e2;letter-spacing:3px;">TRY IT</span></div>
  </div>
</div>`,
      gsap: `tl.from('#s${s.id}-ctapre',{y:-20,opacity:0,duration:0.35},${s.startTime}+0.2);
tl.from('#s${s.id}-ctamain',{y:30,opacity:0,duration:0.5,ease:'power2.out'},${s.startTime}+0.55);
tl.from('#s${s.id}-ctabox',{scale:0.85,opacity:0,duration:0.4,ease:'back.out(1.5)'},${s.startTime}+1.15);
tl.to('#s${s.id}-ctaarr',{y:12,duration:0.35,ease:'sine.inOut',yoyo:true,repeat:5},${s.startTime}+1.55);`,
    }),
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

  function splitImpact(sentence) {
    const words = String(sentence || '').split(/\s+/).filter(Boolean);
    if (words.length <= 4) return { pre: 'the point is', main: words.slice(0, -1).join(' ') || sentence, slam: words.slice(-1).join(' ') };
    const pivot = Math.max(2, Math.floor(words.length * 0.45));
    return {
      pre: words.slice(0, pivot).join(' '),
      main: words.slice(pivot, Math.max(pivot + 1, words.length - 2)).join(' '),
      slam: words.slice(-2).join(' '),
    };
  }

  function pickGlyph(sentence) {
    const s = String(sentence || '').toLowerCase();
    if (/html|code|browser|javascript|css/.test(s)) return '&lt;/&gt;';
    if (/video|mp4|render|frame/.test(s)) return '▶';
    if (/agent|ai|automation/.test(s)) return '✦';
    if (/timeline|flow|process/.test(s)) return '→';
    return '◆';
  }

  function keywords(sentence, max) {
    const stop = new Set('the a an and or but of to in for with from your you it is are can now every into this that as by on'.split(' '));
    const words = String(sentence || '')
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .map(word => word.trim())
      .filter(word => word.length > 2 && !stop.has(word.toLowerCase()));
    const unique = [...new Set(words)].slice(0, max);
    return unique.length ? unique : ['HTML', 'Motion', 'Audio', 'MP4'].slice(0, max);
  }

  function shortText(sentence, max) {
    const text = String(sentence || '').trim();
    return text.length > max ? text.slice(0, max - 1).trim() + '…' : text;
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
  async function run({ scriptText, voice, refAudioFile, server, ai, onProgress }) {
    onProgress?.('Parsing script…');
    const parsed = parseScript(scriptText);
    let { meta, sentences } = parsed;
    let plannedScenes = null;
    if (sentences.length < 2 && ai?.provider !== 'openai') throw new Error('Need at least 2 sentences. Got ' + sentences.length);
    if (voice) meta.voice = voice;

    if (ai?.provider === 'openai') {
      const plan = await planWithOpenAI({ scriptText, parsed, ai, onProgress });
      if (plan?.scenes?.length >= 2) {
        meta = { ...meta, ...plan.meta, voice: meta.voice };
        plannedScenes = plan.scenes;
        sentences = plannedScenes.map(scene => scene.sentence);
        onProgress?.(`AI planner selected ${plannedScenes.length} scenes: ${plannedScenes.map(scene => scene.type).join(', ')}`);
      }
    }
    if (sentences.length < 2) throw new Error('Need at least 2 sentences. Got ' + sentences.length);

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
    const scenes = plannedScenes ? applyScenePlan(timed, plannedScenes) : assignSceneTypes(timed);

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

  window.ScriptToVideo = { run, parseScript, assignSceneTypes, estimateTimings, planWithOpenAI, supportedSceneTypes: SUPPORTED_SCENE_TYPES };
})();
