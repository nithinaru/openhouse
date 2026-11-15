// "i was there" share card: the hoodie on sky, the venue, coordinates and date, saved to
// Photos with react-native-view-shot. Rendered on screen so what you see is what you save.

import * as Haptics from 'expo-haptics';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { useRef, useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { colors, fonts, radius, space, type } from '@/theme';
import { Button, SkyBackground, Sticker, Wordmark } from '@/theme/ui';

import { PieceArt } from './designs';
import type { DropArt, Edition } from './model';
import { MONO_FONT } from './parts';

type CardProps = { art: DropArt; edition: Edition; serial?: string; width: number };
type ViewRef = ComponentRef<typeof View>;

export function ShareCard({ art, edition, serial, width, ref }: CardProps & { ref?: Ref<ViewRef> }) {
  const height = Math.round(width * 1.25);
  const wasThere = edition === 'was_there';
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { width, height }]}>
      <SkyBackground variant="sky" style={StyleSheet.absoluteFill} />
      <View style={styles.top}>
        <Wordmark size={18} />
        <Text style={styles.mono}>{art.dateStamp}</Text>
      </View>
      <View style={styles.art}>
        <PieceArt piece="hoodie" art={art} edition={edition} serial={serial} width={width * 0.58} />
        {wasThere ? <Sticker label={`verified at ${art.address}`} small rotate={-6} style={styles.sticker} /> : null}
      </View>
      <View style={styles.bottom}>
        <Text style={styles.headline}>{wasThere ? 'i was there.' : art.eventTitle}</Text>
        <Text style={[type.callout, { color: colors.text }]}>
          {art.venueName} · {art.address}
          {art.city ? ` · ${art.city}` : ''}
        </Text>
        <Text style={styles.mono}>
          {art.coords} · {art.dateLong}
        </Text>
      </View>
    </View>
  );
}

export function ShareCardSaver({ art, edition, serial, width }: CardProps) {
  const ref = useRef<ViewRef>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const perm = await requestPermissionsAsync(true);
      if (!perm.granted) {
        setMessage('allow photos access to save your card');
        return;
      }
      if (!ref.current) throw new Error('card not mounted');
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      await Asset.create(uri);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMessage('saved to photos');
    } catch (e) {
      console.warn('[drop] share card save failed', e);
      setMessage("couldn't save the card. try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: space.sm, alignItems: 'center' }}>
      <ShareCard ref={ref} art={art} edition={edition} serial={serial} width={width} />
      <Button variant="secondary" label="save to photos" loading={saving} onPress={() => void save()} style={{ alignSelf: 'stretch' }} />
      {message ? <Text style={type.caption}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden', padding: space.lg, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  art: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  sticker: { position: 'absolute', right: 0, bottom: space.md },
  bottom: { gap: 4 },
  headline: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 42, letterSpacing: -1.8, color: colors.text },
  mono: { fontFamily: MONO_FONT, fontSize: 11, lineHeight: 15, color: colors.text, opacity: 0.75 },
});
