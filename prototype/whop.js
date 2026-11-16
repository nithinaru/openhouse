// Live Whop, through the team's Convex backend (convex/drops.ts, promos.ts, memberships.ts, host.ts, orders.ts).
// The Whop sandbox key lives in Convex env; this page only calls public Convex functions over HTTP.
// Every call falls back to demo numbers if the backend is unreachable, so the demo never breaks.
window.WHOP = (() => {
  const CONVEX = 'https://trustworthy-anteater-9.convex.cloud';
  const USER = 'jx7d6e90rvthgb9wxsgpjhy9198j953v'; // seeded demo user ("demo-me")
  const TRIP = 'js7cwkv07k2jd4by1tgexhpzn18j9xfs'; // seeded "YC hackathon day" trip
  const FRIENDS = [
    { name: 'rohan', share: 'RHN42X' },
    { name: 'sol', share: 'SOL7KD' },
    { name: 'ines', share: 'INS3VQ' },
  ];
  // shop product → drop piece on the backend. globe/book need the whop-globe-book backend patch;
  // until it is deployed they ride along as stand-in pieces so checkout still works.
  const PIECE = { globe: 'globe', 'tee-ghost': 'tee', book: 'book', hoodie: 'hoodie', hat: 'cap', 'tee-souvenir': 'tee' };
  const STAND_IN = { globe: 'tote', book: 'pin' };
  const log = []; // every whop round trip, shown in the "whop activity" ticker
  const listeners = new Set();
  const note = (entry) => { log.unshift({ at: Date.now(), ...entry }); listeners.forEach((f) => f(log)); };

  async function call(kind, path, args, whopApi) {
    const t0 = performance.now();
    try {
      const r = await fetch(`${CONVEX}/api/${kind}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, args, format: 'json' }),
      });
      const j = await r.json();
      if (j.status !== 'success') throw new Error((j.errorMessage || 'error').split('\n').find((l) => l.startsWith('Uncaught Error:'))?.replace('Uncaught Error: ', '') || j.errorMessage);
      if (whopApi) note({ api: whopApi, path, ok: true, ms: Math.round(performance.now() - t0) });
      return j.value;
    } catch (e) {
      if (whopApi) note({ api: whopApi, path, ok: false, err: e.message });
      throw e;
    }
  }

  let drop = null;
  async function ensureDrop() {
    if (drop) return drop;
    drop = await call('action', 'drops:create', { userId: USER, tripId: TRIP }, 'products.create · variants.create');
    return drop;
  }
  async function refreshDrop() {
    const d = await ensureDrop();
    drop = (await call('query', 'drops:get', { dropId: d.dropId })) || d;
    return drop;
  }

  function items(bag, standIn) {
    return bag.map(({ p, opt }) => {
      let piece = PIECE[p.id];
      if (standIn && STAND_IN[p.id]) piece = STAND_IN[p.id];
      const sized = piece === 'hoodie' || piece === 'tee';
      return sized ? { piece, size: /^(xs|s|m|l|xl|xxl)$/.test(opt) ? opt : 'm' } : { piece };
    });
  }

  async function checkout(bag, { edition = 'was_there', promoCode } = {}) {
    const d = await ensureDrop();
    const args = { dropId: d.dropId, userId: USER, edition, items: items(bag, false) };
    if (promoCode) args.promoCode = promoCode;
    try {
      return await call('action', 'drops:checkout', args, 'checkoutConfigurations.create');
    } catch (e) {
      // backend without the globe/book pieces yet: validator rejects them → retry with stand-ins
      if (/piece|validator|Validator|does not match/i.test(e.message)) {
        return call('action', 'drops:checkout', { ...args, items: items(bag, true) }, 'checkoutConfigurations.create');
      }
      throw e;
    }
  }

  return {
    USER, FRIENDS, log, onLog: (f) => listeners.add(f),
    ensureDrop, refreshDrop, checkout,
    order: (orderId) => call('query', 'orders:get', { orderId }),
    promoFor: (friend) => ensureDrop().then((d) => call('action', 'promos:forFriend', { userId: USER, friendShareCode: friend.share, dropId: d.dropId }, 'promoCodes.create')),
    referral: () => ensureDrop().then((d) => call('action', 'referrals:link', { userId: USER, dropId: d.dropId }, 'affiliates.create · overrides.create')),
    plusCheckout: () => call('action', 'memberships:checkout', { userId: USER }, 'checkoutConfigurations.create (renewal)'),
    entitlements: () => call('query', 'me:entitlements', { userId: USER }),
    hostStats: () => call('query', 'host:stats', { userId: USER }),
    payout: () => call('action', 'host:payout', { userId: USER }, 'ledgerAccounts.retrieve · transfers.create'),
  };
})();
