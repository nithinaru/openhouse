// the fomo shop — phone version of design/rebrand/fomo-shop/site (products orbit the chrome "fomo" wordmark)
(() => {
  const q = (s) => document.querySelector(s);
  const PRODUCTS = [
    { id: 'globe', img: 'assets/shop/globe.png', name: 'the night, in a globe', price: 68, size: 1.06,
      why: 'your living room + everyone who stood in it', sticker: 'the main thing ✨',
      desc: 'built from your 3d house and hand-finished. 5-inch glass dome, brass plate, bats instead of snow.',
      optLabel: 'which room goes in the glass', opts: ['living room · 24', 'kitchen · 11', 'stairs · 6'] },
    { id: 'tee-ghost', img: 'assets/shop/tee-ghost.png', name: 'the ghost arrives', price: 38, size: 1.0,
      why: '📸 11:12 pm · caught by 4 cameras', sticker: '11:12 pm 👻',
      desc: 'tour longsleeve for the entrance of the night. washed black, flame sleeves, printed front and arms.',
      optLabel: 'size', opts: ['xs', 's', 'm', 'l', 'xl'] },
    { id: 'book', img: 'assets/shop/book.png', name: 'the photo book', price: 54, size: 1.0,
      why: '212 of 2,310 photos, one chapter per room', sticker: '212 photos',
      desc: 'linen hardcover, 120 pages. the best of everyone’s camera rolls, in order, room by room. swap any photo before it prints.',
      optLabel: 'cover', opts: ['sky linen', 'black linen'] },
    { id: 'hoodie', img: 'assets/shop/hoodie.png', name: 'the house hoodie', price: 72, size: 1.0,
      why: '🏠 all 41 standees on the back', sticker: 'all 41 of you',
      desc: 'heavyweight sky fleece. the whole house on the back with every cutout in it, and an “i was here” sticker on the sleeve.',
      optLabel: 'size', opts: ['xs', 's', 'm', 'l', 'xl'] },
    { id: 'hat', img: 'assets/shop/hat.png', name: 'no costume no entry', price: 32, size: 0.86,
      why: '🚪 the sign taped to the door', sticker: 'house rules',
      desc: 'washed black dad hat. the door sign as a chunky embroidered patch, “delancey · oct 31” on the side.',
      optLabel: 'size', opts: ['one size'] },
    { id: 'tee-souvenir', img: 'assets/shop/tee-souvenir.png', name: 'i 👻 delancey', price: 38, size: 0.98,
      why: '🗽 for whoever missed it', sticker: 'you had to be there',
      desc: 'the souvenir tee. heavyweight white cotton for the friends who stayed home and heard about it after.',
      optLabel: 'size', opts: ['xs', 's', 'm', 'l', 'xl'] },
  ];
  const N = PRODUCTS.length, STEP = (Math.PI * 2) / N;
  const screen = q('#s-shop'), stage = q('#sh-stage'), scene = q('#sh-scene');
  const L = { R: 150, itemW: 150, wordW: 300, itemY: 64, wordY: -84 };

  /* entry points: "proceed to shop" after the video, and the shop card on the ready house */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-shop]')) return;
    q('#video').pause();
    go('shop');
  });
  q('#sh-back').addEventListener('click', () => { closeSheets(); go('build'); });

  /* clouds */
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('div'); c.className = 'sh-cloud';
    const w = 160 + Math.random() * 220;
    Object.assign(c.style, { width: w + 'px', height: w * .42 + 'px', left: Math.random() * 360 - 60 + 'px', top: Math.random() * 600 + 'px',
      opacity: .35 + Math.random() * .45, animationDuration: 20 + Math.random() * 20 + 's' });
    q('#sh-clouds').append(c);
  }

  /* ring */
  const track = q('#sh-track');
  track.style.width = track.style.height = L.R * 2 + 'px';
  track.style.transform = `translate3d(${-L.R}px, ${L.itemY + L.itemW * .62 - L.R}px, 0) rotateX(90deg)`;
  const word = q('#sh-word');
  word.style.width = L.wordW + 'px';
  word.style.transform = `translate3d(${-L.wordW / 2}px, ${L.wordY - L.wordW * .25}px, 0) rotateX(13deg)`;

  let rot = 0, target = 0, vel = 0, moved = false;
  const front = () => ((Math.round(rot / STEP) % N) + N) % N;
  const items = PRODUCTS.map((p, i) => {
    const el = document.createElement('div'); el.className = 'sh-item';
    el.style.width = L.itemW * p.size + 'px';
    el.innerHTML = `<div class="sh-body"><img src="${p.img}" alt="${p.name}" draggable="false"><div class="sh-shadow"></div><div class="sh-stk">${p.sticker}</div></div>`;
    el.querySelector('img').addEventListener('click', (e) => {
      if (moved) return; e.stopPropagation();
      if (i === front()) openDetail(i); else goTo(i);
    });
    scene.append(el);
    return { el, body: el.querySelector('.sh-body'), p, phase: Math.random() * Math.PI * 2 };
  });

  let lastInteract = performance.now();
  const kick = () => (lastInteract = performance.now());
  function goTo(i) {
    const cur = target / STEP; let d = ((i - cur) % N + N) % N; if (d > N / 2) d -= N;
    target = Math.round(cur + d) * STEP; kick();
  }
  const step = (dir) => { target = Math.round(target / STEP + dir) * STEP; kick(); };
  q('#sh-next').onclick = () => step(1);
  q('#sh-prev').onclick = () => step(-1);

  /* drag with fling + snap */
  let dragging = false, lastX = 0, lastT = 0, dragV = 0, scale = 1;
  stage.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false; lastX = e.clientX; lastT = performance.now(); dragV = 0;
    scale = q('#phone').getBoundingClientRect().width / 390 || 1;
    stage.classList.add('dragging');
  });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = (e.clientX - lastX) / scale, now = performance.now();
    if (Math.abs(dx) > 2) moved = true;
    const d = -dx / (L.R * 1.6);
    rot += d; target = rot; dragV = d / Math.max(1, now - lastT);
    lastX = e.clientX; lastT = now; kick();
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false; stage.classList.remove('dragging');
    target = Math.round((rot + dragV * 260) / STEP) * STEP; kick();
    setTimeout(() => (moved = false), 0);
  };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);

  /* keys (only while the shop is on screen) */
  addEventListener('keydown', (e) => {
    if (current !== 'shop' || e.wywhNav) return; // ignore the key press that brought us here
    if (e.key === 'Escape') { closeSheets(); return; }
    if (screen.classList.contains('sh-open') || !q('#sh-done').hidden) return; // nothing behind a sheet or the order card
    if (e.key === 'Enter' && e.target.closest('button')) return; // let the focused button handle Enter
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'Enter' && !screen.classList.contains('sh-open')) openDetail(front());
  });

  /* info panel */
  let shown = -1;
  function updateInfo() {
    const i = front(); if (i === shown) return; shown = i;
    items.forEach((it, k) => it.el.classList.toggle('front', k === i));
    const info = q('#sh-info'); info.classList.add('swap');
    setTimeout(() => {
      const p = PRODUCTS[i];
      q('#sh-name').textContent = p.name; q('#sh-why').textContent = p.why; q('#sh-add').textContent = 'add · $' + p.price;
      info.classList.remove('swap');
    }, 180);
  }
  q('#sh-add').onclick = () => addToBag(front());

  /* bag */
  const bag = [];
  function addToBag(i, opt) {
    const p = PRODUCTS[i];
    bag.push({ p, opt: opt || p.opts[p.opts.length > 3 ? 2 : 0] });
    q('#sh-bag-n').textContent = bag.length;
    const b = q('#sh-bag-btn'); b.classList.add('bump'); setTimeout(() => b.classList.remove('bump'), 300);
    const t = q('#sh-toast'); t.textContent = p.name + ' → bag ✨';
    t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1700);
  }
  function renderBag() {
    const lines = q('#sh-lines'); lines.innerHTML = '';
    if (!bag.length) lines.innerHTML = '<p class="sh-empty">nothing yet. spin the ring and grab something 🎃</p>';
    bag.forEach((it, k) => {
      const row = document.createElement('div'); row.className = 'sh-line';
      row.innerHTML = `<img src="${it.p.img}" alt=""><span><b>${it.p.name}</b><small>${it.opt}</small></span><em>$${it.p.price}</em><button aria-label="remove">✕</button>`;
      row.querySelector('button').onclick = () => { bag.splice(k, 1); q('#sh-bag-n').textContent = bag.length; renderBag(); };
      lines.append(row);
    });
    renderTotals(); renderFriendCodes();
    q('#sh-bag-sub').textContent = `${bag.length} thing${bag.length === 1 ? '' : 's'} from halloween at the delancey house`;
  }
  q('#sh-bag-btn').onclick = () => { renderBag(); openSheet('#sh-bag'); };
  q('#sh-done-ok').onclick = () => { bag.length = 0; q('#sh-bag-n').textContent = 0; q('#sh-done').hidden = true; promo = null; };
  q('#sh-done-start').onclick = () => { q('#restart').click(); };
  // full reset for "start over": empty bag, ring back to the globe, sheets and order card closed
  window.resetShop = () => {
    bag.length = 0; q('#sh-bag-n').textContent = 0; q('#sh-done').hidden = true; closeSheets();
    rot = target = vel = 0; shown = -1;
  };

  /* sheets */
  let detailI = 0;
  function openSheet(sel) { screen.classList.add('sh-open'); q(sel).classList.add('open'); kick(); }
  function closeSheets() { screen.classList.remove('sh-open'); screen.querySelectorAll('.sh-sheet').forEach((s) => s.classList.remove('open')); kick(); }
  q('#sh-scrim').onclick = closeSheets;
  function openDetail(i) {
    detailI = i; const p = PRODUCTS[i];
    q('#sh-d-img').src = p.img; q('#sh-d-name').textContent = p.name; q('#sh-d-price').textContent = '$' + p.price;
    q('#sh-d-desc').textContent = p.desc; q('#sh-d-optlabel').textContent = p.optLabel; q('#sh-d-tag').textContent = p.sticker;
    const chips = q('#sh-d-chips'); chips.innerHTML = '';
    p.opts.forEach((o, k) => {
      const c = document.createElement('button'); c.textContent = o;
      if (k === (p.opts.length > 3 ? 2 : 0)) c.className = 'on';
      c.onclick = () => { chips.querySelectorAll('button').forEach((x) => x.classList.remove('on')); c.classList.add('on'); };
      chips.append(c);
    });
    q('#sh-d-add').textContent = 'add to bag · $' + p.price;
    openSheet('#sh-detail');
  }
  q('#sh-d-add').onclick = () => { addToBag(detailI, q('#sh-d-chips .on')?.textContent); closeSheets(); };

  /* ---------------- whop: everything below talks to the real whop sandbox via convex ---------------- */
  const W = window.WHOP;
  const money = (c) => '$' + (c / 100).toFixed(c % 100 ? 2 : 0);
  let edition = 'was_there', promo = null, pending = null, pollTimer = 0, dropTimer = 0;

  // live api ticker: every whop round trip shows up here
  W.onLog((log) => {
    const e = log[0], t = q('#sh-ticker');
    t.classList.toggle('err', !e.ok);
    q('#sh-ticker-text').textContent = e.ok ? `whop · ${e.api} ✓ ${e.ms}ms` : `whop · ${e.api} · ${e.err}`;
  });

  // live stock + countdown from the drop's whop plans
  let closesAt = 0;
  async function loadDrop() {
    try {
      const d = await W.refreshDrop();
      closesAt = d.closesAt;
      const ed = Object.fromEntries(d.editions.map((x) => [x.edition, x]));
      const was = `${ed.was_there.claimed}/${ed.was_there.stock}`, pub = `${ed.public.claimed}/${ed.public.stock}`;
      const st = q('#sh-stock');
      if (q('#sh-stock-was').textContent !== was || q('#sh-stock-pub').textContent !== pub) { st.classList.remove('bump'); void st.offsetWidth; st.classList.add('bump'); }
      q('#sh-stock-was').textContent = was; q('#sh-stock-pub').textContent = pub;
      q('#ed-was').textContent = `you were at the venue ✓ · ${ed.was_there.stock - ed.was_there.claimed} left`;
      q('#ed-pub').textContent = `open to anyone · ${ed.public.stock - ed.public.claimed} left`;
      const left = ed[edition].stock - ed[edition].claimed;
      q('#sh-d-left').textContent = `nº ${ed[edition].claimed + 1} / ${ed[edition].stock} · sold through whop`;
      return left;
    } catch { /* keep last numbers */ }
  }
  const onShop = () => { loadDrop(); clearInterval(dropTimer); dropTimer = setInterval(() => current === 'shop' && loadDrop(), 5000); };
  document.addEventListener('click', (e) => { if (e.target.closest('[data-shop]')) setTimeout(onShop, 50); });
  addEventListener('keydown', () => setTimeout(() => current === 'shop' && !dropTimer && onShop(), 50));

  setInterval(() => {
    if (!closesAt) return;
    let s = Math.max(0, Math.floor((closesAt - Date.now()) / 1000));
    const hh = Math.floor(s / 3600); s %= 3600;
    q('#sh-countdown').textContent = `${hh}h ${String(Math.floor(s / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
  }, 1000);

  // edition picker
  document.querySelectorAll('.sh-ed').forEach((b) => b.addEventListener('click', () => {
    edition = b.dataset.ed;
    document.querySelectorAll('.sh-ed').forEach((x) => x.classList.toggle('on', x === b));
    loadDrop();
  }));

  // was there code
  q('#sh-promo-apply').onclick = () => {
    const code = q('#sh-promo-in').value.trim().toUpperCase(), msg = q('#sh-promo-msg');
    if (!/^[A-Z0-9]{2,12}-WASTHERE$/.test(code)) { promo = null; msg.className = 'wmsg bad'; msg.textContent = 'that doesn’t look like a was there code'; renderTotals(); return; }
    promo = code; msg.className = 'wmsg ok'; msg.textContent = `${code} applied · −20%, checked by whop at checkout`;
    q('#sh-promo-apply').textContent = 'applied'; q('#sh-promo-apply').classList.add('on'); renderTotals();
  };

  // codes for your people (one real whop promo code per friend)
  function renderFriendCodes() {
    const box = q('#sh-friendcodes'); if (box.childElementCount) return;
    W.FRIENDS.forEach((f) => {
      const row = document.createElement('div'); row.className = 'fcode';
      row.innerHTML = `<img src="assets/av-${f.name === 'rohan' ? 'nico' : f.name}.jpg" alt=""><b>${f.name}</b><button class="mini">make code</button>`;
      row.querySelector('button').onclick = async (e) => {
        const btn = e.currentTarget; btn.textContent = '…';
        try {
          const r = await W.promoFor(f);
          btn.outerHTML = `<code>${r.code}</code><button class="mini use">use</button>`;
          row.querySelector('.use').onclick = () => { q('#sh-promo-in').value = r.code; q('#sh-promo-apply').click(); };
        } catch (err) { btn.textContent = 'try again'; }
      };
      box.append(row);
    });
  }

  // referral link (whop affiliates)
  q('#sh-ref-btn').onclick = async () => {
    const box = q('#sh-ref'); q('#sh-ref-btn').textContent = '…';
    try {
      const r = await W.referral();
      box.innerHTML = `<code>${r.url}</code><div class="sh-refstats"><span><b>${money(r.earnedCents)}</b> earned</span><span><b>${r.sales}</b> sales</span><span><b>${r.clicks}</b> clicks</span></div>`;
    } catch (e) {
      box.innerHTML = `<p class="wmsg">${/connect whop/.test(e.message) ? 'connect your whop account to start earning · <b>affiliates.create</b> runs the moment you do' : e.message}</p>`;
    }
  };

  // plus membership (whop renewal plan, 7-day trial)
  q('#sh-plus-btn').onclick = async () => {
    const tab = window.open('', '_blank');
    q('#sh-plus-btn').textContent = 'opening whop…';
    try {
      const r = await W.plusCheckout();
      if (tab) tab.location = r.purchaseUrl; else window.open(r.purchaseUrl, '_blank');
      q('#sh-plus-btn').textContent = 'trial checkout open on whop ↗';
    } catch (e) { tab?.close(); q('#sh-plus-btn').textContent = /already/.test(e.message) ? 'you have plus ⭐' : 'try again'; }
  };

  function renderTotals() {
    const sub = bag.reduce((s, it) => s + it.p.price * 100, 0);
    const disc = promo ? Math.round(sub * 0.2) : 0;
    q('#sh-subtotal').textContent = money(sub);
    q('#sh-disc-row').hidden = !disc; q('#sh-disc').textContent = '−' + money(disc);
    q('#sh-total').textContent = money(sub - disc);
    q('#sh-pay').innerHTML = `pay with <b>whop</b> · ${money(sub - disc)}`;
    q('#sh-pay').disabled = !bag.length;
  }

  // pay → real whop checkout, then poll convex until the whop webhook marks it paid
  q('#sh-pay').onclick = async () => {
    if (!bag.length) return;
    const tab = window.open('', '_blank'); // open now, inside the click, so it isn't blocked
    q('#sh-pay').innerHTML = '<span class="spinner"></span> creating whop checkout…';
    try {
      pending = await W.checkout(bag, { edition, promoCode: promo || undefined });
      if (tab) tab.location = pending.purchaseUrl; else window.open(pending.purchaseUrl, '_blank');
      q('#sh-reopen').href = pending.purchaseUrl;
      closeSheets(); q('#sh-done').hidden = false; q('#sh-wait').hidden = false; q('#sh-paid').hidden = true;
      clearInterval(pollTimer);
      pollTimer = setInterval(async () => {
        try {
          const o = await W.order(pending.orderId);
          if (o && (o.status === 'paid' || o.status === 'fulfilled')) { clearInterval(pollTimer); paid(); }
        } catch {}
      }, 2000);
    } catch (e) {
      tab?.close();
      if (/code not valid/.test(e.message)) { // whop holds a code for 30 min while another checkout with it is open
        promo = null; q('#sh-promo-apply').textContent = 'apply'; q('#sh-promo-apply').classList.remove('on');
        const m = q('#sh-promo-msg'); m.className = 'wmsg bad'; m.textContent = 'whop says that code is already in another open checkout · try another friend’s code';
        renderTotals(); return;
      }
      q('#sh-pay').innerHTML = `whop: ${e.message} · try again`;
    }
  };
  async function paid() {
    const ed = (await loadDrop(), W);
    q('#sh-wait').hidden = true; q('#sh-paid').hidden = false;
    q('#sh-paid-title').textContent = `you own ${bag.length === 1 ? 'the ' + bag[0].p.name : bag.length + ' pieces'}`;
    q('#sh-paid-order').innerHTML = `whop order <code class="wapi">${pending.orderId.slice(0, 10)}…</code> · webhook <code class="wapi">payment.succeeded</code>`;
  }
  q('#sh-cancel').onclick = () => { clearInterval(pollTimer); q('#sh-done').hidden = true; renderBag(); openSheet('#sh-bag'); };
  q('#sh-done-host').onclick = () => { q('#sh-done').hidden = true; bag.length = 0; q('#sh-bag-n').textContent = 0; openHost(); };

  // host dashboard (whop payments, memberships, plans, ledger + transfers)
  let lastFeed = '';
  async function loadHost() {
    try {
      const h = await W.hostStats();
      q('#hs-gross').textContent = money(h.grossCents); q('#hs-orders').textContent = h.orders; q('#hs-members').textContent = h.members;
      q('#hs-sell').innerHTML = (h.drop?.editions || []).map((e) => `<div class="sell-row"><span><b>${e.edition === 'was_there' ? 'was there' : 'public'}</b><em>${e.claimed} of ${e.stock} sold</em></span><div class="sell-bar"><i style="width:${Math.max(1.5, e.claimed / e.stock * 100)}%"></i></div></div>`).join('');
      const feed = JSON.stringify(h.recent);
      if (feed !== lastFeed) {
        q('#hs-feed').innerHTML = h.recent.length ? h.recent.slice(0, 6).map((r, i) => `<div class="feed-row ${i === 0 && lastFeed ? 'new' : ''}"><span>${r.who} bought ${r.item}${r.edition ? ' · ' + (r.edition === 'was_there' ? 'was there' : 'public') : ''}</span><em>${money(r.amountCents)} · ${ago(r.at)}</em></div>`).join('')
          : '<p class="feed-empty">no payments yet. they show up here the second whop confirms them.</p>';
        lastFeed = feed;
      }
      q('#hs-payout').textContent = `payout via whop · ${money(h.feeBalanceCents)}`;
    } catch {}
  }
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : Math.round(m / 60) + 'h ago'; };
  let hostTimer = 0;
  function openHost() { loadHost(); openSheet('#sh-hostsheet'); clearInterval(hostTimer); hostTimer = setInterval(() => q('#sh-hostsheet').classList.contains('open') ? loadHost() : clearInterval(hostTimer), 3000); }
  q('#sh-host-btn').onclick = openHost;
  q('#hs-payout').onclick = async () => {
    const msg = q('#hs-payout-msg'); msg.innerHTML = '<span class="spinner dark"></span>';
    try { const r = await W.payout(); msg.className = 'wmsg ok center'; msg.innerHTML = `sent ${money(r.amountCents)} to yc · whop transfer <code class="wapi">${r.transferId}</code>`; }
    catch (e) {
      msg.className = 'wmsg center';
      msg.innerHTML = /nothing to pay/.test(e.message) ? 'nothing to pay out yet · <code class="wapi">ledgerAccounts.retrieve</code>'
        : /no whop account/.test(e.message) ? 'connect the host’s whop account to send payouts · <code class="wapi">transfers.create</code>'
        : /not settled/.test(e.message) ? 'whop balance still settling · <code class="wapi">ledgerAccounts</code>' : e.message;
    }
  };

  /* frame loop: hold on each product ~4s, then glide to the next */
  const HOLD = 4200;
  let prev = performance.now();
  function frame(now) {
    const dt = Math.min(48, now - prev); prev = now;
    if (current === 'shop') {
      const open = screen.classList.contains('sh-open');
      if (!dragging && !open && now - lastInteract > HOLD) { target = Math.round(target / STEP + 1) * STEP; lastInteract = now; }
      if (!dragging) {
        vel = (vel + (target - rot) * .0011 * dt) * Math.pow(.82, dt / 16);
        rot += vel * dt;
        if (Math.abs(target - rot) < 1e-4 && Math.abs(vel) < 1e-5) { rot = target; vel = 0; }
      }
      const t = now / 1000;
      items.forEach((it, i) => {
        const th = i * STEP - rot;
        const x = Math.sin(th) * L.R, z = Math.cos(th) * L.R, depth = (Math.cos(th) + 1) / 2;
        const w = L.itemW * it.p.size;
        const bob = Math.sin(t * 1.1 + it.phase) * 6;
        const spin = Math.sin(t * .7 + it.phase) * 12 - Math.sin(th) * 18;
        it.el.style.transform = `translate3d(${x - w / 2}px, ${L.itemY - w * .5 + bob}px, ${z}px) rotateX(13deg)`;
        it.body.style.transform = `rotateY(${spin}deg)`;
        it.el.style.opacity = (.5 + depth * .5).toFixed(3);
        it.el.style.filter = `blur(${((1 - depth) * 2).toFixed(2)}px) saturate(${(.7 + depth * .3).toFixed(2)})`;
      });
      updateInfo();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
