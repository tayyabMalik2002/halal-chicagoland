import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// TODO: Replace with the deployed site URL before shipping the demo build.
const SITE_URL = 'https://REPLACE-ME.netlify.app';

// Matches the --gold / --bg accent colors from css/styles.css.
const COLORS = {
  bg: '#0D0D0D',
  card: '#181818',
  border: '#2A2A2A',
  gold: '#C9A84C',
  text1: '#F5F5F5',
  text2: '#A3A3A3',
  red: '#EF4444',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <MenuAnalyzerWebView />
    </SafeAreaProvider>
  );
}

function MenuAnalyzerWebView() {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  const handleAndroidBackPress = useCallback(() => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  }, [canGoBack]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleAndroidBackPress
    );
    return () => subscription.remove();
  }, [handleAndroidBackPress]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {hasError ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn't load the menu</Text>
          <Text style={styles.errorSubtitle}>
            Check your internet connection and try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          key={reloadKey}
          ref={webViewRef}
          source={{ uri: SITE_URL }}
          style={styles.webview}
          onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setHasError(true);
          }}
          onHttpError={() => {
            setLoading(false);
            setHasError(true);
          }}
          // Required for the photo-upload/camera flow on the menu analyzer page,
          // which uses <input type="file" accept="image/..." capture="environment">.
          allowsInlineMediaPlayback
          mediaCapturePermissionGrantType="grant"
          allowsBackForwardNavigationGestures
          // Android: lets the WebView's file input open the native camera/gallery chooser.
          allowFileAccess
          setSupportMultipleWindows={false}
        />
      )}

      {loading && !hasError && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  webview: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: COLORS.bg,
  },
  errorTitle: {
    color: COLORS.text1,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: COLORS.text2,
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.gold,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.bg,
    fontSize: 16,
    fontWeight: '700',
  },
});
