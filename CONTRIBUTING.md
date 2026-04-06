# Contributing to NEXUS FINANCE

Thank you for your interest in contributing! 🎉

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/nexus-finance.git`
3. Create a **feature branch**: `git checkout -b feat/your-feature-name`
4. Make your changes and **commit** with a clear message
5. **Push** to your fork and open a **Pull Request**

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new RWA asset scoring model
fix: resolve Pera wallet disconnect on reload
docs: update setup instructions
style: format security utils
refactor: simplify agent log subscription
```

## Branch Naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/description` | `feat/agent-kappa-bridge` |
| Bug Fix | `fix/description` | `fix/csrf-token-rotation` |
| Docs | `docs/description` | `docs/admin-setup` |
| Hotfix | `hotfix/description` | `hotfix/auth-redirect` |

## Code Standards

- **TypeScript strict mode** — no `any` unless justified with a comment
- **Component files** — one component per file, PascalCase naming
- **No secrets in code** — use `.env` variables only; run `checkEnvSecurity()` 
- **Security first** — all user inputs must pass through `sanitizeText()`
- **Responsive** — all new UI must work on 1280px+ screens

## Pull Request Checklist

- [ ] Code compiles without errors (`npm run build`)
- [ ] No console errors in browser
- [ ] New features have at least a brief description in the PR
- [ ] `.env` variables documented in `.env.Example`
- [ ] No `node_modules`, `.env`, or build artifacts committed

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS version
- Any relevant console errors

## Security Issues

**Do not open public issues for security vulnerabilities.**  
Email the maintainers directly or use GitHub's private security advisory feature.

---

_NEXUS FINANCE — Built for AlgoBharat Hackathon 2025_
