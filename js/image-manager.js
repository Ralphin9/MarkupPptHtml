/**
 * image-manager.js — Upload, manage, and drag images to the visual slide canvas.
 *
 * Stores images as data-URI blobs in an in-memory gallery.
 * The user can also add images by URL.  Images from the gallery can be
 * dragged directly onto the slide canvas.
 */
window.ImageManager = (function () {
  'use strict';

  let images = []; // { id, name, url, thumb }
  let imageIdCounter = 0;
  let onInsertCallback = null;

  // ===== Init =====
  function init(onInsert) {
    onInsertCallback = onInsert;

    setupFileUpload();
    setupUrlAdd();
    setupDropUpload();
    renderGallery();
  }

  // ===== File Upload =====
  function setupFileUpload() {
    const input = document.getElementById('img-file-input');
    const btn   = document.getElementById('btn-browse-images');
    if (!input || !btn) return;

    btn.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
      const files = input.files;
      if (!files) return;
      Array.from(files).forEach(processFile);
      input.value = '';
    });
  }

  function processFile(file) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      addImage(file.name, e.target.result);
    };
    reader.readAsDataURL(file);
  }

  // ===== URL Add =====
  function setupUrlAdd() {
    const input = document.getElementById('img-url-field');
    const btn   = document.getElementById('btn-add-url-image');
    if (!input || !btn) return;

    btn.addEventListener('click', () => {
      const url = input.value.trim();
      if (!url) return;
      addImage(urlFileName(url), url);
      input.value = '';
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btn.click();
    });
  }

  function urlFileName(url) {
    try {
      const parts = new URL(url).pathname.split('/');
      return parts[parts.length - 1] || 'image';
    } catch {
      return 'image';
    }
  }

  // ===== Drag-and-drop upload (on the upload area and gallery) =====
  function setupDropUpload() {
    ['img-upload-area', 'image-gallery'].forEach(areaId => {
      const area = document.getElementById(areaId);
      if (!area) return;

      area.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        area.classList.add('drag-hover');
      });
      area.addEventListener('dragleave', () => area.classList.remove('drag-hover'));

      area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('drag-hover');
        const files = e.dataTransfer.files;
        if (!files) return;
        Array.from(files).forEach(processFile);
      });
    });
  }

  // ===== Add image to gallery =====
  function addImage(name, url) {
    images.push({ id: ++imageIdCounter, name, url });
    renderGallery();
    return imageIdCounter;
  }

  function removeImage(id) {
    images = images.filter(img => img.id !== id);
    renderGallery();
  }

  // ===== Render Gallery =====
  function renderGallery() {
    const gallery = document.getElementById('image-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';

    if (images.length === 0) {
      gallery.innerHTML = '<p class="gallery-empty">No images yet.<br>Upload or add by URL.</p>';
      return;
    }

    images.forEach(img => {
      const card = document.createElement('div');
      card.className = 'img-card';
      card.draggable = true;
      card.title = img.name;

      const thumb = document.createElement('img');
      thumb.className = 'img-card-thumb';
      thumb.src = img.url;
      thumb.alt = img.name;
      thumb.loading = 'lazy';
      card.appendChild(thumb);

      const label = document.createElement('span');
      label.className = 'img-card-name';
      label.textContent = img.name.length > 20 ? img.name.slice(0, 18) + '…' : img.name;
      card.appendChild(label);

      const actions = document.createElement('div');
      actions.className = 'img-card-actions';

      // Insert button
      const insertBtn = document.createElement('button');
      insertBtn.className = 'img-action-btn';
      insertBtn.textContent = '＋';
      insertBtn.title = 'Insert into slide';
      insertBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onInsertCallback) onInsertCallback(img.url, img.name);
      });
      actions.appendChild(insertBtn);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'img-action-btn danger';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove from gallery';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeImage(img.id);
      });
      actions.appendChild(removeBtn);

      card.appendChild(actions);

      // Drag image to canvas
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('image-url', img.url);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));

      gallery.appendChild(card);
    });
  }

  // ===== Get all images (for save/load) =====
  function getImages() { return images; }
  function setImages(list) { images = list || []; imageIdCounter = images.reduce((m, i) => Math.max(m, i.id || 0), 0); renderGallery(); }

  return { init, addImage, addImageDirect: addImage, removeImage, renderGallery, getImages, setImages };
})();
