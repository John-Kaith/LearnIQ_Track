import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LearnIQWebView } from '@/components/web/LearnIQWebView';
import { ARCADE_PAGES, findArcadeGame } from '@/constants/arcadeGames';
import { useAuthStore } from '@/store/authStore';

/**
 * One Arcade game, full screen: the website's game page in the app's WebView,
 * signed in with the app's session. The game's own QUIT brings the student back.
 */
export default function PlayGameScreen() {
  const { game: gameId } = useLocalSearchParams<{ game: string }>();
  const game = findArcadeGame(gameId);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ensureFreshSession = useAuthStore((s) => s.ensureFreshSession);
  const [ready, setReady] = useState(false);
  const leaving = useRef(false);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/(student-tabs)/arcade');
  }, [router]);

  // A match takes a while: start with a session that won't run out halfway.
  useEffect(() => {
    let alive = true;
    void ensureFreshSession(15 * 60).finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [ensureFreshSession]);

  // Android back button: ask first — a match in progress isn't saved.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert('Leave the game?', "A match in progress won't be saved.", [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: leave },
        ]);
        return true;
      });
      return () => sub.remove();
    }, [leave]),
  );

  if (!game) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: '#0b1020' }]}>
        <StatusBar style="light" />
        <Feather name="alert-circle" size={32} color="#fde68a" />
        <Text style={styles.missing}>That game isn&apos;t in the Arcade.</Text>
        <Pressable style={styles.backBtn} onPress={leave}>
          <Text style={styles.backText}>Back to the Arcade</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: game.bottomColor }]}>
      <StatusBar style="light" />
      <View style={{ height: insets.top, backgroundColor: game.topColor }} />
      <View
        style={[
          styles.root,
          { marginBottom: insets.bottom, marginLeft: insets.left, marginRight: insets.right },
        ]}>
        {ready ? (
          <LearnIQWebView
            page={game.page}
            allowedPages={ARCADE_PAGES}
            onExit={leave}
            backgroundColor={game.topColor}
          />
        ) : (
          <View style={[styles.root, styles.center, { backgroundColor: game.topColor }]}>
            <ActivityIndicator size="large" color="#fbbf24" />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  missing: {
    color: '#fff7ed',
    fontSize: 16,
    fontWeight: '700',
  },
  backBtn: {
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#fbbf24',
  },
  backText: {
    color: '#1c1917',
    fontWeight: '800',
  },
});
// .
