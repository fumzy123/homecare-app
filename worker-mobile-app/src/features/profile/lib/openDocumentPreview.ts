import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/shared/lib/api-client';

const BUCKET = 'compliance-documents';
const SIGNED_URL_TTL_SECONDS = 60;

export async function openDocumentPreview(storagePath: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error('Could not generate a preview link.');

  await WebBrowser.openBrowserAsync(data.signedUrl, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}
