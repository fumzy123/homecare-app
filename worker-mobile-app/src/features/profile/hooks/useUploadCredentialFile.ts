import { Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/lib/auth-store';
import { pickAndUploadDocument } from '@/features/profile/lib/uploadDocument';
import { upsertCredential } from '@/features/profile/api';
import type { ComplianceDocumentType } from '@/features/profile/types';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-credentials'] });
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
