# Contributing to Drunk Walker

Thanks for considering contributing! Here's how to get started.

## Quick Start

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/drunk-walker.git
cd drunk-walker

# Install dependencies
npm install

# Run tests
npm test -- --exclude="src/integration.test.js"

# Build the bundle
npm run build
```

## Development Workflow

1. **Create a branch** for your feature:
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make your changes** in the `src/` directory

3. **Run tests** to ensure nothing is broken:
   ```bash
   npm test -- --exclude="src/integration.test.js"
   ```

4. **Build the bundle**:
   ```bash
   npm run build
   ```

5. **Test in browser**:
   - Open Google Maps Street View
   - Paste the contents of `bookmarklet-console.js` into console
   - Verify your changes work

6. **Commit** with clear messages:
   ```bash
   git commit -m "feat: add amazing feature"
   ```

7. **Push and open a Pull Request**

## Code Style

- **Format**: Vanilla JavaScript (ES6+)
- **No dependencies**: Keep it dependency-free
- **Browser-first**: Works in browser console
- **Comments**: Minimal, focus on self-documenting code

## Testing

- **Unit tests**: `src/core/*.test.js`, `src/input/*.test.js`
- **Bundle tests**: `src/bundle.test.js`, `src/validate-bundle.test.js`
- **Integration tests**: `index.test.js`

All tests must pass before merging.

## Documentation

Update documentation if your change affects:
- User-facing features (update `README.md`)
- API or configuration (update `DEVELOPER.md`)
- Technical details (update `Spec.md`)

## Pull Request Process

1. Ensure all tests pass
2. Update documentation as needed
3. Add your change to version history if significant
4. Request review from maintainers
5. Wait for CI checks to pass
6. Merge when approved

## Questions?

- **General questions**: Open an issue
- **Bug reports**: Use the issue template
- **Feature requests**: Open an issue with use case

---

Thanks for contributing! 🤪
