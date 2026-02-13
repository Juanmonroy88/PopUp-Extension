# Changelog

All notable changes to this extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.42] - 2026-02-13

### Added
- Inline account dropdown: clicking the expand button now opens a top-right modal (same style as the login-suggestion modal) listing provider accounts instead of opening the extension popup. This expanded modal is twice the height and includes a search bar to filter accounts by name, email, or service.

### Fixed
- Inline menu is no longer shown on top of the provider accounts modal; the inline dropdown is suppressed while the expanded accounts modal is open since that context is not the login form.

## [1.9.41] - 2026-02-13

### Fixed
- Popup: extension popup no longer shows a solid white bar when opened. Replaced `min-height: 100vh` / `height: 100%` with a fixed height (520px) on `html`, `body`, `.browser-extension`, and `.inline-expanded-view` so the popup layout matches the actual popup viewport instead of the main browser window.

## [1.9.40] - 2026-02-13

### Fixed
- Inline account dropdown: when returning from "Save in Cerby" after clearing the field, the dropdown now appears under the input field instead of in the upper-left corner of the page.

## [1.9.39] - 2026-02-12

### Added
- Inline account dropdown: accounts are now filtered in real time as the user types in the email/username field. Matching is done against account name, email, and service (provider).
- Inline account dropdown: when typing yields no matching accounts, the dropdown is removed and replaced with the exact same signup component—just the "Save in Cerby" button (no header, no menu).
- Login pages only: when the user clears the field after seeing "Save in Cerby", Cerby shows the account dropdown again (filtered accounts). The "Use your workspace email address" suggestion is not shown on login pages—it remains only for signup pages.

## [1.9.38] - 2026-02-12

### Changed
- Inline account dropdown: header (search, settings, expand) now hides when the user scrolls down into the account list, freeing space to browse more accounts. The header reappears as soon as the user scrolls up by ~3 cards, without waiting to reach the top.

## [1.9.37] - 2026-02-12

### Fixed
- Light/simplified view (opened from inline dropdown expand): clicking "details" (info button) on an account now opens the account details modal directly, matching the full extension view. The modal and toast are moved to `body` so they display correctly when the simplified view is active. Closing the modal returns to the simplified view instead of switching to the main view.
- Account details back button: when opened from the light/simplified view, the back button now correctly closes the modal and returns to the simplified view. The modal is initialized at extension load regardless of which view is shown, so the close handler is always attached.

## [1.9.36] - 2026-02-12

### Added
- 25 additional Make accounts and 30 additional Loom accounts in popup for simulation/testing with many accounts (inline dropdown, side panel list).

## [1.9.35] - 2026-02-12

### Added
- Inline account dropdown (login pages): header buttons now use settings icon (replacing folder icon) and outlined style (border, white background) per Figma.
- Inline account dropdown: info button on each account card; appears only on hover, opens Cerby panel when clicked. Uses `assets/info-icon.svg` (vector icon from Figma).
- Background: message handlers for `cerby-inline-open-settings` and `cerby-inline-open-panel` to open the side panel (Chrome) or popup tab (Safari).

### Changed
- Inline account dropdown cards: hover state with rounded corners (8px), list spacing (gap 4px, padding 12px). Account cards use div + info button structure.
- Inline account dropdown: username (account name) no longer truncates in default state; truncation with ellipsis only applies on hover when the info icon appears and reduces available space.
- Inline account dropdown: info button occupies no layout space when hidden (width 0); animates to full width on hover.

## [1.9.34] - 2026-02-11

### Added
- Extension now opens in Chrome Side Panel when the icon is clicked instead of the toolbar-attached popup.
- Side panel shows the full Password Manager UI on the right side of the browser, in the same window as the current tab.

### Changed
- Replaced toolbar popup with Side Panel API; clicking the extension icon opens the side panel with `popup.html`.
- Extension uses full vertical space in the side panel: header and footer stay fixed while the account list scrolls to show more accounts.
- Layout updates: `.browser-extension`, `.container`, and `.content-area` use flex layout with `height: 100%` / `min-height: 100vh` to fill the viewport.
- Removed `default_popup` from manifest; added `sidePanel` permission and `side_panel.default_path`.
- Removed modal-injector content script (iframe approach was blocked by Chrome on web pages).

## [1.9.33] - 2026-02-11

### Fixed
- Popup and account details window: hover state no longer remains after the pointer leaves. Clicking a control no longer leaves it stuck in the hover style; a document-level `mouseleave` handler blurs the focused element when the pointer leaves it, and removes `.keyboard-focus` from account cards on leave.

