---
title: Hyperframe Launch Video — Storyboard v3
theme: default
description: 16-beat scaffold of the HeyGen Hyperframe launch video as a slide deck. Each slide carries a HyperFrames-spec composition stub (data-composition-id, paused GSAP timeline on window.__timelines) you can iterate on, then export to npx hyperframes render.
author: hyperframes-launch-video storyboard v3
---

<!-- _class: lead -->

# Hyperframe Launch Video

**Storyboard v3 — 60 seconds, 1920×1080**

> Write HTML. Render video. Built for agents.

Each slide is one beat. The HyperFrame element on each slide is a self-contained composition stub matching the mood direction — duplicate, edit, then export the markup for `npx hyperframes render`.

---

## Beat 1 — Cold Open: Infinite Canvas (0:00–0:05)

**VO:** *"Your AI agent already knows how to make videos."*

Slow diagonal drift over a warm light canvas dotted with living composition cards. No fade-in — camera is already moving when the video starts.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:radial-gradient(circle at 30% 30%,#fbf6ec 0%,#f3ead7 60%,#e8dcc1 100%);
    font-family:"Inter",system-ui,sans-serif;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;}
  .canvas{position:absolute;inset:-200px;
    background-image:radial-gradient(circle,rgba(80,60,30,.18) 1px,transparent 1px);
    background-size:48px 48px;}
  .card{position:absolute;border-radius:18px;background:#fff;
    box-shadow:0 18px 40px rgba(60,40,10,.12),0 2px 6px rgba(60,40,10,.08);
    border:1px solid rgba(80,60,30,.08);overflow:hidden;}
  .card .lbl{position:absolute;left:14px;bottom:10px;font-size:18px;color:#5a4a2a;opacity:.8;}
  .c1{left:120px;top:120px;width:380px;height:240px;transform:rotate(-6deg);background:#ffeb6b;}
  .c2{left:600px;top:80px;width:300px;height:180px;transform:rotate(4deg);
    background:linear-gradient(135deg,#ff7a59,#ffb15a);}
  .c3{left:1050px;top:160px;width:340px;height:220px;transform:rotate(-3deg);background:#e7f3ff;}
  .c4{left:1500px;top:80px;width:300px;height:200px;transform:rotate(8deg);background:#dcf3e6;}
  .c5{left:80px;top:520px;width:320px;height:200px;transform:rotate(7deg);
    background:radial-gradient(circle,#ffd9d4,#ffb1b8);}
  .c6{left:520px;top:480px;width:380px;height:260px;transform:rotate(-4deg);background:#1f2a44;color:#fff;}
  .c7{left:1020px;top:520px;width:340px;height:220px;transform:rotate(5deg);background:#fff7df;}
  .c8{left:1450px;top:560px;width:360px;height:220px;transform:rotate(-7deg);
    background:linear-gradient(45deg,#7ce0ff,#a78bff);}
</style>
<div id="stage">
  <div class="canvas"></div>
  <div class="card c1"><span class="lbl">kinetic type</span></div>
  <div class="card c2"><span class="lbl">gradient morph</span></div>
  <div class="card c3"><span class="lbl">data-viz</span></div>
  <div class="card c4"><span class="lbl">particle field</span></div>
  <div class="card c5"><span class="lbl">logo build</span></div>
  <div class="card c6"><span class="lbl">vector char</span></div>
  <div class="card c7"><span class="lbl">shader noise</span></div>
  <div class="card c8"><span class="lbl">3D orbit</span></div>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  tl.fromTo("#stage",{x:-80,y:-40,rotate:-1.5},{x:80,y:40,rotate:1.5,duration:5,ease:"power1.inOut"},0);
  tl.from(".card",{opacity:0,scale:.85,stagger:.06,duration:.6,ease:"power2.out"},0);
  window.__timelines["canvas-open"]=tl;
  tl.play();
</script>
</div>

---

## Beat 2 — The Format (0:05–0:09)

**VO:** *"It just needs the right format. [pause] This is Hyperframe."*

Camera settles into one card; its border dissolves and the contents fill the viewport. We're now *inside* a composition.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:linear-gradient(180deg,#fbf6ec,#f6efde);font-family:"Inter",system-ui,sans-serif;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;
    display:flex;align-items:center;justify-content:center;}
  .word{font-size:220px;font-weight:600;letter-spacing:-.04em;color:#1a1a1a;}
  .border{position:absolute;left:330px;top:330px;right:330px;bottom:330px;
    border-radius:24px;border:2px solid rgba(60,40,10,.18);
    box-shadow:0 30px 80px rgba(60,40,10,.10);}
</style>
<div id="stage">
  <div class="border"></div>
  <span class="word">Hyperframe</span>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  tl.from(".border",{opacity:0,scale:.92,duration:1,ease:"power2.out"},0)
    .to(".border",{opacity:0,scale:1.6,duration:.8,ease:"power2.inOut"},1.5)
    .from(".word",{opacity:0,y:24,duration:1,ease:"power2.out"},1.8);
  window.__timelines["canvas-zoom"]=tl;
  tl.play();
</script>
</div>

---

## Beat 3 — The Proposition (0:09–0:12)

**VO:** *"Open source. HTML in, video out."*

Minimal hand-drawn diagram: `< >` → arrow → ▶. Pencil-on-paper texture on the line.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:#faf6ec;font-family:"Inter",system-ui,sans-serif;color:#1a1a1a;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;}
  .name{position:absolute;left:0;right:0;top:280px;text-align:center;
    font-size:160px;font-weight:600;letter-spacing:-.03em;}
  .sub{position:absolute;left:0;right:0;top:480px;text-align:center;
    font-size:42px;font-weight:400;color:#6b5a3a;}
  svg{position:absolute;left:50%;top:620px;transform:translateX(-50%);
    width:900px;height:200px;}
  .stroke{stroke:#2a2418;stroke-width:6;fill:none;stroke-linecap:round;}
  text.glyph{font-size:96px;font-weight:600;fill:#2a2418;font-family:"JetBrains Mono",monospace;}
  text.play{font-size:96px;fill:#e76f51;}
</style>
<div id="stage">
  <div class="name">Hyperframe</div>
  <div class="sub">Open source</div>
  <svg viewBox="0 0 900 200">
    <text class="glyph" x="40" y="130">&lt; &gt;</text>
    <path class="stroke" d="M 240 110 Q 450 70 660 110" stroke-dasharray="900" stroke-dashoffset="900"/>
    <polyline class="stroke" points="640,95 670,110 640,125"/>
    <text class="play" x="700" y="135">▶</text>
  </svg>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  tl.from(".sub",{opacity:0,y:12,duration:.8,ease:"power2.out"},0)
    .from(".glyph",{opacity:0,duration:.4},.4)
    .to(".stroke[d]",{strokeDashoffset:0,duration:1.2,ease:"power1.out"},.8)
    .from(".play",{opacity:0,scale:.7,transformOrigin:"700px 110px",duration:.4,ease:"back.out(2)"},1.8);
  window.__timelines["proposition"]=tl;
  tl.play();
</script>
</div>

---

## Beat 4 — The Anatomy (0:12–0:20)

**VO:** *"A div is a keyframe. Data attributes are your timeline. CSS is your look. GSAP is your animation engine."*

Four sequential builds on a graph-paper workspace. Each phrase populates one part of a tiny composition diagram.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background-color:#faf7ef;
    background-image:linear-gradient(rgba(60,40,10,.05) 1px,transparent 1px),
      linear-gradient(90deg,rgba(60,40,10,.05) 1px,transparent 1px);
    background-size:40px 40px;font-family:"Inter",system-ui,sans-serif;color:#1a1a1a;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;}
  .div1,.div2{position:absolute;border-radius:8px;background:#dfe7ef;border:1.5px solid #98a4b3;}
  .div1{left:380px;top:340px;width:200px;height:120px;}
  .div2{left:920px;top:340px;width:200px;height:120px;opacity:0;}
  .div1.styled{background:#7c5cff;border:none;border-radius:18px;
    box-shadow:0 12px 30px rgba(124,92,255,.35);}
  .timeline{position:absolute;left:340px;top:520px;width:1240px;height:14px;
    background:#e2dccd;border-radius:7px;overflow:hidden;}
  .timeline .fill{position:absolute;left:0;top:0;bottom:0;width:0%;
    background:linear-gradient(90deg,#7c5cff,#ff8a5b);}
  .lbl{position:absolute;font-family:"JetBrains Mono",monospace;font-size:22px;color:#3b3422;}
  .l-start{left:430px;top:480px;opacity:0;}
  .l-dur{left:540px;top:480px;opacity:0;}
  .ease{position:absolute;left:340px;top:200px;width:1240px;height:200px;}
  .ease path{fill:none;stroke:#ff5a36;stroke-width:5;stroke-dasharray:1500;stroke-dashoffset:1500;}
  .heading{position:absolute;left:80px;top:60px;font-size:34px;font-weight:600;color:#5a4a2a;}
</style>
<div id="stage">
  <div class="heading">composition</div>
  <svg class="ease" viewBox="0 0 1240 200" preserveAspectRatio="none">
    <path d="M 20 180 C 400 180 700 60 1220 40"/>
  </svg>
  <div class="div1"></div>
  <div class="div2"></div>
  <div class="lbl l-start">start: 0</div>
  <div class="lbl l-dur">duration: 5</div>
  <div class="timeline"><div class="fill"></div></div>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  // 1. div is a keyframe
  tl.from(".div1",{opacity:0,x:-80,duration:.8,ease:"power2.out"},0)
    .from(".timeline",{scaleX:0,transformOrigin:"left",duration:.8,ease:"power2.out"},.2)
  // 2. data attributes
    .to([".l-start",".l-dur"],{opacity:1,duration:.4,stagger:.15},1.4)
    .to(".timeline .fill",{width:"55%",duration:.8,ease:"power1.out"},1.6)
    .to(".div2",{opacity:1,duration:.4,ease:"power2.out"},2.0)
  // 3. CSS look
    .add(()=>document.querySelector(".div1").classList.add("styled"),3.4)
  // 4. GSAP easing curve
    .to(".ease path",{strokeDashoffset:0,duration:1.4,ease:"power1.out"},4.4)
    .to(".div1",{x:540,y:-160,duration:1.6,ease:"power2.out"},4.6);
  window.__timelines["anatomy"]=tl;
  tl.play();
</script>
</div>

---

## Beat 5 — The Thesis (0:20–0:24)

**VO:** *"Anything a browser can render becomes a frame in your video."*

Big serif type. Stagger in. A soft warm shutter pulse on the final word.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:#fbf6ec;font-family:"Instrument Serif",serif;color:#1a1a1a;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;}
  .l1,.l2{font-size:140px;line-height:1.05;letter-spacing:-.02em;}
  .l2{font-style:italic;color:#7a3a18;}
  .pulse{position:absolute;inset:0;background:#fff;opacity:0;mix-blend-mode:overlay;}
</style>
<div id="stage">
  <div class="l1">Anything a browser can render</div>
  <div class="l2">becomes a frame in your video.</div>
  <div class="pulse"></div>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  tl.from(".l1",{opacity:0,y:24,duration:.4,ease:"power2.out"},0)
    .from(".l2",{opacity:0,y:24,duration:.4,ease:"power2.out"},1.2)
    .to("#stage",{scale:1.01,duration:.15,yoyo:true,repeat:1,ease:"power2.inOut"},2.6)
    .to(".pulse",{opacity:.55,duration:.12,yoyo:true,repeat:1},2.6);
  window.__timelines["thesis"]=tl;
  tl.play();
</script>
</div>

---

## Beat 6A — Flex: CSS Animations (0:24–0:26.5)

**VO:** *"CSS animations."*

Bauhaus-flavored geometric choreography. Pure transforms + clip-path. Light base, saturated shapes.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:#f4ecd8;font-family:"Helvetica Neue",sans-serif;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;}
  .sq{position:absolute;left:760px;top:340px;width:400px;height:400px;background:#e9343d;
    animation:rot 4s linear infinite;}
  .ci{position:absolute;left:380px;top:380px;width:300px;height:300px;border-radius:50%;
    background:#ffd400;animation:bob 1.6s ease-in-out infinite alternate;}
  .tr{position:absolute;left:1240px;top:380px;width:300px;height:300px;background:#1d4dff;
    clip-path:polygon(50% 0,100% 100%,0 100%);animation:rot 3s linear infinite reverse;}
  @keyframes rot{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  @keyframes bob{from{transform:translateY(-30px)}to{transform:translateY(30px)}}
  .label{position:absolute;left:80px;top:60px;font-size:28px;letter-spacing:.3em;color:#2a2418;}
</style>
<div id="stage">
  <div class="label">CSS · TRANSFORMS · KEYFRAMES</div>
  <div class="ci"></div><div class="sq"></div><div class="tr"></div>
</div>
</div>

---

## Beat 6B — Flex: GSAP (0:26.5–0:29)

**VO:** *"GSAP."*

Kinetic typography snap-and-orbit. The easing IS the show.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:#f7f3e9;font-family:"Archivo Black","Inter",sans-serif;color:#0d0d0d;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;
    display:flex;align-items:center;justify-content:center;}
  .word{font-size:480px;font-weight:900;letter-spacing:-.04em;color:#0d0d0d;display:flex;}
  .word span{display:inline-block;}
  .accent{position:absolute;font-size:38px;letter-spacing:.4em;color:#ff3b00;
    text-transform:uppercase;}
  .a1{left:240px;top:280px;}.a2{right:240px;top:300px;}
  .a3{left:280px;bottom:300px;}.a4{right:280px;bottom:280px;}
</style>
<div id="stage">
  <div class="accent a1">timelines</div>
  <div class="accent a2">easing</div>
  <div class="accent a3">control</div>
  <div class="accent a4">stagger</div>
  <div class="word"><span>G</span><span>S</span><span>A</span><span>P</span></div>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  tl.from(".word",{scale:.2,duration:.6,ease:"back.out(2.2)"},0)
    .from(".word span",{y:-40,opacity:0,stagger:.08,duration:.4,ease:"power2.inOut"},.4)
    .from(".accent",{opacity:0,y:20,stagger:.1,duration:.5,ease:"power2.out"},.9);
  window.__timelines["flex-gsap"]=tl;
  tl.play();
</script>
</div>

---

## Beat 6C — Flex: Lottie (0:29–0:31)

**VO:** *"Lottie."*

Flat vector character builds itself, then takes flight. Headspace/Duolingo register.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:#fff4d9;font-family:"Nunito",system-ui,sans-serif;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;
    display:flex;align-items:center;justify-content:center;}
  .lbl{position:absolute;left:0;right:0;bottom:140px;text-align:center;
    font-size:42px;font-weight:800;letter-spacing:.15em;color:#3a2c0d;}
</style>
<div id="stage">
  <svg id="bird" viewBox="-200 -200 400 400" width="700" height="700">
    <ellipse class="body" cx="0" cy="0" rx="110" ry="80" fill="#ff7a6b" stroke="#3a2c0d" stroke-width="10"/>
    <polygon class="wing" points="-30,-10 60,-110 70,30" fill="#ffb347" stroke="#3a2c0d" stroke-width="10" stroke-linejoin="round"/>
    <polygon class="beak" points="100,-10 160,0 100,30" fill="#3a2c0d"/>
    <circle class="eye" cx="80" cy="-20" r="14" fill="#fff" stroke="#3a2c0d" stroke-width="6"/>
    <circle class="pupil" cx="84" cy="-20" r="6" fill="#3a2c0d"/>
  </svg>
  <div class="lbl">LOTTIE / VECTOR</div>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  tl.from(".body",{x:-300,opacity:0,duration:.5,ease:"back.out(1.6)"},0)
    .from(".wing",{rotation:-90,opacity:0,transformOrigin:"30px -10px",duration:.4,ease:"back.out(2)"},.3)
    .from([".beak",".eye",".pupil"],{opacity:0,duration:.3,stagger:.1},.5)
    .to(".wing",{rotation:25,duration:.25,yoyo:true,repeat:5,transformOrigin:"30px -10px",ease:"power1.inOut"},1.0)
    .to("#bird",{x:200,y:-60,duration:.9,ease:"power2.out"},1.0);
  window.__timelines["flex-lottie"]=tl;
  tl.play();
</script>
</div>

---

## Beat 6D — Flex: Shaders (0:31–0:34)

**VO:** *"Shaders."*

Full-bleed generative — soap-bubble iridescence, slow organic deformation. Warm-leaning, not the typical neon shader demo.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<style>html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden;}canvas{display:block;width:100%;height:100%;}</style>
<canvas id="c"></canvas>
<script>
  const c=document.getElementById("c");const gl=c.getContext("webgl");
  const fit=()=>{c.width=innerWidth;c.height=innerHeight;gl.viewport(0,0,c.width,c.height);};fit();addEventListener("resize",fit);
  const vs=`attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`;
  const fs=`precision highp float;uniform vec2 R;uniform float T;
    vec3 pal(float t){return .6+.4*cos(6.2831*(vec3(.0,.33,.67)+t));}
    void main(){
      vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;
      float a=0.;vec2 z=uv*1.8;
      for(int i=0;i<6;i++){
        z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+vec2(sin(T*.2)*.4,cos(T*.18)*.3);
        a+=exp(-length(z));
      }
      vec3 col=pal(a*.18+T*.05);
      col=mix(col,vec3(1.,.92,.78),.25);
      gl_FragColor=vec4(col,1.);
    }`;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o;};
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,vs));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);gl.useProgram(pr);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(pr,"p");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const uR=gl.getUniformLocation(pr,"R"),uT=gl.getUniformLocation(pr,"T");
  const t0=performance.now();
  (function render(){requestAnimationFrame(render);gl.uniform2f(uR,c.width,c.height);gl.uniform1f(uT,(performance.now()-t0)/1000);gl.drawArrays(gl.TRIANGLES,0,6);})();
</script>
</div>

---

## Beat 6E — Flex: Three.js (0:34–0:36)

**VO:** *"Three.js."*

Soft-lit ceramic form. Studio object, not sci-fi.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<style>html,body{margin:0;width:100%;height:100%;background:#f0e8d4;overflow:hidden;}canvas{display:block;}</style>
<script>
  const sc=new THREE.Scene();sc.background=new THREE.Color(0xf0e8d4);
  const cam=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,100);cam.position.set(0,1.2,4.5);cam.lookAt(0,0,0);
  const r=new THREE.WebGLRenderer({antialias:true});r.setSize(innerWidth,innerHeight);r.shadowMap.enabled=true;document.body.appendChild(r.domElement);
  addEventListener("resize",()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();r.setSize(innerWidth,innerHeight);});
  const key=new THREE.DirectionalLight(0xfff2d8,2.2);key.position.set(3,4,2);key.castShadow=true;sc.add(key);
  sc.add(new THREE.AmbientLight(0xffe6c2,.55));
  const fill=new THREE.DirectionalLight(0xa8d0ff,.4);fill.position.set(-2,1,-1);sc.add(fill);
  const mat=new THREE.MeshStandardMaterial({color:0xe8b486,roughness:.55,metalness:.1});
  const knot=new THREE.Mesh(new THREE.TorusKnotGeometry(.7,.22,180,28),mat);knot.castShadow=true;sc.add(knot);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(8,64),new THREE.ShadowMaterial({opacity:.18}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-1;ground.receiveShadow=true;sc.add(ground);
  (function loop(){requestAnimationFrame(loop);knot.rotation.y+=.003;knot.rotation.x+=.0012;cam.position.x=Math.sin(Date.now()/4000)*1.2;cam.lookAt(0,0,0);r.render(sc,cam);})();
</script>
</div>

---

## Beat 6F — Flex: Compose (0:36–0:38)

**VO:** *"Drop in music, sound effects, footage — it all composes together."*

Production canvas: a creator video frame with lower-third + captions + waveform layered on. Hyperframe is the **composition layer** — user brings the media.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:#1a1814;font-family:"Inter",system-ui,sans-serif;color:#fff;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;}
  .frame{position:absolute;left:360px;top:160px;width:1200px;height:680px;
    border-radius:18px;overflow:hidden;background:linear-gradient(135deg,#a3825c,#5a3f23);
    box-shadow:0 30px 80px rgba(0,0,0,.5);}
  .person{position:absolute;left:50%;top:55%;width:380px;height:380px;border-radius:50%;
    background:radial-gradient(circle at 35% 35%,#f5d0a8,#a87454 70%,#5a3823);
    transform:translate(-50%,-50%);box-shadow:inset -20px -30px 60px rgba(0,0,0,.4);}
  .lower{position:absolute;left:400px;bottom:200px;background:rgba(255,255,255,.95);
    color:#1a1a1a;padding:18px 28px;border-radius:6px;border-left:6px solid #ff5a36;
    font-weight:600;font-size:32px;box-shadow:0 12px 30px rgba(0,0,0,.4);opacity:0;}
  .lower small{display:block;font-weight:400;font-size:22px;color:#666;margin-top:4px;}
  .cap{position:absolute;left:50%;bottom:80px;transform:translateX(-50%);
    background:rgba(0,0,0,.7);padding:14px 30px;border-radius:10px;
    backdrop-filter:blur(8px);font-size:34px;opacity:0;}
  .wave{position:absolute;left:360px;right:360px;bottom:30px;height:60px;
    display:flex;align-items:end;gap:6px;opacity:0;}
  .wave i{flex:1;background:#ff8a5b;border-radius:3px;height:20%;
    animation:bar 1s ease-in-out infinite alternate;}
  .wave i:nth-child(2n){animation-delay:.15s;}.wave i:nth-child(3n){animation-delay:.3s;}
  @keyframes bar{from{height:15%}to{height:90%}}
</style>
<div id="stage">
  <div class="frame"><div class="person"></div></div>
  <div class="lower">Maya Chen<small>Creative Director · 2026</small></div>
  <div class="cap clip" data-start="0" data-duration="2" data-track-index="20">"…it all composes together."</div>
  <div class="wave">
    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
  </div>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  tl.from(".frame",{opacity:0,scale:.95,duration:.5,ease:"power2.out"},0)
    .to(".lower",{opacity:1,x:0,duration:.4,ease:"power2.out"},.7)
    .from(".lower",{x:-40},.7)
    .to(".cap",{opacity:1,duration:.3},1.1)
    .to(".wave",{opacity:1,duration:.3},1.3);
  window.__timelines["flex-compose"]=tl;
  tl.play();
</script>
</div>

---

## Beat 7 — The Contrast (0:38–0:44)

**VO:** *"No new framework to learn. No thousands of lines of instructions. Just HTML."*

Dense framework code on the left folds away. Spacious Hyperframe HTML expands to fill.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:#fbf6ec;font-family:"Inter",system-ui,sans-serif;color:#1a1a1a;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;display:flex;}
  .pane{flex:1;height:1080px;padding:60px;box-sizing:border-box;overflow:hidden;}
  .left{background:#efe9d9;color:#5a4a2a;font-family:"JetBrains Mono",monospace;font-size:11px;line-height:1.4;transform-origin:right center;}
  .left h3{font-family:"Inter",sans-serif;font-size:24px;color:#7a3a18;margin:0 0 20px;}
  .right{background:#fff;font-family:"JetBrains Mono",monospace;font-size:22px;line-height:1.7;transform-origin:left center;}
  .right h3{font-family:"Inter",sans-serif;font-size:30px;color:#0d4d3a;margin:0 0 30px;}
  .right .tag{color:#7c5cff;}.right .attr{color:#ff5a36;}.right .str{color:#0d8a4d;}
  .glow{position:absolute;left:50%;top:50%;width:1400px;height:1400px;border-radius:50%;
    background:radial-gradient(circle,rgba(255,200,140,.4),transparent 70%);
    transform:translate(-50%,-50%);opacity:0;pointer-events:none;}
</style>
<div id="stage">
  <div class="pane left">
    <h3>Other frameworks: 4,500 lines of instructions.</h3>
    <pre>import { Composition, useVideoConfig, useCurrentFrame, interpolate, spring,
  Sequence, AbsoluteFill, Audio, Video, Img, staticFile, delayRender,
  continueRender, registerRoot, getInputProps, prefetch, cancelRender,
  Easing, Loop, OffthreadVideo, Series, Freeze, Still, IFrame } from 'remotion';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { z } from 'zod';
const compositionSchema = z.object({
  title: z.string(), subtitle: z.string().optional(),
  duration: z.number().default(30), fps: z.number().default(30),
  width: z.number().default(1920), height: z.number().default(1080),
});
export const MyComposition: React.FC&lt;z.infer&lt;typeof compositionSchema&gt;&gt; = ({title}) =&gt; {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  const opacity = interpolate(frame, [0, 30], [0, 1], {extrapolateRight: 'clamp'});
  // ...4,477 more lines
}</pre>
  </div>
  <div class="pane right">
    <h3>Hyperframe: one skill file.</h3>
    <pre>&lt;<span class="tag">div</span> <span class="attr">data-composition-id</span>=<span class="str">"intro"</span>
     <span class="attr">data-duration</span>=<span class="str">"5"</span>
     <span class="attr">data-width</span>=<span class="str">"1920"</span>
     <span class="attr">data-height</span>=<span class="str">"1080"</span>&gt;
  &lt;<span class="tag">h1</span>&gt;Ralphin&lt;/<span class="tag">h1</span>&gt;
&lt;/<span class="tag">div</span>&gt;</pre>
  </div>
  <div class="glow"></div>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  tl.to(".left",{scaleX:0,duration:.9,ease:"power2.inOut"},2.5)
    .to(".right",{scaleX:2,x:-960,duration:.9,ease:"power2.inOut"},2.5)
    .to(".glow",{opacity:1,duration:.6},3.0);
  window.__timelines["contrast"]=tl;
  tl.play();
</script>
</div>

---

## Beat 8 — The Engine (0:44–0:48)

**VO:** *"The agent writes it. The renderer captures every frame. Deterministic. Identical output, every time."*

Render pipeline draws itself: Agent → HTML → Renderer → MP4. Two byte-identical thumbnail comparisons below.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:#fbf6ec;font-family:"Inter",system-ui,sans-serif;color:#1a1a1a;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:80px;}
  .pipe{display:flex;align-items:center;gap:50px;}
  .node{width:200px;height:200px;border-radius:24px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;font-weight:600;font-size:24px;
    box-shadow:0 16px 40px rgba(60,40,10,.18);}
  .icon{font-size:64px;line-height:1;margin-bottom:14px;}
  .n1{background:#ffe680;}.n2{background:#a8d0ff;}.n3{background:#ffb1b8;}.n4{background:#bef0c8;}
  .arr{width:80px;height:8px;background:#5a4a2a;border-radius:4px;position:relative;}
  .arr::after{content:"";position:absolute;right:-4px;top:-12px;border-left:18px solid #5a4a2a;
    border-top:16px solid transparent;border-bottom:16px solid transparent;}
  .compare{display:flex;gap:30px;align-items:center;}
  .thumb{width:300px;height:170px;border-radius:10px;
    background:linear-gradient(135deg,#7c5cff 0%,#ff5a36 50%,#ffb15a 100%);}
  .eq{font-size:64px;color:#0d8a4d;font-weight:700;opacity:0;}
  .lock{position:absolute;left:50%;top:62%;transform:translateX(-50%);
    background:#0d8a4d;color:#fff;padding:10px 22px;border-radius:30px;
    font-size:22px;letter-spacing:.15em;opacity:0;}
</style>
<div id="stage">
  <div class="pipe">
    <div class="node n1"><span class="icon">✦</span>Agent</div><div class="arr"></div>
    <div class="node n2"><span class="icon">&lt;/&gt;</span>HTML</div><div class="arr"></div>
    <div class="node n3"><span class="icon">◉</span>Renderer</div><div class="arr"></div>
    <div class="node n4"><span class="icon">▶</span>MP4</div>
  </div>
  <div class="compare">
    <div class="thumb"></div><span class="eq">≡</span><div class="thumb"></div>
  </div>
  <div class="lock">BYTE-IDENTICAL</div>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  tl.from(".node",{opacity:0,y:30,duration:.4,stagger:.3,ease:"back.out(1.4)"},0)
    .from(".arr",{scaleX:0,transformOrigin:"left",duration:.3,stagger:.3,ease:"power2.out"},.2)
    .from(".thumb",{opacity:0,duration:.4,stagger:.15},2)
    .to(".eq",{opacity:1,scale:1.2,duration:.3,yoyo:true,repeat:1},2.6)
    .to(".lock",{opacity:1,y:-10,duration:.4,ease:"back.out(1.6)"},2.9);
  window.__timelines["engine"]=tl;
  tl.play();
</script>
</div>

---

## Beat 9 — The CTA (0:48–0:54)

**VO:** *"Give your agent the skill. Tell it what to make. Watch it build."*

Light editor workspace. Skill drops in → prompt types → preview assembles at 4× speed.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:#f6efde;font-family:"Inter",system-ui,sans-serif;color:#1a1a1a;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;
    display:grid;grid-template-columns:540px 1fr;gap:30px;padding:60px;box-sizing:border-box;}
  .left{display:flex;flex-direction:column;gap:24px;}
  .skill{background:#fff;border:1px solid rgba(60,40,10,.12);border-radius:14px;padding:24px;
    display:flex;align-items:center;gap:16px;box-shadow:0 8px 24px rgba(60,40,10,.08);
    opacity:0;transform:translateY(-30px);}
  .skill .ic{width:44px;height:44px;border-radius:10px;background:#7c5cff;color:#fff;
    display:flex;align-items:center;justify-content:center;font-weight:700;}
  .input{background:#fff;border:1px solid rgba(60,40,10,.12);border-radius:14px;padding:24px;
    font-family:"JetBrains Mono",monospace;font-size:22px;min-height:80px;color:#0d4d3a;
    opacity:0;}
  .right{background:#1a1814;border-radius:14px;overflow:hidden;position:relative;
    transform:translateX(60px);opacity:0;}
  .preview{position:absolute;inset:30px;background:#fff7df;border-radius:8px;
    display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;
    color:#3a2c0d;font-weight:700;}
  .preview .big{font-size:64px;}.preview .small{font-size:24px;font-weight:400;color:#7a5a2a;}
  .cursor{display:inline-block;width:2px;height:1.2em;background:#0d4d3a;vertical-align:middle;
    margin-left:4px;animation:blink 1s steps(1) infinite;}
  @keyframes blink{50%{opacity:0;}}
</style>
<div id="stage">
  <div class="left">
    <div class="skill"><span class="ic">HF</span><span><b>hyperframe-skill.md</b><br><small style="color:#666">installed</small></span></div>
    <div class="input"><span id="prompt"></span><span class="cursor"></span></div>
  </div>
  <div class="right"><div class="preview"><div class="big">Product Intro</div><div class="small">kinetic typography · auto-built</div></div></div>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  tl.to(".skill",{opacity:1,y:0,duration:.5,ease:"back.out(1.4)"},0)
    .to(".input",{opacity:1,duration:.3},.8)
    .add(()=>{
      const t='"a product intro with kinetic typography"';let i=0;
      (function type(){if(i<=t.length){document.getElementById("prompt").textContent=t.slice(0,i++);setTimeout(type,40);}})();
    },1.0)
    .to(".right",{opacity:1,x:0,duration:.5,ease:"power2.out"},3.5)
    .from(".preview .big",{y:30,opacity:0,duration:.4,ease:"power2.out"},3.8)
    .from(".preview .small",{y:20,opacity:0,duration:.4,ease:"power2.out"},4.1);
  window.__timelines["cta"]=tl;
  tl.play();
</script>
</div>

---

## Beat 10 — The Close: Return to Canvas (0:54–1:00)

**VO:** *"Hyperframe. Go make something."*

Pull back to the infinite canvas — same scene as Beat 1, but with one new card: the video we just watched. Wordmark fades in over the drifting canvas.

<!-- el:hyperframe w=1280 h=720 -->
<div class="el-hyperframe-src" style="display:none">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;
    background:radial-gradient(circle at 50% 50%,#fbf6ec 0%,#f3ead7 60%,#e8dcc1 100%);
    font-family:"Inter",system-ui,sans-serif;}
  #stage{position:relative;width:1920px;height:1080px;transform-origin:0 0;}
  .canvas{position:absolute;inset:-200px;
    background-image:radial-gradient(circle,rgba(80,60,30,.18) 1px,transparent 1px);
    background-size:48px 48px;}
  .card{position:absolute;border-radius:18px;background:#fff;
    box-shadow:0 18px 40px rgba(60,40,10,.12);border:1px solid rgba(80,60,30,.08);}
  .c1{left:140px;top:160px;width:300px;height:200px;transform:rotate(-5deg);background:#ffeb6b;}
  .c2{left:580px;top:120px;width:280px;height:170px;transform:rotate(3deg);background:#ff7a59;}
  .c3{left:1080px;top:200px;width:300px;height:200px;transform:rotate(-3deg);background:#e7f3ff;}
  .c4{left:1500px;top:140px;width:280px;height:180px;transform:rotate(7deg);background:#dcf3e6;}
  .c5{left:200px;top:560px;width:280px;height:180px;transform:rotate(6deg);background:#ffd9d4;}
  .c6{left:1100px;top:560px;width:300px;height:200px;transform:rotate(4deg);background:#fff7df;}
  .c7{left:1500px;top:600px;width:300px;height:200px;transform:rotate(-7deg);
    background:linear-gradient(45deg,#7ce0ff,#a78bff);}
  /* The new card — the launch video itself */
  .new{left:560px;top:430px;width:420px;height:260px;transform:rotate(-2deg);
    background:linear-gradient(135deg,#1a1a1a,#2a2418);color:#fff;
    display:flex;align-items:center;justify-content:center;font-weight:600;font-size:28px;
    box-shadow:0 30px 70px rgba(0,0,0,.35);}
  .overlay{position:absolute;inset:0;background:rgba(250,245,232,.55);opacity:0;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;
    backdrop-filter:blur(2px);}
  .mark{font-size:200px;font-weight:600;letter-spacing:-.04em;color:#1a1a1a;}
  .url{font-family:"JetBrains Mono",monospace;font-size:32px;color:#7a5a2a;}
</style>
<div id="stage">
  <div class="canvas"></div>
  <div class="card c1"></div><div class="card c2"></div><div class="card c3"></div>
  <div class="card c4"></div><div class="card c5"></div><div class="card c6"></div>
  <div class="card c7"></div>
  <div class="card new">▶ Hyperframe launch</div>
  <div class="overlay">
    <div class="mark">Hyperframe</div>
    <div class="url">github.com/heygen-com/hyperframes</div>
  </div>
</div>
<script>
  (function fit(){const s=document.getElementById("stage");const r=()=>{const k=Math.min(innerWidth/1920,innerHeight/1080);s.style.transform="scale("+k+")";};r();addEventListener("resize",r);})();
  window.__timelines=window.__timelines||{};
  const tl=gsap.timeline({paused:true});
  tl.fromTo("#stage",{scale:2.5,x:-400,y:-200},{scale:1,x:0,y:0,duration:2,ease:"power2.out"},0)
    .fromTo("#stage",{rotate:0},{x:80,y:30,rotate:1,duration:4,ease:"power1.inOut"},2)
    .from(".new",{opacity:0,scale:.6,duration:.8,ease:"back.out(1.6)"},1.5)
    .to(".overlay",{opacity:1,duration:1,ease:"power2.out"},2.5);
  window.__timelines["canvas-close"]=tl;
  tl.play();
</script>
</div>

---

<!-- _class: lead -->

## Production Notes

- **Render with HeyGen Hyperframes:** copy any beat's `<div class="el-hyperframe-src">` body into a standalone HTML, replace `tl.play()` with leaving the timeline paused, then `npx hyperframes render`.
- **Distinct mood per beat:** each composition uses its own palette + typography per the storyboard — do *not* unify them.
- **Audio:** add `<audio data-start data-duration data-track-index>` siblings inside each composition for VO + underscore.
- **Seedance insert:** Beat 6F's "creator" disc is a placeholder for a real talking-head clip (`<video src="assets/creator.mp4" data-start="0" data-duration="2" data-track-index="0" muted playsinline>`).
- **Spec source:** [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) · [hyperframes-launch-video](https://github.com/heygen-com/hyperframes-launch-video) · [hyperframes-composer skill](https://github.com/georgeantonopoulos/hyperframes-composer).
