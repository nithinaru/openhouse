// Local "your trip is ready" notification (docs/BUILD.md §1 step 3).
// Local notifications work in Expo Go; only remote push is limited there.

import * as Notifications from 'expo-notifications';

let handlerSet = false;

function ensureForegroundHandler() {
  if (handlerSet) return;
  handlerSet = true;
  // Ingest finishes while the app is open, so show the banner in the foreground too.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Asks once if undetermined. Resolves false on denial or any error; never throws. */
async function ensureNotificationPermission(): Promise<boolean> {
  try {
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) {
      perm = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      });
    }
    return perm.granted;
  } catch {
    return false;
  }
}

/** Schedules "Your <title> is ready" for immediate delivery. Silent on denial or failure. */
export async function notifyTripReady(trip: { id: string; title: string }): Promise<void> {
  try {
    if (!(await ensureNotificationPermission())) return;
    ensureForegroundHandler();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Your ${trip.title} is ready`,
        body: 'Tap to replay where you went.',
        data: { tripId: trip.id, url: `/trip/${trip.id}` },
      },
      trigger: null,
    });
  } catch {
    // Notifications are a nicety; never block the flow on them.
  }
}
