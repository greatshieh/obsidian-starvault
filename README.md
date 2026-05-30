# StarVault

[中文版](README_CN.md)

GitHub starred repositories sync and management tool for Obsidian.

## Features

- **GitHub Sync**: One-click sync your GitHub starred repositories to local
- **Smart Search**: Full-text search by repository name and description
- **Custom Tags**: Add, edit, and manage tags for repositories
- **Multi-filter**: Filter by programming language
- **Flexible Sorting**: Sort by stars, forks, or last updated time
- **Soft Delete**: Safely hide repositories, restore anytime

## Installation

1. Download the latest release from [GitHub Releases](https://github.com/greatshieh/obsidian-starnest/releases)
2. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin folder:
   ```
   <Vault>/.obsidian/plugins/starvault/
   ```
3. Enable the plugin in **Settings → Community plugins**

## Setup

1. Go to **Settings → StarVault**
2. Enter your GitHub Personal Access Token
   - Create a token at [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
   - Required scope: `repo` (full control of private repositories) or `read:user` (for public repos only)
3. Click "Sync GitHub Stars" to start syncing

## Usage

### Sidebar

- **Repository Cards**: Display name, description, language, stars, forks
- **Tags**: Show up to 3 tags, with "+N" indicator for overflow
- **Search**: Filter repositories by name or description
- **Filter**: Filter by language or status (All / Archived)
- **Sort**: Sort by Stars, Forks, or Last Updated

### Detail View

- View full repository information
- Add or edit custom tags
- Soft delete (move to archive)
- Open in browser

### Commands

| Command | Description |
|---------|-------------|
| Sync GitHub Stars | Sync all starred repositories |
| Toggle Sidebar | Show or hide the sidebar |

## Data Storage

All data is stored locally in your vault using IndexedDB:
- Repository information
- Custom tags
- Soft delete status

No data is sent to any external server.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Quick search |
| `Esc` | Close detail view |

## Support

- Report bugs: [GitHub Issues](https://github.com/greatshieh/obsidian-starnest/issues)
- Feature requests: [GitHub Discussions](https://github.com/greatshieh/obsidian-starnest/discussions)

## License

MIT
