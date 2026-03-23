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
    {
      id: 'starter',
      name: 'Starter Deck',
      icon: '🚀',
      description: 'A complete starter presentation with multiple slide types',
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
      description: 'Big heading with optional subtitle',
      markdown: `
# Presentation Title

Your subtitle or tagline here`
    },
    {
      id: 'title-invert',
      name: 'Title (Dark)',
      icon: '🌙',
      description: 'Title slide with dark background',
      markdown: `
<!-- backgroundColor: #1a1a2e -->
<!-- color: #eee -->

# Bold Statement

Make an impact with contrasting colors`
    },
    {
      id: 'bullets',
      name: 'Bullet Points',
      icon: '☰',
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
      id: 'code-python',
      name: 'Code (Python)',
      icon: '🐍',
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
      name: 'Code (JavaScript)',
      icon: '📜',
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
      name: 'Code Comparison',
      icon: '⚖️',
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
    {
      id: 'table',
      name: 'Data Table',
      icon: '▦',
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
    {
      id: 'image',
      name: 'Image Slide',
      icon: '🖼',
      description: 'Centered image with caption',
      markdown: `
## Architecture Diagram

![Architecture](https://via.placeholder.com/600x300/264653/ffffff?text=Your+Image+Here)

*Figure 1: System architecture overview*`
    },
    {
      id: 'image-bg',
      name: 'Background Image',
      icon: '🌄',
      description: 'Full-screen background image with text overlay',
      markdown: `
<!-- backgroundImage: url(https://via.placeholder.com/1920x1080/2d3436/ffffff?text=BG) -->
<!-- color: #fff -->

# Big Visual Slide

Text overlaid on a background image`
    },
    {
      id: 'split',
      name: 'Split (Image + Text)',
      icon: '▥',
      description: 'Image on one side, text on the other (Marp-style)',
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
    {
      id: 'math',
      name: 'Math Equations',
      icon: '∑',
      description: 'Slide with mathematical expressions (KaTeX)',
      markdown: `
## Key Formula

The quadratic formula:

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

Where $a$, $b$, and $c$ are coefficients of $ax^2 + bx + c = 0$.`
    },
    {
      id: 'quote',
      name: 'Quote Slide',
      icon: '💬',
      description: 'Featured quotation',
      markdown: `
## Inspiration

> "Any sufficiently advanced technology is indistinguishable from magic."
>
> — Arthur C. Clarke

---`
    },
    {
      id: 'fit',
      name: 'Big Word (Fit)',
      icon: '🔠',
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
      description: 'Closing slide with contact info',
      markdown: `
# Thank You! :tada:

**Your Name**
your.email@example.com

:globe: yourwebsite.com
:link: github.com/yourusername`
    },
  ];

  /** Render the templates gallery into a container */
  function renderGallery(container, onSelect) {
    container.innerHTML = '';
    templates.forEach(tpl => {
      const card = document.createElement('div');
      card.className = 'template-card';
      card.innerHTML = `
        <div class="template-card-preview">${tpl.icon}</div>
        <div class="template-card-info">
          <h4>${tpl.name}</h4>
          <p>${tpl.description}</p>
        </div>
      `;
      card.addEventListener('click', () => onSelect(tpl));
      container.appendChild(card);
    });
  }

  /** Get template by ID */
  function getTemplate(id) {
    return templates.find(t => t.id === id);
  }

  return { templates, renderGallery, getTemplate };
})();
