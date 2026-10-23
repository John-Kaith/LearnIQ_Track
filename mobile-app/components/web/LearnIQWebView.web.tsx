import { Feather } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { WEB_BASE_URL } from '@/constants/api';

type Props = {
  page: string;
  allowedPages: string[];
  onExit: () => void;
  backgroundColor?: string;
};

/**
 * Web preview of the app (`expo start --web`): there's no WebView, and the
 * website can't be framed (its CSP only allows its own pages to frame it), so
 * the game opens on the website in a new tab instead.
 */
export function LearnIQWebView({ page, onExit, backgroundColor = '#0b1020' }: Props) {
  const url = `${WEB_BASE_URL}/${page}`;
  return (
    <View style={[styles.root, { backgroundColor }]}>
      <Feather name="monitor" size={36} color="#fde68a" />
      <Text style={styles.title}>Games play inside the phone app</Text>
      <Text style={styles.text}>
        This is the web preview of the app. Open the game on the LearnIQ website instead.
      </Text>
      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => void Linking.openURL(url)}>
          <Text style={styles.btnPrimaryText}>Open on the website</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onExit}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  title: {
    color: '#fff7ed',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },
  text: {
    color: 'rgba(255, 247, 237, 0.8)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  btn: {
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 247, 237, 0.4)',
  },
  btnText: {
    color: '#fff7ed',
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  btnPrimaryText: {
    color: '#1c1917',
    fontWeight: '800',
  },
});
// .
