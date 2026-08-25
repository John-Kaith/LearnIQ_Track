import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoutCard } from '@/components/student-profile/LogoutCard';
import { ProfileCard } from '@/components/student-profile/ProfileCard';
import { SettingsItem } from '@/components/student-profile/SettingsItem';
import { Colors } from '@/constants/colors';
import { profileSettingsItems } from '@/data/studentProfileMock';
import { fetchMyProfileExtra } from '@/services/dashboard';
import { useAuthStore } from '@/store/authStore';

function initialsFor(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

function formatMemberSince(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function StudentProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const [adviserIdNumber, setAdviserIdNumber] = useState('');
  const [memberSince, setMemberSince] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchMyProfileExtra()
        .then(({ adviserIdNumber: adviser, createdAt }) => {
          setAdviserIdNumber(adviser);
          setMemberSince(createdAt);
        })
        .catch(() => {
          setAdviserIdNumber('');
          setMemberSince(null);
        });
    }, []),
  );

  function handleLogout() {
    Alert.alert('Logout', 'Sign out from your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const roleAcademic = [
    'Student',
    user?.grade_level ? `Grade ${user.grade_level}` : null,
    user?.strand || null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}>
        <Text style={styles.pageTitle}>Profile</Text>
        <Text style={styles.pageSubtitle}>Manage your account and app preferences.</Text>

        <ProfileCard
          initials={initialsFor(user?.first_name ?? '', user?.last_name ?? '')}
          fullName={user?.display_name ?? 'Student'}
          roleAcademic={roleAcademic || 'Student'}
          idNumber={user?.id_number ?? '—'}
          section={user?.section || '—'}
          strand={user?.strand || '—'}
          adviser={adviserIdNumber || 'Not assigned'}
          memberSince={formatMemberSince(memberSince)}
        />

        <Text style={styles.sectionTitle}>Settings</Text>

        {profileSettingsItems.map((item) => (
          <SettingsItem
            key={item.id}
            icon={item.icon}
            iconColor={item.iconColor}
            title={item.title}
            subtitle={item.subtitle}
          />
        ))}

        <LogoutCard onLogout={handleLogout} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  pageTitle: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  pageSubtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
});
