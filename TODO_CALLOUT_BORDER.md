# Tutorial Callout Border Issues (To-Do)

## Summary
- The left accent stripe (vertical line) was previously implemented as a pseudo-element and hidden with `.no-accent` during export or when toggled.
- When `.no-accent` is applied, the left border disappears unless a fallback is provided.
- Patch added to show a solid left border on `.tut-callout-bubble` when `.no-accent` is present, matching the accent color.
- The border now always matches the code box, but further refinements may be needed for perfect visual fidelity.

## Outstanding Issues
- Ensure the left border always appears bold and colored correctly for all callout color variants.
- Guarantee the border matches the height of the code box, even with wrapped or multi-line content.
- Review and refactor the export logic to toggle `.no-accent` only when needed, and restore state cleanly.
- Consider a more robust approach for accent/border rendering that doesn't require toggling classes for export.

## Next Steps (when Copilot paid version is available)
- Review all callout border and accent rendering logic.
- Test with various code box sizes, colors, and export scenarios.
- Refactor for maintainability and visual consistency.
- Document any remaining edge cases or visual bugs.

---

*Saved by GitHub Copilot on 2026-04-19 for future paid version upgrades and refactoring.*
