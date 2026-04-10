/**
 * presenter.js — Full-screen presentation mode with keyboard navigation.
 */
window.Presenter = (function () {
  'use strict';

  let slides = [];
  let current = 0;
  let fragmentStep = 0;
  let fragmentTotal = 0;
  let container, indicator, prevBtn, nextBtn, exitBtn;

  function init() {
    container = document.getElementById('presenter-slides');
    indicator = document.getElementById('presenter-indicator');
    prevBtn = document.getElementById('presenter-prev');
    nextBtn = document.getElementById('presenter-next');
    exitBtn = document.getElementById('presenter-exit');

    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);
    exitBtn.addEventListener('click', exit);
  }

  function getFragmentNodes() {
    const root = container?.querySelector('.presenter-slide');
    if (!root) return [];

    const nodes = Array.from(root.querySelectorAll('[data-marpit-fragment], .fragment'));
    if (nodes.length === 0) return [];

    let maxIdx = nodes.reduce((max, node) => {
      const v = parseInt(node.getAttribute('data-marpit-fragment') || '0', 10);
      return Math.max(max, v);
    }, 0);

    // Backward compatibility: when only .fragment exists, generate ordered fragment indices.
    nodes.forEach(node => {
      const currentVal = parseInt(node.getAttribute('data-marpit-fragment') || '0', 10);
      if (!currentVal) {
        maxIdx += 1;
        node.setAttribute('data-marpit-fragment', String(maxIdx));
      }
    });

    return nodes.sort((a, b) => {
      const av = parseInt(a.getAttribute('data-marpit-fragment') || '0', 10);
      const bv = parseInt(b.getAttribute('data-marpit-fragment') || '0', 10);
      return av - bv;
    });
  }

  function applyFragmentVisibility() {
    const frags = getFragmentNodes();
    frags.forEach(node => {
      const idx = parseInt(node.getAttribute('data-marpit-fragment') || '0', 10);
      node.classList.toggle('is-visible', idx <= fragmentStep);
    });
  }

  function updateIndicator() {
    const fragPart = fragmentTotal > 0 ? ` (${fragmentStep}/${fragmentTotal})` : '';
    indicator.textContent = `${current + 1} / ${slides.length}${fragPart}`;
  }

  function show(idx, initialFragmentStep = 0) {
    if (idx < 0 || idx >= slides.length) return;
    current = idx;

    container.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'presenter-slide';
    div.innerHTML = window.SlideRenderer.renderSlideHTML(slides[current], current + 1, slides.length);
    container.appendChild(div);
    window.SlideRenderer.highlightCode(div);

    fragmentTotal = getFragmentNodes().reduce((max, node) => {
      const v = parseInt(node.getAttribute('data-marpit-fragment') || '0', 10);
      return Math.max(max, v);
    }, 0);
    fragmentStep = Math.max(0, Math.min(initialFragmentStep, fragmentTotal));
    applyFragmentVisibility();
    updateIndicator();
  }

  function next() {
    if (fragmentStep < fragmentTotal) {
      fragmentStep += 1;
      applyFragmentVisibility();
      updateIndicator();
      return;
    }
    show(current + 1, 0);
  }

  function prev() {
    if (fragmentStep > 0) {
      fragmentStep -= 1;
      applyFragmentVisibility();
      updateIndicator();
      return;
    }
    const prevIndex = current - 1;
    if (prevIndex < 0) return;
    const prevSlide = slides[prevIndex];
    const matches = Array.from(String(prevSlide?.html || '').matchAll(/data-marpit-fragment="(\d+)"/g));
    const prevTotal = matches.reduce((m, g) => Math.max(m, parseInt(g[1], 10) || 0), 0);
    show(prevIndex, prevTotal);
  }

  function enter(allSlides, startIndex) {
    slides = allSlides;
    current = startIndex || 0;

    const el = document.getElementById('presenter-mode');
    el.classList.remove('hidden');

    // Request fullscreen
    try {
      document.documentElement.requestFullscreen();
    } catch (e) { /* not supported */ }

    show(current, 0);

    // Keyboard listener
    document.addEventListener('keydown', onKey);
  }

  function exit() {
    const el = document.getElementById('presenter-mode');
    el.classList.add('hidden');
    document.removeEventListener('keydown', onKey);

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      next();
    }
    if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
      e.preventDefault();
      prev();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      exit();
    }
    if (e.key === 'Home') { e.preventDefault(); show(0); }
    if (e.key === 'End') { e.preventDefault(); show(slides.length - 1); }
  }

  return { init, enter, exit };
})();
