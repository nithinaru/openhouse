// Demo: "wish you were here as a whop app". A Whop-style community frame with our app
// embedded in its apps tab. Hardcoded; nothing here is live.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, PEOPLE, REPLAY_PHOTO, WHOP_ORANGE, WhopMark } from '@/features/whop/parts';
import { colors, fonts, radius, space, type } from '@/theme';
import { Button, CloseButton, MediaShade, Press, Sticker } from '@/theme/ui';

const COMMUNITIES = [
  { key: 'yc', label: 'yc', bg: WHOP_ORANGE },
  { key: 'ship', label: 'sh', bg: colors.skyDeep },
  { key: 'gym', label: 'gy', bg: colors.success },
  { key: 'art', label: 'ar', bg: colors.pink },
  { key: 'dev', label: 'dv', bg: colors.ink },
];

const TABS = ['chat', 'apps', 'shop'] as const;
type Tab = (typeof TABS)[number];

const CLAIMED = 113;
const MEMBERS = 180;

export default function WhopAppDemo() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<Tab>('apps');
  const [community, setCommunity] = useState('yc');
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.frame}>
        {/* left rail */}
        <View style={[styles.rail, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.railLogo}>
            <View style={styles.railLogoDot} />
          </View>
          {COMMUNITIES.map((c) => (
            <Press key={c.key} onPress={() => setCommunity(c.key)} haptic="selection" accessibilityRole="button" accessibilityLabel={`${c.label} community`}>
              <View style={[styles.railIcon, { backgroundColor: c.bg }, community === c.key && styles.railIconOn]}>
                <Text style={styles.railText}>{c.label}</Text>
              </View>
            </Press>
          ))}
          <View style={[styles.railIcon, styles.railAdd]}>
            <Text style={[styles.railText, { color: colors.textMuted }]}>+</Text>
          </View>
        </View>

        {/* community */}
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={type.heading} numberOfLines={1}>
                yc hackathon
              </Text>
              <Text style={type.caption}>{MEMBERS} members · 41 online</Text>
            </View>
            <CloseButton onPress={close} />
          </View>
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <Press key={t} onPress={() => setTab(t)} haptic="selection" accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
                <View style={[styles.tab, tab === t && styles.tabOn]}>
                  <Text style={[styles.tabText, tab === t && { color: colors.accentInk }]}>{t}</Text>
                </View>
              </Press>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
            {tab === 'apps' ? (
              <Animated.View key="apps" entering={reduced ? undefined : FadeIn.duration(220)} style={{ gap: space.md }}>
                <View style={styles.appBar}>
                  <View style={styles.appIcon}>
                    <Text style={styles.appIconText}>w</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.label}>wish you were here</Text>
                    <Text style={type.caption}>installed app · by openhouse</Text>
                  </View>
                </View>

                <Press onPress={() => router.push({ pathname: '/trip/[id]', params: { id: 'demo-yc-day' } })} accessibilityRole="button" accessibilityLabel="open the replay">
                  <View style={styles.replay}>
                    <Image source={{ uri: REPLAY_PHOTO }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                    <MediaShade from={0.35} />
                    <Sticker label="replay" small rotate={-5} style={styles.replaySticker} />
                    <View style={styles.replayText}>
                      <Text style={[type.heading, { color: colors.onMedia }]}>yc hackathon day</Text>
                      <Text style={[type.caption, { color: colors.onMedia, opacity: 0.85 }]}>6 stops · 8 am to 8 pm · dogpatch</Text>
                    </View>
                  </View>
                </Press>

                <View style={styles.card}>
                  <View style={styles.row}>
                    <Text style={[type.label, { flex: 1 }]}>the drop</Text>
                    <Text style={type.stamp}>
                      {CLAIMED} of {MEMBERS} claimed
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${(CLAIMED / MEMBERS) * 100}%` }]} />
                  </View>
                  <View style={styles.faces}>
                    {PEOPLE.map((p, i) => (
                      <Avatar key={p.id} id={p.id} name={p.name} size={30} style={{ marginLeft: i === 0 ? 0 : -10 }} />
                    ))}
                    <Text style={[type.caption, { marginLeft: space.sm }]}>rohan, sol, ines + 110 more</Text>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={type.label}>every member gets their own replay</Text>
                  <Text style={type.caption}>
                    the day, cut from where each of them stood. one install, {MEMBERS} replays.
                  </Text>
                </View>

                <Button label="install on any whop community" onPress={() => undefined} />
                <WhopMark label="whop apps" style={{ alignSelf: 'center' }} />
              </Animated.View>
            ) : (
              <View style={styles.placeholder}>
                <Text style={type.caption}>{tab === 'chat' ? '# general · 41 online' : '3 products · the drop, plus, tickets'}</Text>
                <Press onPress={() => setTab('apps')} haptic="selection" accessibilityRole="button">
                  <Text style={[type.label, { textDecorationLine: 'underline' }]}>open wish you were here →</Text>
                </Press>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky },
  frame: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden', marginTop: space.sm },
  rail: { width: 64, alignItems: 'center', gap: space.sm, paddingTop: space.md, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.line },
  railLogo: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  railLogoDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: WHOP_ORANGE },
  railIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  railIconOn: { borderWidth: 3, borderColor: colors.ink },
  railAdd: { backgroundColor: colors.bg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong },
  railText: { fontFamily: fonts.bold, fontSize: 15, color: colors.onMedia, textTransform: 'lowercase' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm },
  tabs: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surface },
  tabOn: { backgroundColor: colors.ink },
  tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, textTransform: 'lowercase' },
  appBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  appIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center' },
  appIconText: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  replay: { height: 200, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, justifyContent: 'flex-end' },
  replaySticker: { position: 'absolute', top: space.sm, left: space.sm },
  replayText: { padding: space.md, gap: 2 },
  card: { padding: space.md, gap: space.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.veil, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.pinkEdge },
  faces: { flexDirection: 'row', alignItems: 'center' },
  placeholder: { padding: space.lg, gap: space.md, alignItems: 'center' },
});
