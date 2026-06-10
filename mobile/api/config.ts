const url = process.env.EXPO_PUBLIC_API_BASE_URL || undefined;
if (!url) {
  if (!(global as any).__DEV__) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is required for non-dev builds. ' +
      'Check eas.json build.<profile>.env or your local .env for dev.',
    );
  }
}
export const DEFAULT_API_BASE_URL = url ?? 'https://example.ngrok.app';
