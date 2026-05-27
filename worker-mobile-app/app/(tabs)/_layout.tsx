import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/shared/lib/auth-store';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return <Ionicons name={name} size={22} color={color} />;
}

export default function TabsLayout() {
  const { session, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/(auth)/login');
    }
  }, [session, isLoading, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF5A1F',
        tabBarInactiveTintColor: '#8A8378',
        tabBarStyle: {
          backgroundColor: '#F8F5EC',
          borderTopColor: '#EDE8DC',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <TabIcon name="home-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color }) => <TabIcon name="calendar-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="ranks"
        options={{
          title: 'Ranks',
          tabBarIcon: ({ color }) => <TabIcon name="trophy-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
