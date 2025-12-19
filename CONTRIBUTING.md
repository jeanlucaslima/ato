# Contributing to ATO

Thank you for your interest in contributing to ATO (Advanced Tab Organizer)!

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- Chrome browser for testing

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/jeanlucaslima/ato.git
   cd ato
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Generate icons (first time only):
   ```bash
   npm run icons
   ```

4. Build the extension:
   ```bash
   npm run build
   ```

5. Load in Chrome:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

### Development Workflow

For active development with auto-rebuild:

```bash
npm run dev
```

After each rebuild, refresh the extension in `chrome://extensions`.

## Project Structure

```
src/
├── background/
│   └── service-worker.js    # Background service worker
├── popup/
│   ├── popup.html           # Popup UI
│   ├── popup.css            # Styles
│   └── popup.js             # Popup logic
├── shared/
│   ├── tab-utils.js         # Shared utility functions
│   └── tab-utils.test.js    # Tests for utilities
└── manifest.json            # Extension manifest
```

## Code Style

- **Vanilla JavaScript**: No frameworks, keep it simple
- **JSDoc Comments**: Document all exported functions
- **Descriptive Names**: Functions should be self-documenting
- **Pure Functions**: Prefer pure functions where possible

### JSDoc Example

```javascript
/**
 * Finds duplicate tabs based on exact URL matching.
 *
 * @param {Object[]} tabs - Array of tab objects
 * @returns {Object[]} Array of duplicate tabs
 */
export function findDuplicates(tabs) {
  // ...
}
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Writing Tests

Tests are located alongside source files with `.test.js` extension.

```javascript
// src/shared/tab-utils.test.js
import { describe, it, expect } from 'vitest';
import { findDuplicates } from './tab-utils.js';

describe('findDuplicates', () => {
  it('returns empty array for no duplicates', () => {
    const tabs = [
      { id: 1, url: 'https://a.com' },
      { id: 2, url: 'https://b.com' }
    ];
    expect(findDuplicates(tabs)).toEqual([]);
  });
});
```

### Test Coverage

Focus tests on:

- **Shared utilities** (`src/shared/`): These are pure functions that can be tested in isolation
- **Edge cases**: Empty arrays, null values, invalid URLs
- **Business logic**: Duplicate detection, sorting, grouping

## Submitting Changes

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Ensure tests pass:
   ```bash
   npm test
   ```

4. Ensure build succeeds:
   ```bash
   npm run build
   ```

5. Commit with a descriptive message:
   ```bash
   git commit -m "feat: add your feature description"
   ```

6. Submit a pull request

### Commit Message Format

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

## Architecture Notes

### Two-Context Model

ATO runs in two separate contexts:

1. **Background Service Worker** (`background/service-worker.js`)
   - Runs independently in the background
   - Monitors tab events via Chrome APIs
   - Updates the badge with duplicate count
   - No DOM access

2. **Popup** (`popup/popup.html` + `.js` + `.css`)
   - Opens when user clicks extension icon
   - Renders tab lists and handles user actions
   - Each popup instance is independent

### Shared Utilities

Common logic lives in `src/shared/tab-utils.js`:

| Function | Purpose |
|----------|---------|
| `findDuplicates(tabs)` | Identifies duplicate tabs by URL |
| `extractDomain(url)` | Extracts hostname from URL |
| `countDuplicatesByUrl(tabs)` | Counts occurrences per URL |
| `groupTabsByDomain(tabs)` | Groups tabs by domain |
| `formatTimeAgo(timestamp)` | Formats relative time |
| `sortTabs(tabs, sortBy, urlCounts)` | Sorts tab arrays |

### Communication

Contexts communicate via `chrome.runtime.sendMessage()`:

```javascript
// Popup -> Background
chrome.runtime.sendMessage({ action: 'undoCloseTabs', count: 3 });

// Background listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'undoCloseTabs') {
    // Handle undo
  }
});
```

## Questions?

Open an issue on GitHub for questions or suggestions.
