# Cerby Password Manager – Chrome Extension

A Chrome-only browser extension (Manifest V3) for managing passwords and secrets. Opens as a **toolbar popup** when you click the extension icon.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select this project folder (the one containing `manifest.json`)
5. The extension will appear in your browser toolbar; click the icon to open the popup

## Features

- Clean and modern UI matching the Figma design
- Search functionality for accounts and secrets
- Filter by collections
- Sort accounts
- View accounts for current website
- Add new items
- SSO and MFA badge indicators

## File Structure

```
├── manifest.json              # Extension configuration (Chrome MV3)
├── background.js              # Service worker: messaging, login, windows
├── popup.html / popup.js      # Main popup UI and logic
├── popup.css                  # Styles (design tokens, Figma-aligned)
├── account-details-window.html/.js  # Expanded account details window
├── inline.js / inline.css     # Content script for login/signup pages
├── assets/                    # SVGs and images
├── icons/                     # Extension icons (16, 48, 128px)
└── README.md
```

## Adding Icons

To add extension icons:

1. Create three PNG icons:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)

2. Place them in the `icons/` folder

3. You can use the Cerby logo or create custom icons for the extension

## Development

The extension uses:
- **HTML5** for structure
- **CSS3** with design tokens matching Figma
- **Vanilla JavaScript** for functionality
- **Chrome Extension API** for storage and tabs

## Design Tokens

The extension uses design tokens from the Figma design:
- Colors: Primary (#1f2f4d), Secondary (#4f6489), Tertiary (#7187ad)
- Font: Proxima Nova (Regular 400, Semibold 600)
- Spacing: 4px, 8px, 12px, 20px
- Border radius: 4px, 8px, 32px

## Important Notes

### Permissions

The extension requires:
- `storage` - To save and load account data
- `tabs` - To detect the current website and filter accounts

### Data Storage

Account data is stored locally using Chrome's storage API. No data is sent to external servers.

## Troubleshooting

- **Extension not loading**: Check Chrome's extension error page (`chrome://extensions/`) for details
- **Icons missing**: Add PNG icon files to the `icons/` folder (see Adding Icons section)
- **Images not loading**: Ensure the `assets/` folder is present and paths in HTML/JS point to `assets/...`

## Repository

This project is ready to be pushed to a new GitHub repository:

```bash
git remote add origin https://github.com/YOUR_ORG/cerby-password-manager-extension.git
git push -u origin main
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for version control and contribution guidelines.
