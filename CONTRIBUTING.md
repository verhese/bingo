# Contributing to Bingo

Thank you for your interest in contributing to Bingo! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Before creating a bug report:

1. Search existing issues to avoid duplicates.
2. Ensure the issue is reproducible with the latest version.

When creating an issue, please include:

- A clear and descriptive title.
- Steps to reproduce the behavior.
- Expected vs. actual behavior.
- Screenshots or logs if applicable.
- Your environment (OS, Node/Python versions).

### Suggesting Features

Feature requests are welcome. Please include:

- A clear description of the proposed feature.
- The problem it solves.
- Any relevant examples or mockups.
- Potential implementation approach (optional).

## Development Setup

```bash
# Fork and clone the repository
git clone <your-fork-url>
cd bingo

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run tests to verify setup
npm test
```

### Branching Strategy

We follow [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/):

| Branch | Purpose |
|---|---|
| `main` | Production-ready code |
| `develop` | Integration branch for features |
| `feature/*` | New features |
| `bugfix/*` | Bug fixes |
| `release/*` | Release preparation |
| `hotfix/*` | Urgent production fixes |

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**

- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation changes
- `style` — Code style (formatting, semicolons, etc.)
- `refactor` — Code refactoring
- `test` — Adding or updating tests
- `chore` — Maintenance tasks

**Examples:**

```
feat(agents): add tool chaining support for agent workflows
fix(ui): resolve race condition in dashboard data polling
docs: update API reference with new endpoints
```

### Pull Request Process

1. Fork the repository and create your branch from `develop`.
2. Write or update tests as needed.
3. Update documentation accordingly (including [API reference](./shared/flow-webservice-api-reference.md) for endpoint changes).
4. Ensure all tests pass: `npm test`
5. Submit the pull request with a clear description of the changes.

## Code Style

### Python

- Follow [PEP 8](https://peps.python.org/pep-0008/) style guide.
- Use type hints where applicable.
- Maximum line length: 88 characters (Black default).

```bash
# Lint
npm run lint:py

# Format
black src/
```

### TypeScript / JavaScript

- Follow the project's ESLint + Prettier configuration.
- Use strict TypeScript mode.
- Prefer `const` over `let`; avoid `var`.

```bash
# Lint & fix
npm run lint -- --fix

# Format
npm run format
```

## Updating Documentation

After making changes to any of the following, remember to update the corresponding documentation:

| Change | Update |
|---|---|
| Webservice endpoints | `shared/flow-webservice-api-reference.md` |
| UI components/pages | `shared/flow-ui-reference.md` |
| Architecture decisions | `docs/ARCHITECTURE.md` |

## Testing

Run the full test suite before submitting:

```bash
npm test          # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e           # End-to-end tests
```

---

Thank you for helping make Bingo better! 🎉
