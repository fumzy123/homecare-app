import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dialog } from '@/shared/components/Dialog';
import { Btn } from '@/shared/components/ui/Btn';
import { useMyCredentials } from '../hooks/useMyCredentials';
import { useUploadCredentialFile } from '../hooks/useUploadCredentialFile';
import { useOpenDocumentPreview } from '../hooks/useOpenDocumentPreview';
import { ALL_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '../types';
import { displayDate, documentState, DOCUMENT_STATE_LABELS } from '../lib/profileView';

export function DocumentsDialog({ onClose }: { onClose: () => void }) {
  const credentials = useMyCredentials();
  const upload = useUploadCredentialFile();
  const preview = useOpenDocumentPreview();
  return <Dialog title="Credentials & documents" eyebrow="Ready for care" onClose={() => { if (!upload.isPending) onClose(); }}>
    <Text className="mb-5 font-sans text-sm leading-5 text-ink-soft">Your agency confirms which documents you need. New and replacement uploads are reviewed by your agency.</Text>
    {credentials.isPending ? <ActivityIndicator accessibilityLabel="Loading documents" color="#FF5A1F" /> : credentials.isError ? <View className="gap-4">
      <Text accessibilityRole="alert" className="font-sans text-sm text-ink">We couldn’t load your documents.</Text><Btn onPress={() => void credentials.refetch()}>Try again</Btn>
    </View> : ALL_DOCUMENT_TYPES.map(type => {
      const credential = credentials.data.find(item => item.document_type === type);
      const state = documentState(credential);
      const uploaded = !!credential?.file_url;
      const uploading = upload.isPending && upload.variables === type;
      return <View key={type} className={`mb-4 p-4 ${uploaded ? 'rounded-2xl border border-orange/30 bg-orange-soft/40' : 'border-b border-cream-2'}`}>
        <Text className="font-sans text-base font-semibold text-ink">{DOCUMENT_TYPE_LABELS[type]}</Text>
        {uploaded ? <View className="mt-3 flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-orange-soft">
            <Ionicons name="document-text" size={18} color="#4A453E" />
          </View>
          <Text className="flex-1 font-sans text-sm font-semibold text-ink">Document uploaded</Text>
        </View> : null}
        <Text className={`mt-2 font-sans text-sm ${state === 'expired' ? 'text-red-700' : 'text-ink-soft'}`}>{DOCUMENT_STATE_LABELS[state]}</Text>
        {credential?.expiry_date && <Text className="mt-1 font-sans text-xs text-ink-soft">Expires {displayDate(credential.expiry_date)}</Text>}
        <View className="mt-3 flex-row flex-wrap gap-2">
          {uploaded ? <>
            <Btn accessibilityRole="button" accessibilityLabel={`View ${DOCUMENT_TYPE_LABELS[type]}`} variant="ghost" className="bg-paper" disabled={preview.isOpening || uploading} onPress={() => preview.openPreview(credential!.file_url!)}>View document</Btn>
            <Pressable accessibilityRole="button" accessibilityLabel={`Replace ${DOCUMENT_TYPE_LABELS[type]}`} accessibilityState={{ disabled: upload.isPending }} disabled={upload.isPending}
              className={`min-h-11 justify-center px-3 ${upload.isPending ? 'opacity-50' : ''}`} onPress={() => upload.mutate(type)}>
              <Text className="font-sans text-sm text-ink-soft underline">{uploading ? 'Uploading…' : 'Replace'}</Text>
            </Pressable>
          </> : <Btn accessibilityRole="button" accessibilityLabel={`Upload ${DOCUMENT_TYPE_LABELS[type]}`} variant="ghost" disabled={upload.isPending}
            onPress={() => upload.mutate(type)}>{uploading ? 'Uploading…' : 'Upload'}</Btn>}
        </View>
      </View>;
    })}
  </Dialog>;
}
