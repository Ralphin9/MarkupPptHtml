/**
 * templates.js — Pre-built slide templates that users can insert.
 *
 * Each template provides markdown that demonstrates a specific slide type,
 * similar to how the Python tool detects and generates different slide types
 * (title, list, code, table, image) from Markdown structure.
 */
window.SlideTemplates = (function () {
  'use strict';

  const templates = [
    // ===== BASIC =====
    {
      id: 'starter',
      name: 'Starter Deck',
      icon: '🚀',
      category: 'Basic',
      description: 'Complete starter presentation with multiple slide types',
      markdown: `---
marp: true
theme: default
paginate: true
---

# My Presentation

Your Name — Date

---

## Agenda

- Introduction
- Key Points
- Demo
- Q&A

---

## Key Insight

> "The best way to predict the future is to invent it."
> — Alan Kay

---

## Code Example

\`\`\`python
def hello(name):
    return f"Hello, {name}!"

print(hello("World"))
\`\`\`

---

## Data Comparison

| Feature | Option A | Option B |
|---------|----------|----------|
| Speed   | Fast     | Moderate |
| Cost    | Low      | High     |
| Scale   | Limited  | Unlimited|

---

## Thank You! :tada:

Questions?`
    },
    {
      id: 'title',
      name: 'Title Slide',
      icon: '📌',
      category: 'Basic',
      description: 'Big heading with optional subtitle',
      markdown: `
# Presentation Title

Your subtitle or tagline here`
    },
    {
      id: 'title-invert',
      name: 'Title (Dark)',
      icon: '🌙',
      category: 'Basic',
      description: 'Title slide with dark background',
      markdown: `
<!-- backgroundColor: #1a1a2e -->
<!-- color: #eee -->

# Bold Statement

Make an impact with contrasting colors`
    },

    // ===== CONTENT =====
    {
      id: 'bullets',
      name: 'Bullet Points',
      icon: '☰',
      category: 'Content',
      description: 'Standard content slide with bullet list',
      markdown: `
## Key Points

- First important point
- Second important point
- Third important point
- Fourth important point`
    },
    {
      id: 'bullets-fragment',
      name: 'Animated Bullets',
      icon: '✨',
      category: 'Content',
      description: 'Bullets that appear one at a time (HTML export)',
      markdown: `
## Step by Step

* First, we set up the environment
* Then, we configure the settings
* Next, we run the tests
* Finally, we deploy`
    },
    {
      id: 'numbered',
      name: 'Numbered List',
      icon: '🔢',
      category: 'Content',
      description: 'Ordered step-by-step content',
      markdown: `
## Process Overview

1. **Discovery** — Understand the problem
2. **Design** — Plan the solution
3. **Develop** — Build it
4. **Deploy** — Ship it
5. **Iterate** — Improve it`
    },
    {
      id: 'quote',
      name: 'Quote Slide',
      icon: '💬',
      category: 'Content',
      description: 'Featured quotation with attribution',
      markdown: `
## Inspiration

> "Any sufficiently advanced technology is indistinguishable from magic."
>
> — Arthur C. Clarke`
    },
    {
      id: 'math',
      name: 'Math Equations',
      icon: '∑',
      category: 'Content',
      description: 'Slide with mathematical expressions (KaTeX)',
      markdown: `
## Key Formula

The quadratic formula:

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

Where $a$, $b$, and $c$ are coefficients of $ax^2 + bx + c = 0$.`
    },
    {
      id: 'fit',
      name: 'Big Word (Fit)',
      icon: '🔠',
      category: 'Content',
      description: 'Single word or phrase stretched to fill the slide',
      markdown: `
<!-- backgroundColor: #000 -->
<!-- color: #ff0 -->

# <!-- fit --> DEMO TIME`
    },
    {
      id: 'thanks',
      name: 'Thank You / End',
      icon: '🎉',
      category: 'Content',
      description: 'Closing slide with contact info',
      markdown: `
# Thank You! :tada:

**Your Name**
your.email@example.com

:globe: yourwebsite.com
:link: github.com/yourusername`
    },

    // ===== CODE =====
    {
      id: 'code-python',
      name: 'Code — Python',
      icon: '🐍',
      category: 'Code',
      description: 'Python code block with syntax highlighting',
      markdown: `
## Python Example

\`\`\`python
import pandas as pd

# Load and analyze data
df = pd.read_csv("data.csv")
summary = df.describe()
print(summary)
\`\`\``
    },
    {
      id: 'code-js',
      name: 'Code — JavaScript',
      icon: '📜',
      category: 'Code',
      description: 'JavaScript code block with syntax highlighting',
      markdown: `
## JavaScript Example

\`\`\`javascript
async function fetchData(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data.map(item => ({
    id: item.id,
    name: item.name.toUpperCase()
  }));
}
\`\`\``
    },
    {
      id: 'code-multi',
      name: 'Code — Before & After',
      icon: '⚖️',
      category: 'Code',
      description: 'Two code blocks side by side concept',
      markdown: `
## Before & After

**Before:**
\`\`\`javascript
var x = 1;
var y = 2;
var sum = x + y;
\`\`\`

**After:**
\`\`\`javascript
const add = (x, y) => x + y;
console.log(add(1, 2));
\`\`\``
    },

    // ===== DATA =====
    {
      id: 'table',
      name: 'Data Table',
      icon: '▦',
      category: 'Data',
      description: 'Table for comparing data or features',
      markdown: `
## Feature Comparison

| Feature      | Free  | Pro    | Enterprise |
|-------------|-------|--------|------------|
| Users       | 5     | 50     | Unlimited  |
| Storage     | 1 GB  | 100 GB | 1 TB       |
| Support     | Email | Chat   | Dedicated  |
| API Access  | ❌    | ✅     | ✅         |
| Custom CSS  | ❌    | ❌     | ✅         |`
    },

    // ===== MEDIA =====
    {
      id: 'image',
      name: 'Image — Centered',
      icon: '🖼',
      category: 'Media',
      description: 'Centered image with caption',
      markdown: `
## Architecture Diagram

![Architecture](https://via.placeholder.com/600x300/264653/ffffff?text=Your+Image+Here)

*Figure 1: System architecture overview*`
    },

    // ===== LAYOUT =====
    {
      id: 'split',
      name: 'Split — Image + Text',
      icon: '▥',
      category: 'Layout',
      description: 'Image on one side, text on the other',
      markdown: `
## Product Features

![bg left](https://via.placeholder.com/600x400/0984e3/ffffff?text=Image)

- Fast performance
- Beautiful design
- Easy to use
- Fully accessible`
    },
    {
      id: 'twocol',
      name: 'Two Columns',
      icon: '‖',
      category: 'Layout',
      description: 'Two columns of text content',
      markdown: `
## Pros & Cons

<div class="columns">
<div class="col">

### Pros ✅
- Easy to learn
- Great community
- Excellent docs
- Fast iteration

</div>
<div class="col">

### Cons ❌
- Learning curve
- Complex setup
- Limited plugins
- Vendor lock-in

</div>
</div>`
    },

    // ===== BACKGROUND — Size & Position =====
    {
      id: 'bg-cover',
      name: 'Background — Cover',
      icon: '🖼️',
      category: 'Background',
      description: 'Full-screen background image scaled to fill (default)',
      markdown: `
![bg](https://picsum.photos/1920/1080?random=1)

# Full Background

Text over a cover image`
    },
    {
      id: 'bg-contain',
      name: 'Background — Contain',
      icon: '📐',
      category: 'Background',
      description: 'Background scaled to fit inside slide without cropping',
      markdown: `
![bg contain](https://picsum.photos/800/600?random=2)

## Background Contain

Image scales to fit without cropping`
    },
    {
      id: 'image-bg',
      name: 'Background — Directive',
      icon: '🌄',
      category: 'Background',
      description: 'Background via CSS backgroundImage directive',
      markdown: `
<!-- backgroundImage: url(https://via.placeholder.com/1920x1080/2d3436/ffffff?text=BG) -->
<!-- color: #fff -->

# Big Visual Slide

Text overlaid on a background image`
    },
    {
      id: 'bg-color',
      name: 'Background — Solid Color',
      icon: '🎨',
      category: 'Background',
      description: 'Custom background color + text color via directives',
      markdown: `
<!-- backgroundColor: #264653 -->
<!-- color: #e9c46a -->

# Custom Colors

Use directives to set **background** and **text** colors.

- \`backgroundColor: #264653\`
- \`color: #e9c46a\``
    },
    {
      id: 'bg-gradient-css',
      name: 'Background — Gradient',
      icon: '🌈',
      category: 'Background',
      description: 'CSS linear-gradient via backgroundImage directive',
      markdown: `
<!-- backgroundImage: linear-gradient(135deg, #667eea 0%, #764ba2 100%) -->
<!-- color: #fff -->

# Gradient Background

Using CSS \`linear-gradient\` via the \`backgroundImage\` directive`
    },

    // ===== BACKGROUND — Split =====
    {
      id: 'bg-left',
      name: 'Split BG — Left',
      icon: '◧',
      category: 'Split BG',
      description: 'Image fills the left half, content on the right',
      markdown: `
![bg left](https://picsum.photos/720/540?random=3)

# Split Left

- Content goes on the right side
- Image fills the left half
- Great for visual storytelling`
    },
    {
      id: 'bg-right',
      name: 'Split BG — Right',
      icon: '◨',
      category: 'Split BG',
      description: 'Image fills the right half, content on the left',
      markdown: `
![bg right](https://picsum.photos/720/540?random=4)

# Split Right

- Content on the left
- Image on the right half
- Clean two-panel layout`
    },
    {
      id: 'bg-split-size',
      name: 'Split BG — Custom %',
      icon: '↔️',
      category: 'Split BG',
      description: 'Split background with custom width (e.g. left:33%)',
      markdown: `
![bg left:33%](https://picsum.photos/720/540?random=5)

# Custom Split Size

Use \`left:33%\` or \`right:40%\` to control the image panel width.

- Narrow image panel
- More space for content
- Flexible layouts`
    },
    {
      id: 'bg-split-multiple',
      name: 'Split BG — Multi Image',
      icon: '🧩',
      category: 'Split BG',
      description: 'Split layout with multiple images stacked on one side',
      markdown: `
![bg right](https://picsum.photos/720/540?random=6)
![bg](https://picsum.photos/720/540?random=7)

# Split + Multiple

Multiple images stack on the right side, content stays on the left.`
    },

    // ===== BACKGROUND — Multiple =====
    {
      id: 'bg-multiple',
      name: 'Multi BG — Horizontal',
      icon: '🔲',
      category: 'Multi BG',
      description: 'Multiple background images arranged side by side',
      markdown: `
![bg](https://fakeimg.pl/800x600/0288d1/fff/?text=A)
![bg](https://fakeimg.pl/800x600/02669d/fff/?text=B)
![bg](https://fakeimg.pl/800x600/67b8e3/fff/?text=C)

## Multiple Backgrounds`
    },
    {
      id: 'bg-multiple-vertical',
      name: 'Multi BG — Vertical',
      icon: '📊',
      category: 'Multi BG',
      description: 'Multiple backgrounds stacked vertically',
      markdown: `
![bg vertical](https://fakeimg.pl/800x600/e74c3c/fff/?text=Top)
![bg](https://fakeimg.pl/800x600/2ecc71/fff/?text=Middle)
![bg](https://fakeimg.pl/800x600/3498db/fff/?text=Bottom)

## Vertical Backgrounds`
    },

    // ===== BACKGROUND — Filters =====
    {
      id: 'bg-filter-blur',
      name: 'Filter — Blur',
      icon: '🌫️',
      category: 'BG Filter',
      description: 'Blurred background image with text overlay',
      markdown: `
![bg blur:8px](https://picsum.photos/1920/1080?random=8)

<!-- color: #fff -->

# Blurred Background

Text stands out with a blurred image behind`
    },
    {
      id: 'bg-filter-grayscale',
      name: 'Filter — Grayscale',
      icon: '🔳',
      category: 'BG Filter',
      description: 'Black & white background using grayscale filter',
      markdown: `
![bg grayscale](https://picsum.photos/1920/1080?random=9)

<!-- color: #fff -->

# Grayscale Background

Classic monochrome look using \`grayscale\` filter`
    },
    {
      id: 'bg-filter-sepia',
      name: 'Filter — Sepia + Brightness',
      icon: '🎞️',
      category: 'BG Filter',
      description: 'Combined filters for a vintage look',
      markdown: `
![bg sepia:0.8 brightness:0.7](https://picsum.photos/1920/1080?random=10)

<!-- color: #f5e6d3 -->

# Vintage Look

Multiple filters: \`sepia:0.8 brightness:0.7\``
    },

    // ===== TUTORIAL MAKER =====
    {
      id: 'tutorial-js',
      name: 'Code Tutorial — JS',
      icon: '📖',
      category: 'Tutorial Maker',
      description: 'Dark IDE-style slide with code + annotation callouts',
      markdown: `
<!-- class: tutorial-layout -->
<!-- backgroundColor: #0d1117 -->
<!-- color: #e6edf3 -->

## Async / Await in JavaScript

\`\`\`javascript
async function loadUser(id) {
  const response = await fetch(\`/api/users/\${id}\`);
  const user = await response.json();
  return user;
}
\`\`\`

<div class="tutorial-annotations">
<div class="tutorial-annotation-row"><span class="tut-num">1</span><span><span class="tut-label">async</span> — marks the function as asynchronous, it always returns a Promise.</span></div>
<div class="tutorial-annotation-row"><span class="tut-num">2</span><span><span class="tut-label">await fetch()</span> — pauses execution until the HTTP request resolves.</span></div>
<div class="tutorial-annotation-row"><span class="tut-num">3</span><span><span class="tut-label">response.json()</span> — parses the response body as JSON (also async).</span></div>
</div>`
    },
    {
      id: 'tutorial-python',
      name: 'Code Tutorial — Python',
      icon: '🐍',
      category: 'Tutorial Maker',
      description: 'Python snippet with numbered explanation boxes',
      markdown: `
<!-- class: tutorial-layout -->
<!-- backgroundColor: #0d1117 -->
<!-- color: #e6edf3 -->

## List Comprehensions in Python

\`\`\`python
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

# Square even numbers only
squares = [x**2 for x in numbers if x % 2 == 0]

print(squares)  # [4, 16, 36, 64, 100]
\`\`\`

<div class="tutorial-annotations">
<div class="tutorial-annotation-row"><span class="tut-num">1</span><span><span class="tut-label">[x**2 …]</span> — the output expression; computes the square of each item.</span></div>
<div class="tutorial-annotation-row"><span class="tut-num">2</span><span><span class="tut-label">for x in numbers</span> — iterates over every element in the list.</span></div>
<div class="tutorial-annotation-row"><span class="tut-num">3</span><span><span class="tut-label">if x % 2 == 0</span> — filter: only even numbers pass through.</span></div>
</div>`
    },
    {
      id: 'tutorial-steps',
      name: 'Code Walkthrough — Steps',
      icon: '🪜',
      category: 'Tutorial Maker',
      description: 'Step-by-step code walkthrough with numbered badges',
      markdown: `
<!-- class: tutorial-layout -->
<!-- backgroundColor: #0d1117 -->
<!-- color: #e6edf3 -->

## Setting Up Express.js

<div class="tutorial-annotation-row" style="margin-bottom:8px"><span class="tutorial-step">1</span><span>Install the package</span></div>

\`\`\`bash
npm install express
\`\`\`

<div class="tutorial-annotation-row" style="margin:8px 0"><span class="tutorial-step green">2</span><span>Create your server file</span></div>

\`\`\`javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(3000);
\`\`\`

<div class="tutorial-annotation-row" style="margin:8px 0"><span class="tutorial-step orange">3</span><span>Run it with <code>node server.js</code></span></div>`
    },
    {
      id: 'tutorial-callouts',
      name: 'Code + Callout Boxes',
      icon: '💡',
      category: 'Tutorial Maker',
      description: 'Code snippet with colorful callout explanation boxes',
      markdown: `
<!-- class: tutorial-layout -->
<!-- backgroundColor: #0d1117 -->
<!-- color: #e6edf3 -->

## React useState Hook

\`\`\`jsx
const [count, setCount] = useState(0);
\`\`\`

<div class="tutorial-callout" style="margin-top:10px;margin-bottom:6px">
<strong>count</strong> — the current state value (reads from state).
</div>
<div class="tutorial-callout green" style="margin-bottom:6px">
<strong>setCount</strong> — the setter function. Call it to update state and re-render.
</div>
<div class="tutorial-callout orange">
<strong>useState(0)</strong> — the initial value is <code>0</code>. Can be any type: number, string, object, or array.
</div>`
    },
    {
      id: 'tutorial-before-after',
      name: 'Refactor Tutorial',
      icon: '⚖️',
      category: 'Tutorial Maker',
      description: 'Before & after code comparison in tutorial style',
      markdown: `
<!-- class: tutorial-layout -->
<!-- backgroundColor: #0d1117 -->
<!-- color: #e6edf3 -->

## Refactoring: Callbacks → Async/Await

**Before (callback hell):**
\`\`\`javascript
getUser(id, (err, user) => {
  getPosts(user.id, (err, posts) => {
    getComments(posts[0].id, (err, comments) => {
      console.log(comments);
    });
  });
});
\`\`\`

**After (async/await):**
\`\`\`javascript
const user = await getUser(id);
const posts = await getPosts(user.id);
const comments = await getComments(posts[0].id);
console.log(comments);
\`\`\`

<div class="tutorial-callout green" style="margin-top:8px">Much cleaner! Linear flow is easier to read, debug, and maintain.</div>`
    },
    {
      id: 'tutorial-terminal',
      name: 'Terminal Tutorial',
      icon: '🖥️',
      category: 'Tutorial Maker',
      description: 'Terminal-style tutorial with command + output',
      markdown: `
<!-- class: tutorial-layout -->
<!-- backgroundColor: #0d1117 -->
<!-- color: #e6edf3 -->

## Git: Undo Your Last Commit

<div class="tutorial-terminal">
<div class="tutorial-terminal-bar"><span class="tutorial-terminal-title">Terminal</span></div>
<div class="tutorial-terminal-body">
<div><span class="prompt">$</span> <span class="cmd">git log --oneline -3</span></div>
<div class="output">a1b2c3d Add new feature (← this one was a mistake)</div>
<div class="output">e4f5g6h Fix typo in README</div>
<div style="margin:6px 0"></div>
<div><span class="prompt">$</span> <span class="cmd">git reset --soft HEAD~1</span></div>
<div class="success">✓ Commit removed, changes kept in staging area</div>
</div>
</div>

<div class="tutorial-annotations" style="margin-top:10px">
<div class="tutorial-annotation-row"><span class="tut-num">1</span><span><span class="tut-label">--soft</span> keeps your changes staged. Use <code>--hard</code> to discard them.</span></div>
<div class="tutorial-annotation-row"><span class="tut-num">2</span><span><span class="tut-label">HEAD~1</span> means "one commit before HEAD". Use <code>HEAD~2</code> for two commits.</span></div>
</div>`
    },
    {
      id: 'tutorial-concept',
      name: 'Concept Explainer',
      icon: '🧠',
      category: 'Tutorial Maker',
      description: 'Explain a programming concept with visual structure',
      markdown: `
<!-- class: tutorial-layout -->
<!-- backgroundColor: #0d1117 -->
<!-- color: #e6edf3 -->

## How Promises Work

\`\`\`javascript
const promise = new Promise((resolve, reject) => {
  setTimeout(() => resolve("Done!"), 1000);
});

promise
  .then(result => console.log(result))
  .catch(error => console.error(error));
\`\`\`

<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
<div class="tutorial-callout" style="flex:1;min-width:160px"><strong>Pending</strong><br>Initial state — neither fulfilled nor rejected</div>
<div class="tutorial-callout green" style="flex:1;min-width:160px"><strong>Fulfilled</strong><br><code>resolve()</code> called → <code>.then()</code> runs</div>
<div class="tutorial-callout red" style="flex:1;min-width:160px"><strong>Rejected</strong><br><code>reject()</code> called → <code>.catch()</code> runs</div>
</div>`
    },
  ];

  // Category badge colors
  const categoryColors = {
    'Basic': '#cba6f7',
    'Content': '#a6e3a1',
    'Code': '#fab387',
    'Data': '#89b4fa',
    'Media': '#f9e2af',
    'Layout': '#94e2d5',
    'Background': '#f38ba8',
    'Split BG': '#eba0ac',
    'Multi BG': '#cba6f7',
    'BG Filter': '#74c7ec',
    'Tutorial Maker': '#58a6ff',
  };

  /** Render the templates gallery into a container grouped by category */
  function renderGallery(container, onSelect) {
    container.innerHTML = '';

    // Group templates by category
    const groups = [];
    const seen = new Set();
    templates.forEach(tpl => {
      const cat = tpl.category || 'Other';
      if (!seen.has(cat)) {
        seen.add(cat);
        groups.push({ category: cat, items: [] });
      }
      groups.find(g => g.category === cat).items.push(tpl);
    });

    groups.forEach(group => {
      // Section header
      const header = document.createElement('div');
      header.className = 'tpl-section-header';
      const badgeColor = categoryColors[group.category] || '#a6adc8';
      header.innerHTML = `<span class="tpl-section-dot" style="background:${badgeColor}"></span>${group.category}`;
      container.appendChild(header);

      // Cards grid
      const grid = document.createElement('div');
      grid.className = 'tpl-section-grid';
      group.items.forEach(tpl => {
        const card = document.createElement('div');
        card.className = 'template-card';

        // Build a mini markdown preview (first few meaningful lines)
        const previewLines = tpl.markdown
          .replace(/^---[\s\S]*?---/, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .trim()
          .split('\n')
          .filter(l => l.trim())
          .slice(0, 4)
          .map(l => {
            const e = l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            if (l.match(/^#{1,3}\s/)) return '<span style="color:#cba6f7;font-weight:700">' + e + '</span>';
            if (l.match(/^[-*]\s/)) return '<span style="color:#a6e3a1">' + e + '</span>';
            if (l.match(/^\d+\.\s/)) return '<span style="color:#f9e2af">' + e + '</span>';
            if (l.match(/^[|>]/)) return '<span style="color:#89b4fa">' + e + '</span>';
            if (l.match(/^```/)) return '<span style="color:#fab387">' + e + '</span>';
            if (l.match(/^!\[/)) return '<span style="color:#f38ba8">' + e + '</span>';
            return '<span style="color:#9399b2">' + e + '</span>';
          })
          .join('<br>');

        const badgeCol = categoryColors[tpl.category] || '#a6adc8';

        card.innerHTML = `
          <div class="template-card-preview">
            <div class="tpl-preview-code">${previewLines}</div>
            <span class="tpl-preview-icon">${tpl.icon}</span>
          </div>
          <div class="template-card-info">
            <div class="tpl-card-title-row">
              <span class="tpl-type-badge" style="background:${badgeCol}">${tpl.category}</span>
              <h4>${tpl.name}</h4>
            </div>
            <p>${tpl.description}</p>
          </div>
        `;
        card.addEventListener('click', () => onSelect(tpl));
        grid.appendChild(card);
      });
      container.appendChild(grid);
    });
  }

  /** Get template by ID */
  function getTemplate(id) {
    return templates.find(t => t.id === id);
  }

  return { templates, renderGallery, getTemplate };
})();
