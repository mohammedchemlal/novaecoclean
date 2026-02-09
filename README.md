# Nova Ecoclean - Mobile (Expo)

Quick scaffold of the mobile app using Expo.

Run locally:

```bash
cd mobile
npm install
npm run start
```

Then open in Expo Go or run on simulators with `npm run android` / `npm run ios`.

Next steps:
- Migrate UI components from the web `src/components` to React Native equivalents.
- Add assets and app icon in `mobile/assets`.

## Configuration

- Authentication uses a server endpoint when `expo.extra.apiBaseUrl` is set in `app.json`. Set it to your deployed server base URL (e.g. `https://your-domain.hostingersite.com`).
- If `apiBaseUrl` is empty, the app falls back to querying Supabase `users` directly (may be blocked by RLS in production).
