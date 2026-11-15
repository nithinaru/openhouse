import { DeviceMotion } from 'expo-sensors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { Moment, Photo } from '@/lib/types';
import { colors, space, type } from '@/theme';
import { Chip } from '@/theme/ui';

import { buildViewerHtml, injectGyro, type ViewerMessage, type ViewerNode } from './viewerHtml';

// PLACEHOLDER so the screen is demoable before buildStopSplat exists.
// Scene-scale sample from Spark's own examples (examples/assets.json, used by
// examples/mobile-joystick). Served from sparkjs.dev with
// Access-Control-Allow-Origin: *, ~6.8 MB. Spark loads SHARP .ply files the
// same way (format is auto-detected). Replace once moments carry worldSplatUrl.
export const SAMPLE_SPLAT_URL = 'https://sparkjs.dev/assets/splats/valley.spz';

// Walk mode reads a per-photo splat. Not in the shared Photo type yet, so it
// is read as an optional field here (Capy's action will add it).
type PhotoWithSplat = Photo & { splatUrl?: string };

export type WalkInSource =
  | { kind: 'splat'; html: string; walk: boolean; sample: boolean; splatUrl?: string }
  | { kind: 'hosted'; uri: string };

/** Who made the world, for the small chip in the corner. */
export type WalkInBadge = 'worldlabs' | 'demo';

const isWorldLabsUrl = (url?: string) => !!url && /worldlabs\.ai/i.test(url);

function heroPhoto(moment: Moment): Photo | undefined {
  return moment.photos.find((p) => p.id === moment.heroPhotoId) ?? moment.photos[0];
}

// Priority: per-photo splats (walk mode) -> moment.worldSplatUrl (SHARP .ply on
// the hero photo) -> moment.worldViewerUrl (World Labs hosted viewer, stretch)
// -> the public sample splat. `override` (a World Labs world just built) wins over all.
export function pickSource(moment: Moment | undefined, palette: string[], override?: { splatUrl?: string }): WalkInSource {
  const common = {
    palette,
    fogColor: colors.sky,
    arrowColor: colors.bg,
    textColor: colors.text,
  };

  // A single world splat. World Labs Marble SPZ files are in the OpenCV frame (y down,
  // z forward), same as SHARP; Marble's own viewer rotates them 180 degrees about X, which is
  // exactly flipX (quaternion (1,0,0,0)). Marble centres the world on the capture point, so the
  // origin is the right camera spot. The demo sample sits at z = -3 like Spark's examples.
  const single = (splatUrl: string): WalkInSource => {
    const hero = moment ? heroPhoto(moment) : undefined;
    const sample = splatUrl === SAMPLE_SPLAT_URL;
    return {
      kind: 'splat',
      walk: false,
      sample,
      splatUrl,
      html: buildViewerHtml({
        ...common,
        nodes: [{ splatUrl, photoUri: hero?.uri, headingDeg: hero?.headingDeg }],
        flipX: true,
        position: sample ? [0, 0, -3] : [0, 0, 0],
      }),
    };
  };

  if (override?.splatUrl) return single(override.splatUrl);

  const walkPhotos = (moment?.photos as PhotoWithSplat[] | undefined)
    ?.filter((p) => !!p.splatUrl)
    .sort((a, b) => a.takenAt - b.takenAt);
  if (moment && walkPhotos && walkPhotos.length > 0) {
    const nodes: ViewerNode[] = walkPhotos.map((p) => ({
      splatUrl: p.splatUrl,
      photoUri: p.uri,
      headingDeg: p.headingDeg,
    }));
    const hero = walkPhotos.findIndex((p) => p.id === moment.heroPhotoId);
    return {
      kind: 'splat',
      walk: nodes.length > 1,
      sample: false,
      html: buildViewerHtml({ ...common, nodes, startIndex: Math.max(0, hero) }),
    };
  }

  if (moment?.worldSplatUrl) return single(moment.worldSplatUrl);

  if (moment?.worldViewerUrl) return { kind: 'hosted', uri: moment.worldViewerUrl };

  // Spark's examples place this scene at z = -3 with the same X flip.
  const hero = moment ? heroPhoto(moment) : undefined;
  return {
    kind: 'splat',
    walk: false,
    sample: true,
    html: buildViewerHtml({
      ...common,
      nodes: [{ splatUrl: SAMPLE_SPLAT_URL, photoUri: hero?.uri }],
      position: [0, 0, -3],
    }),
  };
}

