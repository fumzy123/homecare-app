import { Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/lib/auth-store';
import { pickAndUploadDocument } from '@/features/profile/lib/uploadDocument';
import { upsertCredential } from '@/features/profile/api';
import { DOCUMENT_TYPE_LABELS, type ComplianceDocumentType } from '@/features/profile/types';

export function useUploadCredentialFile() {
  const queryClient = useQueryClient();
  const { session } = useAuthStore();

  return useMutation({
    mutationFn: async (documentType: ComplianceDocumentType) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Not signed in');
      const storagePath = await pickAndUploadDocument(userId, documentType);
      return upsertCredential(documentType, storagePath);
    },
    onSuccess: (_credential, documentType) => {
      void queryClient.invalidateQueries({ queryKey: ['my-credentials'] });
      Alert.alert('Document uploaded successfully', `${DOCUMENT_TYPE_LABELS[documentType]} is awaiting agency verification.`);
    },
    onError: (error: Error) => {
      if (error.message === 'CANCELLED') return;
      Alert.alert(
        'Upload failed',
        error.message || 'Something went wrong. Please try again.',
      );
    },
  });
}
