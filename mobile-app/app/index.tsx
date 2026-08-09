import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const user = useAuthStore((s) => s.user);

  if (isHydrating) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user.role === 'teacher') {
    return <Redirect href="/(teacher-tabs)/home" />;
  }

  return <Redirect href="/(student-tabs)/home" />;
}
