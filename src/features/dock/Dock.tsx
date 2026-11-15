import { router, type Href } from 'expo-router';
import type { StyleProp, ViewStyle } from 'react-native';

import { DEMO_TRIP_ID } from '@/lib/demo/demoTrip';
import { HouseIcon, MapIcon, PeopleIcon, PlusIcon } from '@/theme/icons';
import { Dock, type DockItem } from '@/theme/ui';

// The floating black dock from the rebrand (a1/a4): house · replay map · + · people.
// Built on the theme's Dock; this only wires the four destinations.

export type DockTab = 'house' | 'map' | 'people' | 'home';

export function AppDock({ active, tripId = DEMO_TRIP_ID, style }: { active?: DockTab; tripId?: string; style?: StyleProp<ViewStyle> }) {
  const items: DockItem[] = [
    {
      key: 'house',
      label: 'house',
      icon: (c) => <HouseIcon color={c} />,
      active: active === 'house' || active === 'home',
      onPress: () => {
        if (active !== 'house') router.push(`/house/${tripId}` as Href);
      },
    },
    {
      key: 'map',
      label: 'replay',
      icon: (c) => <MapIcon color={c} />,
      active: active === 'map',
      onPress: () => router.push({ pathname: '/trip/[id]', params: { id: tripId } }),
    },
    {
      key: 'add',
      label: 'add photos',
      tone: 'pink',
      icon: (c) => <PlusIcon color={c} size={22} />,
      onPress: () => router.push('/onboarding'),
    },
    {
      key: 'people',
      label: 'people',
      icon: (c) => <PeopleIcon color={c} />,
      active: active === 'people',
      onPress: () => router.push('/people'),
    },
  ];
  return <Dock items={items} style={style} />;
}
