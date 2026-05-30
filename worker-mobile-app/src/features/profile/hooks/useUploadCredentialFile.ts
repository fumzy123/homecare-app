import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/lib/auth-store';
import { pickAndUploadDocument } from '../lib/uploadDocument';
import { upsertCredential } from '../api';
import type { ComplianceDocumentType } from '../types';

export function useUploadCredentialFile() {
  const queryClient = useQueryClient();
  const { session } = useAuthStore();

  return useMutation({
    mutationFn: async (documentType: ComplianceDocumentType) => {
      const userId = session!.user.id;
      const storagePath = await pickAndUploadDocument(userId, documentType);
      return upsertCredential(documentType, storagePath);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-credentials'] });
    },
  });
}
