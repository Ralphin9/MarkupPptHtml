# Tutorial Callout Border Issues — RESOLVED 2026-04-26

## Summary
- The left accent stripe (vertical line) is implemented as a `::before` pseudo-element.
- During export (`exportPNG`, `insertToSlide`), `.no-accent` is toggled on all callouts so that `border-left` renders in its place (html2canvas cannot capture pseudo-elements reliably).
- State is cleanly restored in the `finally` block of both export functions.

## Fixes Applied (2026-04-26)
- **CSS** (`css/tutorial-builder.css`):
  - Fixed orphaned property block after `.color-blue .tut-callout-text` — merged into the main `.tut-callout-text` rule.
  - Added explicit `no-accent.color-blue` border-left-color override (matches default blue `#58a6ff`).
  - Consolidated duplicate color overrides for `.tut-callout-text` color variants.
- **JS** (`js/tutorial-builder.js` — `insertToSlide`):
  - Added `no-accent` class to all callouts before `html2canvas` capture (matching `exportPNG` pattern).
  - Added `no-accent` removal in `finally` block to cleanly restore state.
  - Fixed broken mode-switch: was using `input[name="mode"][value="visual"]` (wrong selector); now uses `.mode-btn[data-mode="visual"]` button click.

## All Issues Resolved
- Left border appears bold and correctly colored for all color variants (blue, green, orange, purple, red).
- Accent stripe renders via `border-left` during any html2canvas capture.
- Export logic toggles `.no-accent` consistently and restores state cleanly.
- "Insert to Slide" now correctly switches back to Visual mode after insertion.
