# Project Life native app

Expo SDK 54 / React Native, using the existing authenticated backend.
Run commands below from `frontend/` with Node.js 22 LTS and Corepack enabled.

```sh
corepack enable
yarn install --frozen-lockfile
yarn typecheck
yarn lint
yarn test
yarn doctor
yarn start
```

## Environment

Obtain the existing project's values from its owner. Put them in a local,
gitignored `.env` for Metro, and the Expo **preview** environment for EAS builds:

- `EXPO_PUBLIC_BACKEND_URL`: existing HTTPS API origin, without `/api`.
- `EXPO_PUBLIC_SUPABASE_URL`: existing Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: existing client anon key.

These variables are bundled into the app. Never use a service-role key, database
password or JWT signing secret. A build without valid values is not usable for
sign-in; the existing Supabase client requires configuration at startup.
Do not change production credentials or authentication redirects for testing.
Verify that the existing provider configuration supports the app's current
`frontend://` scheme and bundle ID `com.hyperintelligence.projectlife`.

## iPhone internal build

The `preview` EAS profile is an internal Release build with an embedded JavaScript
bundle. It runs without Metro and does not submit to the App Store. No development
client dependency is needed for this profile.

1. Sign into the intended Expo account: `npx eas-cli@latest login`.
2. The app is linked to `@project-life-app/project-life-app`, project ID
   `d5b8d163-b4db-46e5-824b-85517dbcfeea`. Reuse this project; no new project
   creation is needed. The login on this Mac is scoped to this organization.
3. Set the three public variables above in that project's **preview** environment,
   reusing the existing authorized backend. Confirm them before starting a build.
4. Run `npx eas-cli@latest device:create`; open its registration link on the iPhone.
5. Run `npx eas-cli@latest build --platform ios --profile preview`.
6. Sign into Apple in the CLI when prompted, complete 2FA, select the correct team,
   and allow EAS to manage the distribution certificate and ad hoc provisioning
   profile. Include the registered iPhone in the selected devices.
7. Open the completed build's installation link/QR code on that iPhone and install.
   A newly added device needs a new build or re-signing with an updated profile.

You need Expo project access, a paid Apple Developer membership with permission
to manage signing for this bundle ID, Apple login/2FA (or existing signing assets),
and the iPhone for UDID registration. Enter passwords directly into official
prompts; do not put them in chat, Git or `.env`.

Cloud EAS builds do not require local Xcode. For simulator testing, install full
Xcode and an iOS Simulator runtime, then select Xcode's developer directory.
Build with `npx eas-cli@latest build --platform ios --profile simulator` and use
`npx eas-cli@latest build:run --platform ios` to install it in a simulator.
The simulator artifact cannot install on a physical iPhone.

SDK 54 is intentionally retained. Use the signed internal build for dependable
native testing; compatibility with the currently distributed Expo Go is not
assumed. Do not run `eas submit`, `eas update`, or a production deploy as part of
this workflow.

## Device acceptance checks

Use a designated test account and preserve existing records:

- Launch, sign in, background/foreground, relaunch and confirm session persistence.
- Test email, configured Apple/Google sign-in and password reset callbacks.
- Open Today, Journey, journal archive, existing memories, Safety Net and therapist links.
- Create a clearly identified test journal/check-in; relaunch and confirm persistence.
- Turn iOS Reduce Motion on before launch; verify still artwork. Toggle it while
  Today is visible; loops must stop/restart without losing memory navigation.
- With VoiceOver, verify stone titles, kinds and dates, and menu/profile labels.
  Tap all six stones on the smallest available iPhone and check target separation.
- Check large text, narrow screens, day/night scenes, empty history and long titles.
- Test offline startup and request failures; Today currently suppresses load errors,
  so an empty-looking screen must not be mistaken for confirmed empty history.
- Confirm entitlement-gated routes with existing test entitlements. Do not enable
  mock billing or exercise production purchases.

Backend pytest suites require an isolated disposable database and test API. Their
autouse fixture deletes QA records and drops `user_sessions`; never point them at
an existing user database. No frontend UI/E2E test runner existed at baseline.
The new Node tests cover motion-preference initialization, event races and cleanup;
they do not replace on-device testing.

References: [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/),
[Expo environment variables](https://docs.expo.dev/guides/environment-variables/).