### Changed
- Expanded account details window: content area top padding set to 24px.

## [1.9.32] - 2026-02-11

### Added
- More actions menu: "Expand account details" (under "See account details"). Opens a separate browser window (420×640) showing the same account details as the in-popup modal, with identical fields, copy actions, password reveal, TOTP timer, URL open, and styling.
- Expanded account details window is opened by the background script so it stays open when the popup is closed or the user clicks elsewhere; it only closes when the user closes that window.

## [1.9.31] - 2026-02-11

### Added
- More actions menu: separate “Copy email” and “Copy username” items (replacing “Copy email or username”). Each is shown only when the account has that field; “Copy username” when the account has a username (name or email value), “Copy email” when the card has `data-has-email` and an email value. SSO/GSSO accounts no longer show “Copy password” in the menu.

### Changed
- Account details modal: field label “Username or email” renamed to “Username”.

## [1.9.30] - 2026-02-11

### Removed
- Auto-login behavior from the login suggestion modal: overlay, spinner, and field-fill on account click have been removed. Clicking an account now only closes the modal. Asset `assets/spinner-autologin.svg` and related overlay CSS/JS removed.

## [1.9.29] - 2026-02-11

### Added
- When the user clicks an account in the login suggestion modal, the extension fills the corresponding login fields on the provider page (email/username and password when available).
- Background message `getAccountCredentials` to return stored credentials for an account; password is filled when stored in `accountCredentials` (e.g. for future vault integration).

### Changed
- Login suggestion modal: clicking an account now fills the page’s email/username and password inputs (with `input`/`change` events for framework compatibility) and closes the modal, instead of navigating away.

### Fixed
- Auto-login overlay: other Cerby UI (inline module, save-account modal) no longer appears on top of the overlay. CSS forces them hidden when `body.cerby-autologin-overlay-active` is set; JS guards prevent showing the module while the overlay is visible; fill is deferred by two animation frames so the overlay paints first.
- Auto-login overlay (follow-up): Overlay is now appended to `document.documentElement` so it always sits on top of page content; critical styles (position, size, z-index, background) are set inline so page CSS cannot override; `cerbyAutologinOverlayActive` flag blocks inline module and save-account modal for the whole overlay duration; inline module is force-removed from DOM when overlay shows; spinner img has explicit dimensions and visibility so it always displays.
- Auto-login overlay (same-frame + Shadow DOM): When the login form lives in an iframe, the overlay and fill now run in that iframe (parent finds input via `findLoginInputsInFrames()`, then `postMessage` to the iframe to run overlay + fill there) so the email popup never appears on top. Overlay content (spinner, logo, heading, subtext) is rendered inside a closed Shadow DOM so page CSS cannot hide or override the spinner or text.

## [1.9.28] - 2026-02-11

### Changed
- Login suggestion modal: delayed appearance by 0.5s after page load (was 1s).
- Login suggestion modal: vertical ease-in animation (slides up from bottom) with 0.22s transition.

## [1.9.27] - 2026-02-11

### Added
- Login suggestion modal: when the user lands on a login page for a provider where they have accounts saved in Cerby, a floating modal appears in the top-right corner (similar to Google’s “Sign in with Gmail” prompt).
- Modal shows Cerby logo and “Sign in with Cerby” heading on one line, with close button; list of matching accounts (account name, email, SSO chip when applicable).
- Account cards with hover state: Auto-login legend and icon (arrow to the right, thinner font) appear on hover; SSO chip hidden on hover.
- Clicking an account in the modal triggers the same login flow as the popup (navigate to provider login URL in current or new tab).
- Background service worker to handle `performLogin` from the content script so the modal can trigger navigation without the popup being open.
- Popup syncs account cards to `chrome.storage` on load and when organizing by website, so the content script can read matching accounts for the current site.

