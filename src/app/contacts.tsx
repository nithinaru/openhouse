// "who was there?" — ask for contacts, find who is already on wish you were here, invite the rest.
// Contacts are read and matched on the phone; invites are simulated. Nothing leaves it.

import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AskView } from '@/features/contacts/AskView';
import { checkAccess, readContacts, requestAccess } from '@/features/contacts/device';
import { FindingView } from '@/features/contacts/FindingView';
import { FriendList } from '@/features/contacts/FriendList';
import { SAMPLE, sortOn, type Person } from '@/features/contacts/people';
import { syncContacts, useContactsState } from '@/features/contacts/store';
import { duration } from '@/theme';
import { SkyBackground } from '@/theme/ui';

type Phase = 'ask' | 'denied' | 'finding' | 'list';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function ContactsScreen() {
  const { synced } = useContactsState();
  const [phase, setPhase] = useState<Phase>(synced ? 'list' : 'ask');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Person[] | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const find = useCallback(async (source: 'device' | 'sample') => {
    setFound(null);
    setPhase('finding');
    const raw = source === 'device' ? await readContacts() : SAMPLE;
    // The beat shows the same faces, in the same order, as the list after it.
    const people = syncContacts(raw, source);
    if (alive.current) setFound(sortOn(people));
  }, []);

  const onSync = useCallback(async () => {
    setBusy(true);
    const access = await requestAccess();
    setBusy(false);
    if (access === 'granted') void find('device');
    else setPhase('denied');
  }, [find]);

  // Back from Settings with contacts switched on: carry straight on.
  useEffect(() => {
    if (phase !== 'denied') return;
    const sub = AppState.addEventListener('change', async (s) => {
      if (s === 'active' && (await checkAccess()) === 'granted') void find('device');
    });
    return () => sub.remove();
  }, [phase, find]);

  return (
    <SkyBackground variant="fade">
      {phase === 'ask' || phase === 'denied' ? (
        <Animated.View key="ask" style={{ flex: 1 }} exiting={FadeOut.duration(duration.fast)}>
          <AskView
            mode={phase}
            busy={busy}
            onSync={onSync}
            onNotNow={close}
            onOpenSettings={() => void Linking.openSettings()}
            onSample={() => void find('sample')}
          />
        </Animated.View>
      ) : phase === 'finding' ? (
        <Animated.View key="finding" style={{ flex: 1 }} entering={FadeIn.duration(duration.base)} exiting={FadeOut.duration(duration.fast)}>
          <FindingView people={found} total={found?.length ?? 0} onDone={() => setPhase('list')} />
        </Animated.View>
      ) : (
        <Animated.View key="list" style={{ flex: 1 }} entering={FadeIn.duration(duration.base)}>
          <FriendList onClose={close} />
        </Animated.View>
      )}
    </SkyBackground>
  );
}
