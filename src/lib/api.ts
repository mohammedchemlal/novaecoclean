import Constants from 'expo-constants';

// Read base URL from Expo config extras if provided
// Set this in app.json under expo.extra.apiBaseUrl
export const API_BASE_URL: string =
  (Constants?.expoConfig as any)?.extra?.apiBaseUrl ||
  (Constants as any)?.manifest?.extra?.apiBaseUrl ||
  '';
