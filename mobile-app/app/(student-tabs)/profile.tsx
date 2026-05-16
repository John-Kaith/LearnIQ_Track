import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoutCard } from '@/components/student-profile/LogoutCard';
import { ProfileCard } from '@/components/student-profile/ProfileCard';
import { SettingsItem } from '@/components/student-profile/SettingsItem';
import { Colors } from '@/constants/colors';
import { profileSettingsItems, studentProfileMock } from '@/data/studentProfileMock';

export default function StudentProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = studentProfileMock;

  function handleLogout() {
    Alert.alert('Logout', 'Sign out from your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => router.replace('/(auth)/login'),
      },
    ]);
  }

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
          initials={profile.initials}
          fullName={profile.fullName}
          roleAcademic={profile.roleAcademic}
          idNumber={profile.idNumber}
          approvalStatus={profile.approvalStatus}
          section={profile.section}
          strand={profile.strand}
          adviser={profile.adviser}
          memberSince={profile.memberSince}
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
