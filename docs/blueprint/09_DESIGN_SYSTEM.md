# Desktop design system

Design objective: a focused verification cockpit, not an admin dashboard. References are the restraint and density of Linear/Raycast/GitHub/Arc; do not copy their branding. No giant cards, purple AI gradients, excessive glass, particles, emojis or oversized empty hero space.

## Structure and density

Minimum useful window ~1000×680; responsive down to ~800×600 without clipping primary actions. Left rail 176–208px, content max ~1120px; top bar shows project/target and run state. Use 4px spacing scale: 4/8/12/16/24/32. Data-heavy views favor rows and one detail pane, not nested card grids. Keep primary action visible without scrolling on normal laptop height. Resizable evidence/log panes may remember nonsecret layout preference.

## Color and type

Dark default: near-charcoal background, slightly raised surfaces, subtle neutral borders, off-white primary text, muted secondary text. Light variant reverses contrast without washed-out gray. System mode follows OS changes. One restrained accent (cool blue) for actions/focus; status colors: green success, red verified blocker, amber warning/incomplete, neutral gray skipped, blue information. Status always includes text/icon shape, never color alone. Typography: system sans/Inter-like; 13–14px body, 12px metadata, 16–18px section title, 24–28px verdict; tabular numerals for score/timings. Code/logs use legible monospace and wrap or scroll explicitly.

## Components

Buttons: one primary per screen, quiet secondary and destructive only where actually destructive; loading/disabled states with reasons. Dialogs: folder trust, cancel/close, remove recent, external link; clear focus trap and Escape semantics. Status banner is compact with label, score and coverage side by side. Findings use dense rows, status pill, category and expandable detail. Evidence cards have typed labels and copy control; code blocks show redaction marker. Empty states have one sentence + next action, not illustrations. Progress is an ordered stepper with elapsed time and indeterminate active state; never fabricated “85%.” Toasts confirm copy/open, persist errors until dismissed. Use native platform window chrome or a restrained titlebar with correct drag/no-drag regions.

## Accessibility and performance

**DESIGN-A11Y-001 · P1:** Meet WCAG AA contrast for text/controls, keyboard-complete operation, visible focus, screen-reader labels/role/status, reduced-motion preference, non-color state, accessible dialog focus return. No rapid animation. Virtualize or cap long logs/findings; keep renderer responsive during running verification. Do not render untrusted HTML with `dangerouslySetInnerHTML`; sanitize/escape all report text. Test dark/light/system screenshots, narrow window, long paths, Cyrillic/Unicode names and high-DPI scaling.

## Content voice

Calm, precise and nonjudgmental. “Could not verify because Chromium is unavailable” rather than “Your app is broken.” “Verified build failure” rather than “AI made a mistake.” “READY TO SHIP” always accompanied by scope (“Selected target, tested routes, this environment”) and coverage. Technical details are available but not the first line shown to a nonexpert.
