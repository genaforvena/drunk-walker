# Drunk Walker Documentation

Welcome to the Drunk Walker documentation hub. This folder contains all technical documentation for the project.

---

## Quick Start

**New to Drunk Walker?** Start here:
1. **[README.md](../README.md)** — User guide and quick start (in project root)
2. **[HOW_IT_WORKS.md](HOW_IT_WORKS.md)** — What it measures and how it works
3. **[ALGORITHM.md](ALGORITHM.md)** — Complete walking algorithm guide

**Want to contribute?** Read:
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** — How to contribute (in project root)
- **[DEVELOPER.md](DEVELOPER.md)** — Developer guide

---

## Documentation Index

### Core Documentation

| Document | Description |
|----------|-------------|
| **[ALGORITHM.md](ALGORITHM.md)** | Complete walking algorithm guide with relative turn deltas |
| **[HOW_IT_WORKS.md](HOW_IT_WORKS.md)** | What it measures and how the system works |
| **[DEVELOPER.md](DEVELOPER.md)** | Developer guide: build, test, API reference |
| **[Spec.md](Spec.md)** | Technical specification |

### Algorithm Documentation

| Document | Description |
|----------|-------------|
| **[ALGORITHM.md](ALGORITHM.md)** | Complete walking algorithm guide with relative turn deltas, self-avoiding walk, and unstuck recovery |

### Project Information

| Document | Description |
|----------|-------------|
| **[VERSIONS.md](VERSIONS.md)** | Version history and comparison |
| **[PROJECT_MEMORY.md](PROJECT_MEMORY.md)** | Project architecture and history |

---

## Documentation Structure

```
docs/
├── README.md                 # This file - documentation index
├── ALGORITHM.md              # Core walking algorithm guide
├── HOW_IT_WORKS.md           # System overview and measurements
├── DEVELOPER.md              # Developer guide
├── Spec.md                   # Technical specification
├── UNSTUCK_ALGORITHM.md      # Unstuck recovery details
├── SELF_AVOIDING_DESIGN.md   # Self-avoiding walk design
├── VERSIONS.md               # Version history
└── PROJECT_MEMORY.md         # Project architecture
```

**Root level (project root):**
- `README.md` — Main user documentation
- `CONTRIBUTING.md` — Contribution guidelines
- `CODE_OF_CONDUCT.md` — Code of conduct
- `SECURITY.md` — Security policy
- `LICENSE` — MIT License

---

## Key Concepts

### Relative Turn Deltas (v3.69.0-EXP+)

The core innovation: store *how much we turned* at each location, not *which direction we faced*.

**Benefits:**
- Physically coherent turns (relative to arrival direction)
- Escalating left turns prevent oscillation
- Never gets stuck (will try all 360° if needed)

See **[ALGORITHM.md](ALGORITHM.md)** for complete details.

### Self-Avoiding Walk

Prefers unvisited locations for better coverage efficiency (~3-5x improvement).

See **[SELF_AVOIDING_DESIGN.md](SELF_AVOIDING_DESIGN.md)** for design details.

### Auto-Unstuck

Automatically recovers when stuck (same URL for 3+ ticks) using relative turn deltas.

See **[UNSTUCK_ALGORITHM.md](UNSTUCK_ALGORITHM.md)** for algorithm details.

---

## For Developers

### Build and Test

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build bookmarklet
npm run build
```

### Modify Navigation

Edit `src/core/navigation.js` to change:
- Turn delta calculation
- Random increment range
- Maximum turn angle
- Stuck detection threshold

See **[DEVELOPER.md](DEVELOPER.md)** for complete API reference.

### Testing

```bash
# All tests
npm test

# Algorithm tests
npx vitest run src/core/turn-and-move.test.js
npx vitest run src/core/self-avoiding.test.js
```

---

## For Users

### Quick Start

1. Go to [Google Maps Street View](https://www.google.com/maps)
2. Press **F12** to open console
3. Visit [genaforvena.github.io/drunk-walker/](https://genaforvena.github.io/drunk-walker/)
4. Click **COPY JS TO CLIPBOARD**
5. Paste into console, press Enter
6. Click **START**

See **[README.md](../README.md)** for complete user guide.

### Path Recording

Path recording saves your walk as JSON:
```json
[
  {"url": "https://...", "currentYaw": 330},
  {"url": "https://...", "currentYaw": 0}
]
```

Merge multiple sessions:
```bash
node merge-paths.js session1.json session2.json > merged.json
```

---

## Questions?

- **General questions**: Open an issue on GitHub
- **Bug reports**: Use the issue template
- **Feature requests**: Open an issue with use case

---

## External Links

- [GitHub Repository](https://github.com/genaforvena/drunk-walker)
- [GitHub Pages (Launch)](https://genaforvena.github.io/drunk-walker/)
- [Google Maps Street View](https://www.google.com/maps)
