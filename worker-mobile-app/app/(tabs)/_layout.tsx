import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/shared/lib/auth-store';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, activeName, color, focused }: {
  name: IconName;
  activeName: IconName;
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconPill, focused && styles.activeIconPill]}>
      <Ionicons name={focused ? activeName : name} size={22} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    width: 56,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconPill: { backgroundColor: '#FFE2D4' },
});

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
        tabBarIconStyle: { width: 56, height: 30 },
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
        name="home/index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon name="home-outline" activeName="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="schedule/index"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, focused }) => <TabIcon name="calendar-outline" activeName="calendar" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clients/index"
        options={{
          title: 'Clients',
          tabBarIcon: ({ color, focused }) => <TabIcon name="people-outline" activeName="people" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ranks/index"
        options={{
          href: null,
          title: 'Rank',
          tabBarIcon: ({ color, focused }) => <TabIcon name="trophy-outline" activeName="trophy" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="me/index"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, focused }) => <TabIcon name="person-outline" activeName="person" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
