# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Bingo number drawing with big clear display
- Drawn-number grid with highlighted / faded cells
- Variant selector (90-ball, 75-ball, Speedy Bingo)
- Live sync across all room screens
- Printable player card generation

### Changed

<!-- Existing changes -->

### Deprecated

<!-- Soon-to-be removed features -->

### Removed

<!-- Removed features -->

### Fixed

<!-- Bug fixes -->

### Security

<!-- Security improvements -->

---

## [0.1.0] — 2026-08-29

### Added

- Initial project scaffolding for Bingo bingo afternoons app.
- UI components: CallerDisplay, Board, VariantSelector, GameSessionBar.
- Pages: GameRoom, AdminPanel, PlayerCard.
- SWR-based live game session state (`useGameSession.ts`).
- Number generation & validation logic.
- API documentation (`shared/flow-webservice-api-reference.md`).
- UI component documentation (`shared/flow-ui-reference.md`).
