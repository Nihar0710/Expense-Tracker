# Expense Wallet App

A React Native (Expo) app that lets you pay any UPI ID or QR code via your
installed UPI apps (GPay/PhonePe/Paytm/etc.), then tracks every confirmed
payment as a categorized expense — with budgets and a monthly breakdown.

## How the payment flow actually works

This app **does not** process UPI payments itself — no app can, without
becoming an NPCI-licensed PSP. Instead it:

1. Builds a standard `upi://pay?pa=...&am=...` deep link from the entered
   UPI ID/QR code
2. Hands off to whichever UPI app is installed on the phone via `Linking.openURL()`
3. The user completes authentication and the actual transfer inside that app
4. When the user returns to this app, it asks: **"Did this payment go through?"**
   — because UPI apps don't reliably report payment status back via deep link
5. Confirmed → saved as a tracked expense. Discarded → deleted.
6. Anything left unconfirmed shows as **Pending** on the Home screen and in
   Transactions, so nothing silently disappears.

## Project structure

```
App.js                        Root component
src/
  context/WalletContext.js    Global state + DB actions (React Context)
  db/database.js              SQLite schema + queries (expo-sqlite)
  utils/upi.js                Parse/build UPI deep-link URIs
  constants/categories.js     Category list + keyword-based auto-suggestion
  hooks/useAppReturnListener.js  Detects app returning to foreground
  navigation/AppNavigator.js  Bottom tabs (Home/Transactions/Budget) + Scan/Pay stack
  screens/
    HomeScreen.js             Balance summary, quick actions, recent activity
    ScanScreen.js              QR scanner (expo-camera)
    PayScreen.js               Amount entry, triggers UPI deep link
    TransactionsScreen.js      Full history + manual add-transaction
    BudgetScreen.js            Pie chart + per-category budget progress
  components/
    ConfirmPaymentSheet.js     "Did this payment succeed?" modal
```

## Setup

```bash
npm install
npx expo start
```

Scan the QR with Expo Go (or run `npm run android` / `npm run ios` with a
simulator/emulator). You'll need a real device with a UPI app installed
(GPay, PhonePe, Paytm, BHIM) to actually test the payment hand-off — the
`upi://` scheme won't resolve to anything in a plain emulator without one
installed.

## Known limitations (by design, not oversights)

- **No guaranteed payment status.** `AppState`-based return detection can be
  delayed or missed on some Android OEM skins. The Pending banner on Home is
  the safety net — always check it if you're not sure a payment logged.
- **No real bank data.** This app never sees your actual balance or bank
  statement. "Balance" here just means income − expense as logged by you.
- **No cross-device sync.** Data is local SQLite only. Add Firebase/Supabase
  later if you want sync or multi-device support.
- **Category auto-suggestion is keyword-based**, not ML — it'll miss unusual
  payee names. Users can always override the category manually in the
  confirmation sheet.

## Natural next steps

- Favorites/recent payees for one-tap repeat payments (table already exists:
  `favorites` in `database.js`, just needs a UI)
  - Notifications reminding users to resolve pending payments
- Export transactions to CSV
- Recurring transactions (rent, subscriptions)