type Props = {
  moment?: Moment;
  palette?: string[];
  /** A splat to open instead of the moment's own (e.g. a World Labs world just built). */
  splatUrl?: string;
  /** Corner chip. Defaults to 'worldlabs' when the splat is on the World Labs CDN. */
  badge?: WalkInBadge;
  onNodeChange?: (index: number) => void;
};

export function WalkInViewer({ moment, palette = [], splatUrl, badge, onNodeChange }: Props) {
  const source = useMemo(() => pickSource(moment, palette, { splatUrl }), [moment, palette, splatUrl]);
  const insets = useSafeAreaInsets();
  const shownBadge: WalkInBadge | undefined =
    badge ?? (source.kind === 'splat' && isWorldLabsUrl(source.splatUrl) ? 'worldlabs' : undefined);
  // react-native-webview 14 types default the generic to `undefined`, which
  // collapses props to `never`; pin it to an empty object.
  const webRef = useRef<WebView<object>>(null);
  const [hostedLoading, setHostedLoading] = useState(source.kind === 'hosted');
  const [error, setError] = useState<string | null>(null);

  // Gyro tilt nudges the camera. DeviceMotion is in Expo Go; values are
  // injected at ~15 Hz. The page also falls back to its own deviceorientation.
  useEffect(() => {
    if (source.kind !== 'splat') return;
    let sub: { remove: () => void } | undefined;
    let cancelled = false;
    DeviceMotion.isAvailableAsync()
      .then((ok) => {
        if (!ok || cancelled) return;
        DeviceMotion.setUpdateInterval(66);
        sub = DeviceMotion.addListener(({ rotation }) => {
          if (rotation) webRef.current?.injectJavaScript(injectGyro(rotation.beta, rotation.gamma));
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [source.kind]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: ViewerMessage;
    try {
      msg = JSON.parse(e.nativeEvent.data) as ViewerMessage;
    } catch {
      return; // hosted pages may post their own messages
    }
    if (msg.type === 'node') onNodeChange?.(msg.index);
    if (msg.type === 'error' && source.kind === 'hosted') setError(msg.message);
  };

  return (
    <View style={styles.fill}>
      <WebView<object>
        ref={webRef}
        style={styles.fill}
        containerStyle={styles.fill}
        source={
          source.kind === 'hosted'
            ? { uri: source.uri }
            : // An https baseUrl gives the page a real origin for CDN/CORS fetches.
              { html: source.html, baseUrl: 'https://localhost/' }
        }
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        // keep long-press for "back to the flat photo", not the native menu
        allowsLinkPreview={false}
        textInteractionEnabled={false}
        onMessage={onMessage}
        onLoadEnd={() => setHostedLoading(false)}
        onError={(e) => setError(e.nativeEvent.description || 'Could not load the viewer.')}
        onHttpError={(e) => {
          if (source.kind === 'hosted') setError(`The viewer returned ${e.nativeEvent.statusCode}.`);
        }}
      />
      {source.kind === 'hosted' && hostedLoading && !error ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={colors.ink} />
          <Text style={[type.caption, styles.gap]}>walking in…</Text>
        </View>
      ) : null}
      {error && source.kind === 'hosted' ? (
        // The splat page renders its own status text; only overlay hosted pages.
        <View style={[StyleSheet.absoluteFill, styles.center, styles.errorBg]} pointerEvents="none">
          <Text style={[type.body, styles.errorText]}>{"couldn't open this place"}</Text>
          <Text style={[type.caption, styles.errorText, styles.gap]}>{error}</Text>
        </View>
      ) : null}
      {shownBadge ? (
        <View pointerEvents="none" style={[styles.badge, { top: insets.top + space.sm + 6 }]}>
          <Chip
            tone="media"
            label={shownBadge === 'demo' ? 'demo world · world labs' : 'built with world labs'}
            style={styles.badgeChip}
            textStyle={styles.badgeText}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', right: space.md },
  badgeChip: { minHeight: 28, paddingHorizontal: space.sm + 2 },
  badgeText: { fontSize: 12 },
  fill: { flex: 1, backgroundColor: colors.sky },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  errorBg: { backgroundColor: colors.sky },
  errorText: { textAlign: 'center' },
  gap: { marginTop: space.sm },
});
