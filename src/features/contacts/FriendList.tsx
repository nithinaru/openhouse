// The list: friends already on openhouse (follow / added), then everyone else a–z with
// a search field, a letter index and an invite pill. Invites are simulated: the pill
// flips, a haptic lands, a toast confirms. No SMS, no network.

import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View, type ListRenderItem } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, FadeOut, ReduceMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, duration, ease, fonts, radius, size, space, type } from '@/theme';
import { CloseButton, Press } from '@/theme/ui';

import { Avatar } from './Avatar';
import { letterOf, sortInvite, sortOn, type Person } from './people';
import { invite, inviteMany, toggleFollow, useContactsState } from './store';

const H = { head: 56, friend: 72, letter: 30, invite: 64 } as const;

type Row =
  | { kind: 'head'; key: string; title: string; meta: string; action?: 'inviteAll' }
  | { kind: 'friend'; key: string; person: Person }
  | { kind: 'letter'; key: string; letter: string }
  | { kind: 'invite'; key: string; person: Person };

export function FriendList({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { people, followed, invited, source } = useContactsState();
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const list = useRef<FlatList<Row>>(null);

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const q = query.trim().toLowerCase();
  const on = useMemo(() => sortOn(people).filter((p) => !q || p.name.includes(q)), [people, q]);
  const rest = useMemo(() => sortInvite(people).filter((p) => !q || p.name.includes(q)), [people, q]);
  const pending = rest.filter((p) => !invited.has(p.id));

  const { rows, offsets, letters } = useMemo(() => {
    const rows: Row[] = [];
    if (on.length) {
      rows.push({ kind: 'head', key: 'h-on', title: 'on openhouse', meta: `${on.length}` });
      on.forEach((p) => rows.push({ kind: 'friend', key: p.id, person: p }));
    }
    const letters: { letter: string; index: number }[] = [];
    if (rest.length) {
      rows.push({ kind: 'head', key: 'h-inv', title: 'invite', meta: `${rest.length}`, action: 'inviteAll' });
      let last = '';
      rest.forEach((p) => {
        const l = letterOf(p.name);
        if (l !== last) {
          letters.push({ letter: l, index: rows.length });
          rows.push({ kind: 'letter', key: `l-${l}`, letter: l });
          last = l;
        }
        rows.push({ kind: 'invite', key: p.id, person: p });
      });
    }
    const offsets: number[] = [];
    let y = 0;
    rows.forEach((r) => {
      offsets.push(y);
      y += H[r.kind];
    });
    return { rows, offsets, letters };
  }, [on, rest]);

  const jumpTo = useCallback(
    (i: number) => {
      const target = letters[i];
      if (!target) return;
      void Haptics.selectionAsync().catch(() => {});
      list.current?.scrollToOffset({ offset: offsets[target.index], animated: false });
    },
    [letters, offsets],
  );

  const onFollow = useCallback(
    (p: Person) => {
      const now = toggleFollow(p.id);
      if (now) showToast(`following ${p.first}`);
    },
    [showToast],
  );

  const onInvite = useCallback(
    (p: Person) => {
      invite(p.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(`invite sent to ${p.first}`);
    },
    [showToast],
  );

  const onInviteAll = useCallback(() => {
    const n = inviteMany(pending.map((p) => p.id));
    if (!n) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showToast(`invites sent to ${n} ${n === 1 ? 'friend' : 'friends'}`);
  }, [pending, showToast]);

  const renderItem: ListRenderItem<Row> = ({ item }) => {
    switch (item.kind) {
      case 'head':
        return (
          <View style={styles.head}>
            <Text style={type.heading}>{item.title}</Text>
            <Text style={[type.stamp, { flex: 1 }]}>{item.meta}</Text>
            {item.action === 'inviteAll' ? (
              pending.length ? (
                <Press onPress={onInviteAll} haptic="none" hitSlop={8} style={styles.textAction} accessibilityRole="button" accessibilityLabel={`invite all ${pending.length}`}>
                  <Text style={styles.textActionLabel}>invite all</Text>
                </Press>
              ) : (
                <Text style={[styles.textActionLabel, { color: colors.textFaint }]}>all invited ✓</Text>
              )
            ) : null}
          </View>
        );
      case 'letter':
        return (
          <View style={styles.letter}>
            <Text style={type.stamp}>{item.letter.toLowerCase()}</Text>
          </View>
        );
      case 'friend': {
        const p = item.person;
        const isOn = followed.has(p.id);
        const sub = p.wasThere
          ? `was there · ${p.wasThere.photos} photos`
          : `on openhouse · ${p.mutual ?? 1} mutual`;
        return (
          <View style={styles.row}>
            <Avatar uri={p.uri} initials={p.initials} tint={p.tint} size={48} />
            <View style={styles.rowText}>
              <Text style={type.label} numberOfLines={1}>
                {p.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {p.wasThere ? <View style={styles.dot} /> : null}
                <Text style={[type.caption, p.wasThere && { color: colors.text }]} numberOfLines={1}>
                  {sub}
                </Text>
              </View>
            </View>
            <Pill
              on={isOn}
              offLabel="follow"
              onLabel="added ✓"
              onPress={() => onFollow(p)}
              a11y={isOn ? `unfollow ${p.name}` : `follow ${p.name}`}
            />
          </View>
        );
      }
      case 'invite': {
        const p = item.person;
        const sent = invited.has(p.id);
        return (
          <View style={[styles.row, { height: H.invite }]}>
            <Avatar uri={p.uri} initials={p.initials} tint={p.tint} size={42} />
            <View style={styles.rowText}>
              <Text style={type.label} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
            <Pill on={sent} offLabel="invite" onLabel="invited ✓" onPress={() => !sent && onInvite(p)} a11y={sent ? `${p.name} invited` : `invite ${p.name}`} sticker />
          </View>
        );
      }
    }
  };

  const total = sortOn(people).length;
  const toInvite = sortInvite(people).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.title} accessibilityRole="header">
            your people
          </Text>
          <Text style={type.caption}>
            {total} on openhouse · {toInvite} to invite{source === 'sample' ? ' · sample friends' : ''}
          </Text>
        </View>
        <CloseButton onPress={onClose} />
      </View>

      <View style={styles.search}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="search your people"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="search contacts"
        />
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={list}
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderItem}
          extraData={{ followed, invited, pending: pending.length }}
          getItemLayout={(_, i) => ({ length: H[rows[i].kind], offset: offsets[i], index: i })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingRight: space.lg + 14, paddingBottom: insets.bottom + 96 }}
          initialNumToRender={18}
          ListEmptyComponent={
            <View style={{ paddingTop: space.xl, alignItems: 'center' }}>
              <Text style={type.caption}>no one called “{query}”</Text>
            </View>
          }
          ListFooterComponent={
            rows.length ? (
              <Text style={[type.caption, styles.footer]}>contacts are matched on this phone and never uploaded.</Text>
            ) : undefined
          }
        />
        {letters.length > 1 && !q ? <LetterIndex letters={letters.map((l) => l.letter)} onJump={jumpTo} /> : null}
      </View>

      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInDown.duration(duration.fast).easing(ease.out).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(160)}
          style={[styles.toast, { bottom: insets.bottom + space.lg }]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.toastText} numberOfLines={1}>
            {toast.text}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Black pill that flips to a pink dashed sticker ("added ✓", "invited ✓"). */
