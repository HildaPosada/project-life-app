# Project Life — Lovable → Emergent native parity

Reference implementation: https://lovable.dev/projects/2060090b-ef56-457d-a3b7-1e35f3ea02fd

**Source of truth for native shipping:** this repository's `emergent` branch, Expo/React Native. Lovable is a **web design reference**, not a drop-in native dependency. Do not copy browser-only React, CSS, TanStack Router or localStorage into Expo.

## Reviewed implementation
- Lovable `src/components/pl/Sanctuary.tsx`: sapling when growth = 0; painterly hills, seasonal foliage, subtle grain, accessible memory stones.
- Lovable `src/routes/today.tsx`: editorial date and greeting, nonjudgmental check-in, weekly reflection, Safety Net footer.
- Lovable `src/styles.css`: warm linen/paper, forest/sage/brass, serif Fraunces + sans Figtree, reduced-motion support.
- Native `frontend/src/components/SanctuaryScene.tsx`: time-of-day sky, SVG hills, memory stones and activity-based tree.
- Native `frontend/app/(tabs)/vault.tsx`: editorial journal archive, real API entries.
- Native `frontend/app/(tabs)/journey.tsx`: chapters and entitlement-aware journey.

## Applied
- Native Sanctuary now shows a sapling when activity is zero, preserving the existing animated tree once actual activity exists.

## Next implementation sequence
1. **Accessibility**: add `AccessibilityInfo.isReduceMotionEnabled()` and a change listener to the native Sanctuary; stop both animation loops when enabled; announce stones with accessible labels and roles, ensure minimum 44×44 tap targets.
2. **Theme parity**: map Lovable palette to native `frontend/src/theme` tokens, checking WCAG AA contrast before changing colors. Map typography to Expo-loaded fonts rather than assuming browser fonts are available.
3. **Today parity**: bring the calm check-in and weekly reflection into the native Today screen, connected to the existing API. Do not replace real user history with demo/local data.
4. **Sanctuary refinement**: migrate painterly details incrementally to `react-native-svg` (seasonal foliage, subtle depth) while keeping performance and day/night palettes. Ensure all milestone stones come from authorized user data.
5. **Navigation and practices**: inspect native routes and add missing experiences without breaking existing deep links, auth, journaling or entitlements.
6. **Subscriptions**: RevenueCat native and Stripe web, backed by server-verified entitlements. Do not ship test keys to production or change existing entitlement IDs without auditing consumers.
7. **Release checks**: run TypeScript, lint, Expo build, on-device visual review, account privacy and data export/delete testing before App Store submission.

## Product constraints
- **No AI companion or generative AI features.**
- No streaks, points, badges, rankings or guilt-based engagement.
- Free: Today, Sanctuary, unlimited journal, Memory Path, weekly reflections, Safety Net and first chapter.
- Premium: full guided journey and expanded curated practices; prices are proposals, not active billing.
- Trauma-informed, optional and nonjudgmental; do not claim clinical efficacy, diagnosis or crisis monitoring.
- Never overwrite user data, authentication state, backend connections or production billing configuration just to achieve visual parity.

## Important implementation distinction
Lovable's prototype may store sample data locally. The native app must continue using its existing authenticated backend. Match the **experience and visual system**, not the prototype's persistence layer.
