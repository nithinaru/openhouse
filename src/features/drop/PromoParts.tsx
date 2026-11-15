// "was there" codes and the referral card (contract: docs/WHOP.md §6).
//
// No expo-clipboard in this app, so a code sticker taps to the system share sheet (which has
// "copy") and long-presses open a big selectable code for manual copy.

import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { formatCents } from '@/features/commerce/checkout';
import { colors, duration, ease, fonts, radius, shadow, size, space, type } from '@/theme';
import { Button, Cutout, haptic, Press, Sticker } from '@/theme/ui';

import { looksLikePromo, PROMO_PERCENT_OFF, REFERRAL_SHARE, useFriendPromo, type Promo, type Referral } from './promo';

function expiryLine(expiresAt: number): string {
  const h = Math.max(0, Math.round((expiresAt - Date.now()) / 3600_000));
  return h >= 24 ? `good for ${Math.round(h / 24)}d` : `good for ${h}h`;
}

async function shareCode(code: string, percentOff: number, friendName?: string) {
  await Share.share({
    message: `${friendName ? `${friendName.toLowerCase()}, ` : ''}you were there. use ${code} for ${percentOff}% off the drop on wish you were here`,
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------------------------
// The code sticker: pink fill, dashed pink edge, slapped on crooked. Codes stay uppercase.

export function CodeSticker({
  code,
  percentOff = PROMO_PERCENT_OFF,
  friendName,
  rotate = -3,
  applied,
  onUse,
  style,
}: {
  code: string;
  percentOff?: number;
  friendName?: string;
  rotate?: number;
  applied?: boolean;
  /** Offered in the long-press card: "use it at checkout". */
  onUse?: (code: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Press
        onPress={() => void shareCode(code, percentOff, friendName)}
        onLongPress={() => {
          haptic('selection');
          setOpen(true);
        }}
        delayLongPress={450}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel={`code ${code.split('').join(' ')}, ${percentOff} percent off`}
        accessibilityHint="shares the code. long press to show it large for copying"
        style={[styles.code, applied && styles.codeApplied, { transform: [{ rotate: `${rotate}deg` }] }, style]}
      >
        <Text style={styles.codeText} numberOfLines={1}>
          {code}
        </Text>
        <Text style={styles.codeOff}>{applied ? 'applied' : `−${percentOff}%`}</Text>
      </Press>
      <CodeCard
        visible={open}
        code={code}
        percentOff={percentOff}
        friendName={friendName}
        onClose={() => setOpen(false)}
        onUse={
          onUse
            ? () => {
                setOpen(false);
                onUse(code);
              }
            : undefined
        }
      />
    </>
  );
}

/** Long-press card: the code big and selectable, so it can be copied by hand. */
function CodeCard({
  visible,
  code,
  percentOff,
  friendName,
  onClose,
  onUse,
}: {
  visible: boolean;
  code: string;
  percentOff: number;
  friendName?: string;
  onClose: () => void;
  onUse?: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="close">
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={type.caption}>{friendName ? `for ${friendName.toLowerCase()} · ` : ''}{percentOff}% off the drop</Text>
          <View style={[styles.code, styles.codeBig]}>
            <Text selectable style={[styles.codeText, styles.codeTextBig]}>
              {code}
            </Text>
          </View>
          <Text style={[type.caption, { textAlign: 'center' }]}>press and hold the code to copy it</Text>
          <Button label="share code" onPress={() => void shareCode(code, percentOff, friendName)} />
          {onUse ? <Button variant="secondary" label="use it at checkout" onPress={onUse} /> : null}
          <Button variant="quiet" label="done" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Friends you paired with, each with their code.

export type Friend = { name: string; shareCode: string; avatarUri?: string };

function FriendCode({
  friend,
  index,
  dropId,
  tripId,
  onUse,
}: {
  friend: Friend;
  index: number;
  dropId: string | null;
  tripId: string;
  onUse?: (code: string) => void;
}) {
  const promo = useFriendPromo({ friendName: friend.name, friendShareCode: friend.shareCode, dropId, tripId });
  return (
    <View style={styles.friend}>
      <Cutout uri={friend.avatarUri} name={friend.name} width={44} height={52} rotate={index % 2 ? 3 : -3} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text style={type.label}>{friend.name.toLowerCase()}</Text>
        <Text style={type.caption}>{expiryLine(promo.expiresAt)}</Text>
      </View>
      <CodeSticker code={promo.code} percentOff={promo.percentOff} friendName={friend.name} rotate={index % 2 ? 2 : -3} onUse={onUse} />
    </View>
  );
}

export function FriendCodes({
  friends,
  dropId,
  tripId,
  onUse,
}: {
  friends: Friend[];
  dropId: string | null;
  tripId: string;
  onUse?: (code: string) => void;
}) {
  if (!friends.length) return null;
  return (
    <View style={styles.panel}>
      <Text style={type.heading}>codes for your people</Text>
      <Text style={type.caption}>
        everyone you paired with today gets {PROMO_PERCENT_OFF}% off. tap a code to send it, hold to copy
      </Text>
      <View style={{ gap: space.sm, marginTop: space.xs }}>
        {friends.map((f, i) => (
          <FriendCode key={f.shareCode} friend={f} index={i} dropId={dropId} tripId={tripId} onUse={onUse} />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Pairing celebration: "rohan gets 20% off the drop".

export function PairPromo({ friendName, friendShareCode, delay = 0 }: { friendName: string; friendShareCode: string; delay?: number }) {
  const reduced = useReducedMotion();
  const promo: Promo = useFriendPromo({ friendName, friendShareCode });
  return (
    <Animated.View
      entering={reduced ? FadeIn.duration(duration.base) : FadeInDown.duration(duration.enter).delay(delay).easing(ease.out)}
      style={{ alignItems: 'center', gap: space.sm }}
    >
      <CodeSticker code={promo.code} percentOff={promo.percentOff} friendName={friendName} rotate={-4} />
      <Text style={[type.caption, { textAlign: 'center' }]}>
        {friendName.toLowerCase()} gets {promo.percentOff}% off the drop · tap to send
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------------------------
// Checkout: type or paste a code, see it applied.

export function PromoField({
  applied,
  onApply,
  onClear,
}: {
  applied: string | null;
  onApply: (code: string) => void;
  onClear: () => void;
}) {
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);

  if (applied) {
    return (
      <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.appliedRow}>
        <CodeSticker code={applied} applied rotate={-2} />
        <Text style={[type.caption, { flex: 1 }]}>{PROMO_PERCENT_OFF}% off at whop checkout</Text>
        <Button variant="quiet" label="remove" onPress={onClear} />
      </Animated.View>
    );
  }

  const submit = () => {
    const code = text.trim().toUpperCase();
    if (!looksLikePromo(code)) {
      setBad(true);
      haptic('light');
      return;
    }
    setBad(false);
    setText('');
    onApply(code);
  };

  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.field}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t.toUpperCase());
            setBad(false);
          }}
          placeholder="got a was there code?"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
          style={styles.input}
          accessibilityLabel="promo code"
        />
        <Press onPress={submit} haptic="light" accessibilityRole="button" style={styles.applyBtn}>
          <Text style={styles.applyText}>apply</Text>
        </Press>
      </View>
      {bad ? <Text style={[type.caption, { color: colors.danger }]}>that doesn’t look like a was there code</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Referral: share your drop link, earn 10% of what it sells.

export function ReferralCard({ referral }: { referral: Referral }) {
  const share = () =>
    void Share.share({ message: `the drop from today, designed from the day itself: ${referral.url}`, url: referral.url }).catch(() => undefined);
  return (
    <View style={styles.panel}>
      <View style={styles.refHead}>
        <Text style={[type.heading, { flex: 1 }]}>share your drop link · earn {Math.round(REFERRAL_SHARE * 100)}%</Text>
        {referral.source === 'local' ? <Sticker label="preview" small tone="paper" rotate={3} /> : null}
      </View>
      <Text style={type.caption}>anyone who buys through your link: you get {Math.round(REFERRAL_SHARE * 100)}% of it, paid by whop</Text>
      <View style={styles.refStats}>
        <RefStat value={formatCents(referral.earnedCents)} label="earned" />
        <RefStat value={String(referral.sales)} label="sales" />
        <RefStat value={String(referral.clicks)} label="clicks" />
      </View>
      <Text selectable style={styles.url} numberOfLines={1}>
        {referral.url}
      </Text>
      <Button variant="secondary" label="share your link" onPress={share} />
      <Press onPress={() => router.push('/whop/connect')} haptic="selection" accessibilityRole="link" style={{ alignSelf: 'center', paddingVertical: space.xs }}>
        <Text style={[type.label, { textDecorationLine: 'underline' }]}>connect whop to get paid →</Text>
      </Press>
    </View>
  );
}

function RefStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.refStat}>
      <Text style={styles.refValue}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.sm,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.pinkEdge,
    backgroundColor: colors.pink,
  },
  codeApplied: { borderStyle: 'solid' },
  codeText: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: 0.4, color: colors.text },
  codeOff: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, opacity: 0.7, textTransform: 'lowercase' },
  codeBig: { alignSelf: 'center', minHeight: 64, paddingHorizontal: space.lg, transform: [{ rotate: '-2deg' }] },
  codeTextBig: { fontSize: 26, letterSpacing: 0.6 },
  scrim: { flex: 1, backgroundColor: colors.shade, justifyContent: 'center', padding: space.lg },
  card: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: space.lg, gap: space.md, ...shadow.float },
  panel: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: space.md, gap: space.xs, ...shadow.chip },
  friend: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  appliedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: size.hit,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    paddingLeft: space.md,
    paddingRight: 4,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text, letterSpacing: 0.3, paddingVertical: space.sm },
  applyBtn: { backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: space.md, minHeight: 36, justifyContent: 'center' },
  applyText: { fontFamily: fonts.bold, fontSize: 15, color: colors.accentInk, textTransform: 'lowercase' },
  refHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  refStats: { flexDirection: 'row', gap: space.sm, marginVertical: space.sm },
  refStat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  refValue: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.6, color: colors.text, fontVariant: ['tabular-nums'] },
  url: { ...type.caption, textTransform: 'none', color: colors.text, marginBottom: space.xs },
});
