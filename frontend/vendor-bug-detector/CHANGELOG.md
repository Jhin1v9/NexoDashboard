# Changelog

## 2.0.0 (2026-04-22)

### Major Features

- **Auto Error Detection** (`AutoErrorDetector`)
  - Automatic capture of `window.onerror`, `unhandledrejection`, and resource errors
  - Error grouping by fingerprint (deduplication)
  - Rate limiting (max 30 errors/minute)
  - Console error capture
  - Configurable ignore patterns

- **Privacy Masking Engine** (`PrivacyMasking`)
  - GDPR / CCPA / LGPD compliant by default
  - Automatic masking of: emails, credit cards, phone numbers, CPF/SSN, API keys, bearer tokens
  - Password input masking
  - Configurable CSS selectors and data attributes for custom masking
  - URL query parameter sanitization
  - Recursive object masking for network requests and logs

- **Rage Click & Dead Click Detector** (`RageClickDetector`)
  - Rage click detection: 3+ clicks on same element within 1 second
  - Dead click detection: clicks with no visual feedback within 100ms
  - Frustration score (0-100) per session
  - Most frustrated element tracking

- **Video Recorder** (`VideoRecorder`)
  - Real screen/tab recording via `MediaRecorder` + `getDisplayMedia`
  - Quality presets: low (500kbps), medium (1.5Mbps), high (4Mbps)
  - Max duration limit (default: 30s)
  - Automatic browser support detection
  - WebM/MP4 output with configurable codecs

### Improvements

- Updated `BugDetector` core to integrate all 4 new modules
- Added public accessors: `getAutoErrorDetector()`, `getPrivacyMasking()`, `getRageClickDetector()`, `getVideoRecorder()`
- Added convenience methods: `startVideoRecording()`, `stopVideoRecording()`, `getFrustrationMetrics()`
- Updated config system with defaults for all new features
- Version bump to 2.0.0

## 1.0.0 (Initial Release)

- DOM Inspector with hover highlight and CSS/XPath selectors
- Screenshot capture (element and full-page) via html2canvas
- Console and network request capture
- Performance metrics (Navigation Timing API)
- Session Replay Engine (event-based, 30s buffer)
- 8 AI Personalities analysis (Gemini, OpenAI, DeepSeek, Kimi)
- AI Chat for interactive bug debugging
- React UI components (Overlay, Modal, Panel, Annotation Canvas)
- React hooks and Vue adapter
- GitHub, Jira, Slack integrations
- Cloud API for self-hosted dashboard
- Export to Markdown, JSON, HTML, PDF