### Changed
- Modal width set to 397px per Figma design.
- Header: removed accounts counter; Cerby logo and “Sign in with Cerby” copy on the same line; close icon fixed (using clear-icon for visibility).
- Cards: removed provider name from card (shown in context on login page); SSO chip aligned to the right with dark background and light text for contrast; pill-shaped chip (rounded corners) to match extension badge.
- Make logo in modal matches extension: same Brandfetch URL, purple background (#673AB7), padding and size for contrast; other logos use same placeholder styling as extension.
- Auto-login hover: login icon rotated to point right; font weight 500 for “Auto-login” label.

## [1.9.25] - 2025-11-14

### Changed
- Tweaked the popup header padding to match the rest of the extension layout and removed the vault icon from the selector per the latest design update.

## [1.9.26] - 2025-11-14

### Added
- Vault selector dropdown built to match the latest Figma design with workspace/personal vault options.

## [1.9.24] - 2025-11-14

### Changed
- Updated the popup header vault selector to match the latest Figma design, including typography, layout, and hover states.

## [1.9.23] - 2025-11-14

### Changed
- Swapped the popup header logo to the updated Cerby icon from Figma and sized the container to match the design.
- Updated the Cerby logo asset color to `rgba(10, 17, 29, 1)` so it matches the current branding.

## [1.9.22] - 2025-11-14

### Changed
- Updated the bad credentials auto-login tooltip and alert banner copy to clarify that credentials might be incorrect and should be updated in Cerby.

## [1.9.21] - 2025-11-14

### Changed
- Unified the bad-credentials tooltip so Dropbox and other accounts reuse the Loom Figma design and red icon.

## [1.9.20] - 2025-11-14

### Changed
- Restored the SSO chip on account cards for Google SSO logins so users can immediately see which accounts require SSO.

## [1.9.19] - 2025-11-12

### Added
- "Logging you in..." loading state that appears when user clicks "Try anyway" on bad credentials warning
- Spinner animation with Cerby logo during login process
- Spinner base SVG asset (spinner-base.svg) matching Figma design
- Auto-dismiss functionality for loading overlay after 4 seconds

### Changed
- Updated bad credentials overlay styling to match Figma design (full-screen white background, centered content)
- Replaced CSS-based spinner with SVG spinner asset for exact Figma match
- Increased spinner rotation speed from 1s to 0.6s for better user experience
- Updated Cerby logo in spinner to use cerby-logo-modal.svg for consistency
- "Last successful login" text now displays on single line without brackets

### Fixed
- Improved spinner visual accuracy to match Figma design specifications
- Fixed text wrapping issues in "Last successful login" message

## [1.9.18] - 2025-11-12

### Added
- Bad credentials warning overlay that appears in browser tabs when attempting to login with incorrect credentials
- Content script functionality to inject warning overlay directly into login pages
- Retry logic and fallback mechanisms for reliable overlay injection
- "scripting" permission for direct script injection capabilities
- Bad credentials icon added to web_accessible_resources for use in content scripts

### Changed
- Bad credentials warning now appears as overlay in browser tab instead of extension popup
- Improved message passing between popup and content scripts with retry logic
- Enhanced error handling for overlay injection with multiple fallback strategies

### Fixed
- Fixed bad credentials warning not appearing when clicking auto-login on accounts with incorrect credentials
- Improved timing and reliability of overlay injection on login pages

## [1.9.17] - 2025-11-12

### Changed
- Updated bad credentials tooltip icon from yellow warning icon to red bad credentials icon for consistency
- Updated account details banner styling to match bad credentials chip (light red/pink background)
- Removed border from account details banner for cleaner appearance

## [1.9.16] - 2025-11-12

### Added
- "Bad credentials" badge for accounts with credential issues, replacing the alert icon overlay
- Bad credentials icon asset (bad-credentials-icon.svg) matching Figma design
- DuckDuckGo favicon service as primary logo source for improved reliability
- Comprehensive logo fallback chain: DuckDuckGo → Direct domain favicon → Google → Clearbit → Generic placeholder

### Changed
- Removed visual display of GSSO and MFA chips from account list view (badges now hidden but properties preserved)
- Updated logo loading system to use DuckDuckGo as primary source for all app logos
- Improved logo error handling with automatic fallback chain for all accounts
- Account details container now expands closer to badges, reducing white space
- Account cards now use 100% width with box-sizing to fit exactly within container
- Tooltips now properly display for account and secret action buttons on hover

### Fixed
- Fixed horizontal scrolling in items list by adjusting account card widths
- Fixed missing tooltips for account action buttons (login and "More actions")
- Fixed missing tooltips for secret action buttons
- Fixed logo loading issues - logos now display reliably across different computers and network conditions
- Fixed tooltip visibility issues caused by overflow constraints
- Removed alert icon overlay from app logos for accounts with bad credentials

## [1.9.15] - 2025-11-12

### Fixed
- Fixed click handling for password suggestion: modal now appears even when mouseup event occurs outside suggestion area
- Fixed Cerby logo display in "Save Account" modal: removed aspect ratio distortion by updating SVG preserveAspectRatio and dimensions
- Improved click detection reliability using global mouseup listener and window-level state management

### Changed
- Updated password suggestion click handler to be more lenient with mouseup location (allows clicks within 500ms even if mouseup happens slightly outside)
- Updated Cerby logo SVG to use proper aspect ratio preservation (xMidYMid meet) instead of none
- Adjusted Cerby logo CSS dimensions to maintain correct aspect ratio (28px × 26.35px)

## [1.9.14] - 2025-11-12

### Added
- Password generator inline module for signup pages that appears below password input fields
- Cerby-generated password suggestion with highlighted numbers and special characters in teal (#007da8)
- Click-to-fill functionality: clicking suggested password fills the password input field
- Dynamic state switching: password module shows "Save in Cerby" button when user types a different password
- Password field detection for signup forms (detects password, pass, pwd in field attributes)
- Secure password generation (20 characters with lowercase, uppercase, numbers, and special characters)

### Changed
- Extended inline extension to support both email and password field types
- Updated module creation to dynamically generate email or password modules based on field type
- Improved module state management to handle both email and password field interactions

## [1.9.13] - 2025-11-12

### Fixed
- Make.com logo now displays correctly using Brandfetch logo service with purple background
- Make.com logo appears correctly in both account list view and account details modal
- Added proper fallback chain for Make.com logo (Brandfetch → Clearbit → Google favicon → local SVG)
- Fixed logo loading errors and CORS issues by adding Brandfetch to host permissions and CSP

### Changed
- Updated Make.com logo to use official Brandfetch logo as primary source
- Added purple background (#673AB7) styling for Make.com logos in both list and detail views
- Improved error handling for logo loading with proper fallback chain
- Added make-logo-container class styling for consistent purple background display

## [1.9.12] - 2025-11-12

### Added
- Inline extension module for signup pages that appears below email/username input fields
- Workspace email suggestion display in inline module
- Click-to-fill functionality: clicking suggested email fills the input field
- Dynamic state switching: module shows "Save in Cerby" button when user types a different email
- Settings button in inline module for accessing Cerby settings
- Floating positioning: inline module appears as overlay without affecting page layout
- Support for multiple provider signup pages (Make, Mailchimp, Loom, Pinterest, OpenAI, Apple, Spotify, Bitso, Capital One, Cursor, Grammarly, Google, Notion, Figma, Atlassian, Dropbox, Adobe, HubSpot, Salesforce)
- Hover states for both suggestion and save button states
- Content script with automatic detection of signup contexts and eligible input fields

### Changed
- Updated manifest.json to include content scripts and web accessible resources for inline extension
- Added host permissions for all supported provider domains

## [1.9.9] - 2025-11-12

### Added
- Keyboard accessibility for account list navigation and action buttons

### Changed
- Updated account card focus styling to match global focus treatment

## [1.9.10] - 2025-11-12

### Changed
- Ensured password and URL field keyboard focus exposes the same hover affordances and full focus ring

## [1.9.11] - 2025-11-12

### Changed
- Improved overflow dropdown keyboard navigation: auto-focus first item, enable arrow/Home/End navigation, and restore focus on close

## [1.9.7] - 2025-11-07

### Changed
- Mixed secret cards into the account list ordering while keeping their original positions relative to other items

## [1.9.6] - 2025-11-07

### Changed
- Trimmed the secrets list to keep only Production API Token, Vault Root Credential Envelope, and Stripe Signing Secret in the popup

## [1.9.5] - 2025-11-07

### Changed
- Secret cards now show only the item type and secret name, keeping the secret value hidden in the list view

## [1.9.4] - 2025-11-07

### Changed
- Auto-login button tooltips now inherit the bad credentials warning treatment when accounts are flagged

### Removed
- Atlassian, HubSpot, and Salesforce account cards from the dataset
- Dropbox "Creative Archives", "Marketing Assets", and "Partner Sharing" account cards

## [1.9.3] - 2025-11-07

### Removed
- Adobe account cards from the provider list to simplify the dataset

## [1.9.2] - 2025-11-07

### Added
- Bad credentials banner in account details for flagged accounts
- Sticky account details header with warning banner between title and fields
- Dynamic attachment list rendering from card metadata
- Twenty additional account cards across Atlassian, Dropbox, Adobe, HubSpot, and Salesforce with varied SSO/MFA/alert states

## [1.9.1] - 2025-11-07

### Added
- Tooltip on bad-credentials alert icon explaining flagged state

## [1.9.0] - 2025-11-07

### Added
- Ten distinct secret cards with unique descriptions and attachment setups, including secrets without attachments

### Changed
- Secret attachment lists in the modal now render from card metadata and stay hidden when no files are present
- Styled secret detail text and attachment type badges for consistent presentation in list and modal views

## [1.8.0] - 2025-11-06

### Changed
- Hide "Other items" section title when there are no items matching the current URL (only one group visible)
- Attachments section now only appears for secret items, hidden for regular accounts

## [1.7.0] - 2025-11-06

### Added
- Secret details view with secret icon display matching list view
- Secret note field with reveal and copy buttons in account details modal
- Secret note field with dynamic sizing (single line when hidden, expands when revealed)
- Attachments section in account details modal with list of attachments
- Attachment items with attachment icon and filename display

### Changed
- Secret note field default state shows 8 obfuscated dots (hidden by default)
- Secret note field reveals full content when reveal button is clicked
- All account details fields now use #F8F8F8 background color in default state
- Secret note field header spacing reduced to 12px between title and content
- Reveal and copy buttons order changed (Reveal first, then Copy)
- Secret note field uses icon button for reveal (matching password field style)

## [1.6.0] - 2025-11-06

### Added
- Custom dropdown menu for secret items with secret-specific options:
  - Copy secret
  - See secret and attachments
  - Edit secret
- Conditional dropdown menu display - shows account items for regular accounts and secret items for secrets

### Changed
- Removed divider between "Copy secret" and "See secret and attachments" in secret dropdown menu

## [1.5.0] - 2025-11-06

### Added
- Conditional display for "Copy TOTP" item in dropdown menu - only shows for accounts with MFA badge

### Changed
- Updated dropdown menu styling:
  - Changed margins to 12px on left and right
  - Increased dropdown width from 153px to 190px to fit all content
  - Reduced dropdown font size to 12px
- Changed "Copy username" to "Copy email or username" in dropdown menu
- Updated copy functionality to copy email directly instead of extracting username from email

## [1.4.0] - 2025-11-06

### Added
- Click handler on account cards to open account details modal
- Clicking anywhere on account card (except action buttons) now opens account details

### Fixed
- Updated login URLs for all app providers to use correct login pages:
  - Make: https://www.make.com/en/login
  - Mailchimp: https://login.mailchimp.com/
  - Loom: https://www.loom.com/login
  - Pinterest: https://www.pinterest.com/login/
  - OpenAI: https://platform.openai.com/login
  - Apple: https://appleid.apple.com/
  - Spotify: https://accounts.spotify.com/en/login
  - Bitso: https://bitso.com/login
  - Capital One: https://www.capitalone.com/sign-in
  - Cursor: https://cursor.sh/login
  - Grammarly: https://www.grammarly.com/signin
  - Google: https://accounts.google.com/signin
  - Notion: https://www.notion.so/login
  - Figma: https://www.figma.com/login

## [1.3.0] - 2024-12-XX

### Added
- Alert icon badge on account logo for accounts with bad state
- Warning icon with white outline/stroke for better visibility

### Changed
- Improved alert tooltip text alignment (left-aligned instead of centered)
- Updated warning icon SVG styling with white outline around yellow circle

## [1.2.0] - 2024-12-XX

### Added
- Custom warning tooltip for Video Production Loom account auto-login button
- Warning icon from Figma design
- Tooltip displays warning message about incorrect credentials
- Tooltip positioned to prevent cutoff by popup frame

## [1.1.0] - 2024-12-XX

### Added
- Initial version control setup with Git
- Changelog for tracking changes
- Installation guide for portability
- Version control documentation
- Safari extension version

### Changed
- Improved dropdown positioning to prevent cutoff near bottom of popup (opens above button when needed)
- Fixed TOTP field border visibility and hover states
- Removed username field from account details, moved email field to top
- Updated email field label to "Username or email"
- Removed Cerby-Managed chip from account details
- Fixed TOTP counter hover state removal
- Added press states to TOTP code field copy action
- Fixed filter and sort dropdown menus functionality
- Fixed account grouping ("For this website" and "Other items") visibility
- Improved TOTP field with counter and auto-refresh functionality
- Moved TOTP field above phone number field
- Removed divider line between TOTP code and counter

### Fixed
- Dropdown menu not appearing issue (fixed display/visibility conflict)
- TOTP field bottom border visibility (changed overflow and border color)
- Hover color consistency across all fields (unified to #ced5de)
- Grouping titles appearing only after search
- Smart dropdown positioning based on available space

## [1.0.0] - Initial Release

### Features
- Account management with grouping by website
- Search and filter functionality
- Sort options (Recently used, A to Z, Z to A, Newest to oldest, Oldest to newest)
- Account details modal with password reveal
- TOTP code generation and display with counter
- Auto-login functionality
- Copy to clipboard for all fields

