import { Redirect, useLocalSearchParams } from 'expo-router';

// The drop now lives at the top of the one storefront, /shop/[id]. Old links land there.
export default function DropScreen() {
  const { id, ref } = useLocalSearchParams<{ id: string; ref?: string }>();
  return <Redirect href={{ pathname: '/shop/[id]', params: ref ? { id, ref } : { id } }} />;
}
