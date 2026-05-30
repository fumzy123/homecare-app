import { Alert } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { openDocumentPreview } from '../lib/openDocumentPreview';

export function useOpenDocumentPreview() {
  const { mutate, isPending } = useMutation({
    mutationFn: openDocumentPreview,
    onError: (error: Error) => {
      Alert.alert(
        'Preview unavailable',
        error.message || 'Could not open the document. Please try again.',
      );
    },
  });

  return { openPreview: mutate, isOpening: isPending };
}
