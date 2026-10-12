import { Alert, Linking } from 'react-native';

/** Open the matching environment's public account/legal pages without a session. */
export async function openWebsitePage(path: '/forgot-password' | '/privacy' | '/terms' | '/dpa') {
  const website = process.env.EXPO_PUBLIC_FRONTEND_URL?.trim();
  if (!website) {
    Alert.alert('Page unavailable', 'Contact your agency for help. The website has not been configured for this app.');
    return;
  }
  try {
    const url = new URL(website);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Invalid website configuration');
    }
    await Linking.openURL(`${website.replace(/\/+$/, '')}${path}`);
  } catch {
    Alert.alert('Could not open the page', 'Please try again, or contact your agency for help.');
  }
}
