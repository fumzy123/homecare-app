import { SafeAreaView } from 'react-native-safe-area-context';
import { ClientsView } from '@/features/clients/components/ClientsView';

export default function ClientsScreen() {
  return <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}><ClientsView /></SafeAreaView>;
}
