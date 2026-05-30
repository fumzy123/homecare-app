import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/shared/lib/api-client';

const BUCKET = 'compliance-documents';
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];

export async function pickAndUploadDocument(
  userId: string,
  documentType: string,
): Promise<string> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ALLOWED_TYPES,
    copyToCacheDirectory: true,
  });

  if (result.canceled) throw new Error('CANCELLED');

  const file = result.assets[0];
  const ext = file.name.split('.').pop() ?? 'pdf';
  const storagePath = `${userId}/${documentType}/document.${ext}`;

  const response = await fetch(file.uri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, {
      contentType: file.mimeType ?? 'application/pdf',
      upsert: true,
    });

  if (error) throw error;

  return storagePath;
}
