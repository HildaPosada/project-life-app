# iPhone testing readiness — 5 November 2026

Base: `emergent` at `2db773a`. Feature branch: `codex/ios-testing-readiness`.

## Changes

- Fixed iOS bundling of the pinned Supabase client: Metro now uses legacy
  browser-field resolution for **only `ws` on iOS/Android**. All other packages
  retain Expo's default resolution. React Native's global WebSocket remains the
  runtime transport. No auth/session-storage or backend changes.
- Updated Expo 54.0.35 → 54.0.37 and expo-constants 18.0.13 → 18.0.14 using Expo
  install. This removes duplicate native constants modules. Added Yarn lockfile
  for repeatable installs; retained the existing Yarn version and resolutions.
- Sanctuary starts still until Reduce Motion resolves, ignores stale initial
  results after preference changes and unsubscribes safely on unmount. Existing
  loop cleanup, SVG botanical artwork and labeled 44×44 memory buttons remain.
- Today renders immediately without entrance animation; its menu/profile targets
  are 44×44 with VoiceOver labels. Footer targets have a 44-point minimum height.
  Sanctuary width now responds to window resizing.
- Added internal Release and simulator EAS profiles, validation scripts, four
  dependency-free Node regression tests and an iPhone setup/acceptance guide.

## Validation

| Check | Result |
| --- | --- |
| Dependency installation | Pass, Node 22.23.4 / Yarn 1.22.22; lockfile generated |
| TypeScript (`yarn typecheck`) | Pass |
| Lint (`yarn lint`) | Pass, 0 errors; 2 pre-existing warnings in AuthContext and Supabase client |
| Motion regression tests (`yarn test`) | 4/4 pass: initial preference, event precedence, unmount, query failure |
| Expo Doctor (`yarn doctor`) | 18/18 pass after patch alignment |
| iOS production JS/Hermes export | Pass, 1,659 modules, 42 assets |
| Android / web JS exports | Pass, 1,640 / 1,346 modules |
| Native signing / compilation / physical iPhone | Pending account setup and credentials; no signed artifact created |
| iOS Simulator | Not run: only Command Line Tools installed, full Xcode absent |
| Backend pytest | Not run: needs isolated API/database; fixture deletes QA data and drops user_sessions |
| Auth/journal/backend end-to-end | Not run: existing public environment values unavailable in fresh clone |

The export verifies native JavaScript bundling, not startup, native compilation,
Apple entitlements, API connectivity or session persistence. No `.env` values
were invented for the export; a runnable app requires the existing public config.

## Design review

Compared the connected Lovable project's `src/routes/today.tsx` and
`src/styles.css` with native Today, theme and Sanctuary. Both use warm paper/linen,
forest and sage with brass accents, serif editorial greetings, gentle copy,
Sanctuary, journal and reflection actions. Lovable uses Fraunces/Figtree and
browser-only local state; native keeps Georgia/system fonts and authenticated
API history. Native Today links to the existing weekly check-in instead of
copying the prototype's inline local reflection form. Pixel/gesture parity and
VoiceOver behavior still require device review.

## Remaining issues and required participation

- `eas whoami` reports **Not logged in** on this Mac. Sign in interactively.
- Link the intended Expo project; the repository currently has no EAS project ID.
- Supply the existing public backend URL, Supabase URL and client anon key to
  local `.env` and EAS preview environment. No backend credentials were changed.
- Authenticate Expo and Apple interactively, select the existing Apple team and
  register the iPhone UDID. Confirm ownership of the existing bundle ID before
  allowing EAS to create/manage signing assets. Do not share passwords in chat.
- Run the README's iPhone checklist, especially session persistence, auth
  callbacks, existing journals, all six stones on a small screen, Reduce Motion,
  VoiceOver, larger text and night-caption contrast.
- Existing Today load errors are suppressed, so failures can resemble empty
  history. This remains a follow-up requiring product/error-state design.
- Existing install warnings include deprecated transitive packages and peer/
  resolution warnings. SDK upgrades and security audit remediation need a
  separate dependency review; Doctor passing is not a vulnerability audit.

See `frontend/README.md` for exact internal build and install commands. Nothing
was published to the App Store, deployed, submitted or sent via OTA update.

Sources: [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/),
[Metro package resolution](https://docs.expo.dev/guides/customizing-metro/),
[Supabase WebSocket bundling issue](https://github.com/supabase/realtime-js/issues/415).
