# Renkflow Saha — native iOS and Android

The new field clients are independent native applications. `apps/native-ios` uses SwiftUI, URLSession, Keychain, AVFoundation and PhotosPicker. `apps/native-android` uses Kotlin, Jetpack Compose, OkHttp, Android Keystore, the system photo picker and Google Code Scanner. The old Expo client in `apps/mobile` is retained as legacy code and is not used by these apps.

The native design tokens mirror the current `apps/web/styles/theme.css`: neutral light/dark surfaces, solid cobalt accents, thin borders and the same geometric R mark. Fonts, navigation, controls and scanning remain native to each platform.

## Scope

- Company address and existing account sign-in; validate persisted sessions with `/api/v1/auth/me`.
- Field overview, priority work orders, search and status filters.
- Assigned work-order details, required checklists, field comments and block reporting.
- Production operations: start, pause, partial completion, pass/fail and measured quality results, job photo upload.
- Native barcode/QR scan; manual entry when a camera or scanner is unavailable. Scan content is sent as data to the server and never opened as an arbitrary URL.
- Account details and device sign-out, system light/dark appearance, accessible native controls and adaptive tablet layouts.

Workers see their assigned work orders and production operations. Office, admin and owner roles can use the field workspace. Accountants and general members are denied this focused application. Terminal work-order transitions follow existing role permissions; workers report progress and quality through the production operation state machine.

## Backend prerequisite

The same branch adds `/api/v1/field/[...path]` to the existing web backend. Deploy this backend change to a preview before testing the clients against it. No migration, new database or separate auth provider is needed. `PUBLIC_SITE_MODE=coming-soon` intentionally keeps private application APIs unavailable; use an application-enabled deployment.

All field endpoints require a verified bearer JWT and current database membership. The optional private-pilot email restriction is also enforced. Explicit response projections exclude customer details, costs, financial fields and recipe snapshots. Existing production services enforce assignment, optimistic versions, material availability, machine capacity, quantity and quality checks.

| Endpoint under `/api/v1/field` | Method | Response in `data` |
| --- | --- | --- |
| `snapshot` | GET | `workOrders`, `operations`, `permissions`, `generatedAt`, `truncated` |
| `work-orders/{uuid}` | GET | Work order, checklist and comments |
| `work-orders/{uuid}/transition` | POST | `{ accepted: true }` |
| `work-orders/{uuid}/checklist/{uuid}` | POST | `{ accepted: true }` |
| `work-orders/{uuid}/comments` | POST | `{ accepted: true }` |
| `commands` | POST | `{ accepted: true, qualityRejected: boolean }` |
| `files` | POST | Production photo metadata and existing authenticated file URL |
| `scan?code=...` | GET | Sanitized label record and optional work-order ID |

The snapshot returns up to 100 general work orders and the current production overview (at most 300 production jobs). It declares truncation; scanning can access an assigned work order outside the list. Completed/cancelled jobs are excluded from the active workspace.

## Android

Open `apps/native-android` in Android Studio. Install Android SDK 35 and JDK 21. The Gradle wrapper pins Gradle 8.13; dependencies are declared in the project.

```sh
cd apps/native-android
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

Minimum Android version: 8.0 / API 26. Target: API 35. Bundle ID: `com.renkflow.field`. Change the target SDK to the current Play requirement before store submission. The native Google scanner needs Google Play Services; its module is downloaded on first use. Camera permission is managed by the scanner, and manual code entry remains available on unsupported devices.

For Play distribution, configure a private release signing key through Android Studio or CI and build `:app:bundleRelease`. Release builds deliberately do not fall back to debug signing. Do not commit signing keys or passwords.

## iOS

Open `apps/native-ios/RenkflowField.xcodeproj` in Xcode 16 or later. Select the `RenkflowField` scheme, choose a simulator and run. Minimum iOS version: 17. Supports iPhone and iPad. Bundle ID: `com.renkflow.field`.

```sh
xcodebuild test \
  -project apps/native-ios/RenkflowField.xcodeproj \
  -scheme RenkflowField \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  CODE_SIGNING_ALLOWED=NO
```

The Xcode project is checked in. Regenerate it only after adding/removing native files:

```sh
python3 scripts/generate-native-ios-project.py
```

For device builds and TestFlight, set your Apple development team in Xcode and archive with the current App Store SDK. Camera testing requires a physical device. The privacy manifest lists authentication identifiers, work photos and user-entered notes used for app functionality; reconcile store privacy declarations with the actual deployment before submission.

## Connection and retry behavior

Only HTTPS company origins are accepted. Credentials are never sent through redirects. Tokens and pending command payloads are stored in device-bound Keychain / Android Keystore encrypted storage. Passwords are not persisted. Expired/revoked sessions clear local session state.

There is no offline mutation queue in this first version. After a failed refresh, the last in-memory snapshot is visibly marked stale and new writes require a refresh. A production command is durably recorded before sending; a timeout retains the same command UUID and operation version. The visible retry button replays that exact command through the backend's existing idempotency mechanism. Other writes are disabled while the result is unresolved. Deterministic rejection clears the pending command and requires refreshing; accepted quality failures are displayed as blocked operations.

Job photos are normalized to JPEG, downsampled to 1600 pixels and limited to 2 MB before uploading. The adapter limits the actual streamed JSON body below Vercel's request size limit. Photo uploads use the existing production storage service; a configured private Blob backend is needed for live uploads. Uploading a photo does not automatically complete an operation.

## Verification

`Native Field Apps` CI builds Android, runs API/retry unit tests and lint, exercises login and encrypted persistence on an Android emulator, and builds/tests iOS on macOS. iOS UI tests exercise the real login screen and attach a screenshot. Artifacts contain the Android debug APK, screenshots and iOS test results. Web validation includes adapter tests for bearer/session separation, private-pilot access, membership, worker assignment, financial-field projections, production-only transitions, cross-origin writes, body limits and command replay identity.

The isolated database integration test uses the real password login, bearer verification, membership queries, job services, production state machine and local photo storage:

```sh
cd apps/web
npm run db:local      # Keep running in one terminal.
npm run test:field    # Run in another terminal; uses only local renkflow_test.
```

Before pilot distribution, run the following with a test company and physical devices: login, restore/expire session, scan an assigned job and a foreign-company label, update a checklist, add a field note, start/pause an operation, complete a partial quantity with passing and failing quality checks, upload a photo, retry a timed-out command, and confirm changes in the web application. Store publishing and signing are separate release steps.
