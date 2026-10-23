import { Feather } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { API_BASE_URL, WEB_BASE_URL } from '@/constants/api';
import { useAuthStore, type AuthUser } from '@/store/authStore';

type Props = {
  /** Page on the LearnIQ website, e.g. "battle-arena.html". */
  page: string;
  /** Website pages this view may move between; going anywhere else on the site closes it. */
  allowedPages: string[];
  /** The page asked to close (a game's QUIT), or tried to leave the allowed pages. */
  onExit: () => void;
  backgroundColor?: string;
};

function pageOf(url: string): string {
  try {
    return new URL(url).pathname.split('/').pop() || 'index.html';
  } catch {
    return '';
  }
}

/**
 * Runs before the page's own scripts: signs the page in with the app's session
 * (the website keeps it in sessionStorage), points it at the app's API and turns
 * on app mode (see frontend/js/shared/theme-boot.js). A page that already holds
 * this user's session keeps it — the page may have refreshed the tokens itself.
 */
function sessionScript(user: AuthUser, reloadIfLate: boolean): string {
  const sessionJson = JSON.stringify(JSON.stringify(user));
  const idNumber = JSON.stringify(user.id_number);
  const apiBase = JSON.stringify(API_BASE_URL);
  const setup =
    'var s=window.sessionStorage;var have=null;' +
    'try{have=JSON.parse(s.getItem("learniq-current-user")||"null")}catch(e){}' +
    `if(!have||have.id_number!==${idNumber}){s.setItem("learniq-current-user",${sessionJson})}` +
    's.setItem("learniq-app-mode","1");' +
    // No DOM here: at document start <html> may not exist yet. theme-boot.js
    // adds the "lq-app" class itself once it sees the flag above.
    `window.localStorage.setItem("learniq-api-base",${apiBase});`;
  if (!reloadIfLate) {
    return `(function(){try{${setup}window.__lqSessionReady=true}catch(e){}})();true;`;
  }
  // Fallback when the early script didn't run before the page did: set the
  // session now and reload once so the page starts signed in.
  return (
    '(function(){try{if(window.__lqSessionReady)return;' +
    setup +
    'if(!s.getItem("learniq-app-reloaded")){s.setItem("learniq-app-reloaded","1");window.location.reload()}' +
    '}catch(e){}})();true;'
  );
}

export function LearnIQWebView({ page, allowedPages, onExit, backgroundColor = '#0b1020' }: Props) {
  const webRef = useRef<WebView>(null);
  const user = useAuthStore((s) => s.user);
  const updateTokens = useAuthStore((s) => s.updateTokens);
  const [failed, setFailed] = useState<string | null>(null);

  // Built once per screen: the page manages (and reports back) refreshed tokens afterwards.
  const scripts = useMemo(
    () => (user ? { before: sessionScript(user, false), after: sessionScript(user, true) } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id_number],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let msg: { type?: string; access_token?: string; refresh_token?: string } | null = null;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (msg?.type === 'exit') onExit();
      else if (msg?.type === 'session' && typeof msg.access_token === 'string') {
        void updateTokens(msg.access_token, msg.refresh_token || undefined);
      }
    },
    [onExit, updateTokens],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (req: ShouldStartLoadRequest) => {
      const url = req.url || '';
      if (/^(about|data|blob):/.test(url) || req.isTopFrame === false) return true;
      if (url.startsWith(WEB_BASE_URL)) {
        if (allowedPages.includes(pageOf(url))) return true;
        onExit(); // e.g. the web Arcade or the login page: back to the app instead
        return false;
      }
      void Linking.openURL(url).catch(() => {});
      return false;
    },
    [allowedPages, onExit],
  );

  if (!user || !scripts) return null;

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <WebView
        ref={webRef}
        source={{ uri: `${WEB_BASE_URL}/${page}` }}
        injectedJavaScriptBeforeContentLoaded={scripts.before}
        injectedJavaScript={scripts.after}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        setSupportMultipleWindows={false}
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsBackForwardNavigationGestures={false}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        bounces={false}
        overScrollMode="never"
        pullToRefreshEnabled={false}
        textZoom={100}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        webviewDebuggingEnabled={__DEV__}
        style={[styles.web, { backgroundColor }]}
        containerStyle={{ backgroundColor }}
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor }]}>
            <ActivityIndicator size="large" color="#fbbf24" />
          </View>
        )}
        onLoadStart={() => setFailed(null)}
        onError={(e) => setFailed(e.nativeEvent.description || 'Could not open the game.')}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 500) setFailed(`The server had a problem (${e.nativeEvent.statusCode}).`);
        }}
        onRenderProcessGone={() => webRef.current?.reload()}
        onContentProcessDidTerminate={() => webRef.current?.reload()}
      />

      {failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.errorWrap, { backgroundColor }]}>
          <Feather name="wifi-off" size={36} color="#fde68a" />
          <Text style={styles.errorTitle}>Couldn&apos;t open the game</Text>
          <Text style={styles.errorText}>{failed}</Text>
          <View style={styles.errorActions}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => webRef.current?.reload()}>
              <Text style={styles.btnPrimaryText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={onExit}>
              <Text style={styles.btnText}>Back</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  web: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWrap: {
    paddingHorizontal: 28,
    gap: 10,
  },
  errorTitle: {
    color: '#fff7ed',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
  },
  errorText: {
    color: 'rgba(255, 247, 237, 0.8)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorActions: {
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
