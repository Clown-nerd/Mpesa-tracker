# M-Pesa Tracker

An offline Android app that reads your M-Pesa SMS messages, automatically categorises them, and helps you track spending and income — all on-device with no internet required.

## Features

- **Auto-reads M-Pesa SMS** — detects "Confirmed. You have received…" (income) and "Confirmed. Ksh X sent/paid to…" (expense) messages automatically
- **Income categorisation** — after a received-money message, asks: Gig/Freelance, Parents/Family, HELB, Salary, Business, Refund, or Other
- **Expense categorisation** — after a sent/paid message, asks what it was for (Food, Transport, Rent, Electricity, Loans/Fuliza, etc.)
- **Fuliza auto-detection** — Fuliza borrow messages go straight into the Loans category
- **3 tabs**: Home (dashboard), Insights (charts), Budget (per-category budgets)
- **Fully offline** — all data stored on-device with AsyncStorage

## Running in development

```bash
npm install
npx expo start --android   # requires Expo Go or dev build on your phone
```

## Building an APK for your phone

The app uses [EAS Build](https://docs.expo.dev/build/introduction/) (Expo's cloud build service) to produce an Android APK.

### One-time setup

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account (free tier is enough)
eas login
```

### Build the APK

```bash
# Preview build — produces a direct-install .apk file
eas build --platform android --profile preview
```

When the build finishes, EAS prints a download URL. Open it on your phone and install the `.apk`.

### Local build (no Expo account needed)

If you have Android Studio and the Android SDK installed locally:

```bash
# Generate native android/ folder
npx expo prebuild --platform android

# Build debug APK
cd android && ./gradlew assembleDebug

# The APK is at:  android/app/build/outputs/apk/debug/app-debug.apk
```

Copy `app-debug.apk` to your phone and install it (enable "Unknown sources" in Settings → Security).

## Running tests

```bash
npm test
```