function Pill({
  on,
  offLabel,
  onLabel,
  onPress,
  a11y,
  sticker,
}: {
  on: boolean;
  offLabel: string;
  onLabel: string;
  onPress: () => void;
  a11y: string;
  sticker?: boolean;
}) {
  return (
    <Press
      onPress={onPress}
      haptic={sticker ? 'none' : 'light'}
      scaleTo={0.94}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: on }}
      style={[styles.pill, on ? (sticker ? styles.pillSticker : styles.pillOn) : styles.pillOff]}
    >
      <Animated.Text key={on ? 'on' : 'off'} entering={FadeIn.duration(150)} style={[styles.pillText, { color: on ? colors.text : colors.accentInk }]}>
        {on ? onLabel : offLabel}
      </Animated.Text>
    </Press>
  );
}

/** a–z rail. Tap or drag; one selection tick per letter crossed. */
function LetterIndex({ letters, onJump }: { letters: string[]; onJump: (i: number) => void }) {
  const ROW = 16;
  const last = useSharedValue(-1);
  const n = letters.length;

  const pick = (y: number) => {
    'worklet';
    const i = Math.min(n - 1, Math.max(0, Math.floor(y / ROW)));
    if (i !== last.get()) {
      last.set(i);
      scheduleOnRN(onJump, i);
    }
  };

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => pick(e.y))
    .onUpdate((e) => pick(e.y))
    .onFinalize(() => last.set(-1));

  return (
    <View style={styles.indexWrap} pointerEvents="box-none">
      <GestureDetector gesture={gesture}>
        <View style={styles.index} hitSlop={{ left: 16, right: 8 }} accessible accessibilityLabel="letter index">
          {letters.map((l) => (
            <Text key={l} style={[styles.indexLetter, { height: ROW, lineHeight: ROW }]}>
              {l.toLowerCase()}
            </Text>
          ))}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: space.lg },
  search: {
    marginHorizontal: space.lg,
    marginTop: space.md,
    marginBottom: space.xs,
    height: size.hit,
    borderRadius: radius.full,
    backgroundColor: colors.scrimStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
  searchInput: { fontFamily: fonts.medium, fontSize: 16, color: colors.text, paddingVertical: 0 },
  head: { height: H.head, flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingBottom: space.sm },
  letter: { height: H.letter, justifyContent: 'flex-end', paddingBottom: 4 },
  row: { height: H.friend, flexDirection: 'row', alignItems: 'center', gap: space.md - 4 },
  rowText: { flex: 1, gap: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.pinkEdge },
  textAction: { minHeight: 32, justifyContent: 'center' },
  textActionLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, textTransform: 'lowercase', letterSpacing: -0.2 },
  pill: { minWidth: 92, height: 36, paddingHorizontal: 14, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  pillOff: { backgroundColor: colors.ink },
  pillOn: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.lineStrong },
  pillSticker: { backgroundColor: colors.pink, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.pinkEdge, transform: [{ rotate: '-2deg' }] },
  pillText: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: -0.2, textTransform: 'lowercase' },
  footer: { textAlign: 'center', paddingTop: space.lg, color: colors.textFaint },
  indexWrap: { position: 'absolute', top: 0, bottom: 0, right: 4, justifyContent: 'center' },
  index: { paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center' },
  indexLetter: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, textAlign: 'center', width: 14 },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '86%',
    paddingHorizontal: space.lg,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
    justifyContent: 'center',
  },
  toastText: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: -0.2, color: colors.accentInk, textTransform: 'lowercase' },
});
