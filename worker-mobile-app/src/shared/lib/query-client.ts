import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});
