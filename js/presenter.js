/**
 * presenter.js — Full-screen presentation mode with keyboard navigation.
 */
window.Presenter = (function () {
  'use strict';

  let slides = [];
  let current = 0;
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

  function show(idx) {
    if (idx < 0 || idx >= slides.length) return;
    current = idx;

    container.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'presenter-slide';
    div.innerHTML = window.SlideRenderer.renderSlideHTML(slides[current], current + 1, slides.length);
    container.appendChild(div);
    window.SlideRenderer.highlightCode(div);

    indicator.textContent = `${current + 1} / ${slides.length}`;
  }

  function next() { show(current + 1); }
  function prev() { show(current - 1); }

  function enter(allSlides, startIndex) {
    slides = allSlides;
    current = startIndex || 0;

    const el = document.getElementById('presenter-mode');
    el.classList.remove('hidden');

    // Request fullscreen
    try {
      document.documentElement.requestFullscreen();
    } catch (e) { /* not supported */ }

    show(current);

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
