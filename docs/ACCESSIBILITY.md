# Accessibility audit

## Scope and automated checks

The lobby, game room, admin panel, and player-card workflows were checked in Chromium with Playwright and axe-core. The checks cover WCAG 2.0 A/AA, WCAG 2.1 A/AA, WCAG 2.2 AA, and axe best-practice rules. The admin panel is checked with no room selected and with an active room, and the verification dialog is checked while open. The lobby (with a room listed) and the game room are checked in both light and dark themes.

The lobby lists rooms as links in a list. Each room card links to the game room, and a separate "Admin" link (accessible name "Admin for <room>", which contains its visible text) opens that room's caller controls. Loading uses an `<output>` element and load failures use an alert. Returning to the lobby after a finished game is reset is a route change with no separate screen-reader announcement; the "Lobby" heading is the first content reached. This is covered by automated checks only, not manual screen-reader testing.

Run the checks with:

```bash
npm run test:e2e -- tests/e2e/accessibility.spec.ts
```

The browser checks also verify the board's called-state list semantics, the visible keyboard focus indicator, initial focus in the verification dialog, keyboard containment and Escape dismissal, and focus restoration to the dialog trigger. See `tests/e2e/accessibility.spec.ts` for the executable scenarios.

## Keyboard-only results

Playwright keyboard input verified that:

- Room creation (`/admin-panel/create`) and game control (`/admin-panel?room=<id>`) are separate pages. Game controls are absent until the room is open, and a missing room redirects to the lobby.
- On the create page, Tab moves through the room-name field, variant selector and other fields in visual order, with a visible focus outline. The game control page shows the room's variant and game mode as fixed text.
- Space activates the focused Verify Bingo button and moves focus into the opened dialog.
- Shift+Tab and Tab stay within the modal dialog; Escape closes it and returns focus to Verify Bingo.
- Native buttons, selects, checkboxes, and number fields remain keyboard operable. The page-level Space shortcut is ignored while an interactive control is focused; reset is available through its button rather than a single-letter hotkey.

These are automated browser keyboard checks, not a claim of physical keyboard-only user testing.

## Screen-reader testing and known limitation

Manual testing with a screen reader was not available in this environment, so no screen-reader results are claimed. This remains an explicit manual verification task before certifying the workflows against assistive technology. In particular, verify:

- Game-room navigation, live caller announcements, stage changes, and called/not-called/undone board item names.
- Admin form labels and validation/error announcements, caller actions, and verification-dialog focus and results.
- Player-card table row/column navigation, B-I-N-G-O headers, the free-space name, and PDF-export completion or error announcements.

The current PDF export is rasterized with `html2canvas`, so its card content is not tagged or navigable as document text. The on-page cards and browser-print view remain semantic HTML; an accessible downloadable alternative and manual screen-reader testing are tracked in [#30](https://github.com/verhese/bingo/issues/30).

Automated axe checks do not replace screen-reader testing. No critical or serious automated violations remain in the covered page states.
