// Reads the address book on-device with the SDK 58 `Contact` API. Names and thumbnails
// stay in memory on the phone: nothing is uploaded, nothing is texted.

import { Contact, ContactField, ContactsSortOrder, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';

import type { RawContact } from './people';

export type Access = 'granted' | 'denied' | 'blocked' | 'undetermined';

function toAccess(r: { granted: boolean; canAskAgain: boolean; status: string }): Access {
  if (r.granted) return 'granted'; // includes iOS 18 "limited" access
  if (r.status === 'undetermined') return 'undetermined';
  return r.canAskAgain ? 'denied' : 'blocked';
}

export async function checkAccess(): Promise<Access> {
  try {
    return toAccess(await getPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

export async function requestAccess(): Promise<Access> {
  try {
    return toAccess(await requestPermissionsAsync());
  } catch {
    return 'blocked';
  }
}

const FIELDS = [ContactField.FULL_NAME, ContactField.GIVEN_NAME, ContactField.FAMILY_NAME, ContactField.THUMBNAIL] as const;

/** Every contact with a name. Returns [] if the module is unavailable. */
export async function readContacts(): Promise<RawContact[]> {
  try {
    const rows = await Contact.getAllDetails(FIELDS, { sortOrder: ContactsSortOrder.GivenName, limit: 2000 });
    const out: RawContact[] = [];
    for (const r of rows) {
      const name = (r.fullName || [r.givenName, r.familyName].filter(Boolean).join(' ')).trim();
      // Skip businesses saved as a bare number or email.
      if (!name || /^[+\d\s()-]+$/.test(name) || name.includes('@')) continue;
      out.push({ id: `c-${r.id}`, name, uri: r.thumbnail ?? undefined });
    }
    return out;
  } catch (e) {
    console.warn('[contacts] read failed', e);
    return [];
  }
}
