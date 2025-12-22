/* Shared JS for Rahawan app
   Keys:
     - customerName, customerVilla
     - currentCart (array)
     - orders (array) stored under 'orders'
     - isOpen ('true'|'false')
     - adminLogged ('true')
     - rahawan_messages (array) used for admin -> customer popups
*/

/* Utilities */
function saveCurrentCart(cart){ localStorage.setItem('currentCart', JSON.stringify(cart||[])); }
function loadCurrentCart(){ return JSON.parse(localStorage.getItem('currentCart') || '[]'); }
function getCustomer(){ return { name: localStorage.getItem('customerName')||'', customerVilla: localStorage.getItem('customerVilla')||'' }; }

/* Generic popup for buyers */
function showBuyerPopup(text, timeout=7000){
  const el = document.getElementById('popupMsg') || document.getElementById('popupMsgOrder');
  if (!el) {
    // create and append
    const p = document.createElement('div'); p.className='popup-msg'; p.textContent = text; document.body.appendChild(p);
    setTimeout(()=> p.remove(), timeout);
    return;
  }
  el.textContent = text; el.style.display='block';
  setTimeout(()=> { el.style.display='none'; }, timeout);
}

/* Listen for messages from admin (storage) and show targeted messages */
window.addEventListener('storage', (e) => {
  if (e.key === 'rahawan_messages') {
    maybeShowMessagesToCustomer();
  }
  if (e.key === 'isOpen') {
    // pages that care will handle it individually; this is global listener
    // no-op here
  }
});

/* On pages that are shop/order, call function to display any new messages for the current user */
function maybeShowMessagesToCustomer(){
  const msgs = JSON.parse(localStorage.getItem('rahawan_messages') || '[]');
  const seenKey = `rahawan_msg_seen_${getCustomer().name}_${getCustomer().customerVilla}`;
  const seen = JSON.parse(localStorage.getItem(seenKey) || '[]'); // array of ids
  const mine = msgs.filter(m => m.name === getCustomer().name && String(m.villa) === String(getCustomer().customerVilla));
  if (mine.length === 0) return;
  mine.forEach(m => {
    if (!seen.includes(m.id)) {
      showBuyerPopup(m.text, 12000);
      seen.push(m.id);
    }
  });
  localStorage.setItem(seenKey, JSON.stringify(seen));
}

/* ---- SHOP PAGE CODE (shop.html) ---- */
(function(){
  const path = window.location.pathname.split('/').pop();
  if (path !== 'shop.html') return;

  // ensure user entered
  const cust = getCustomer();
  if (!cust.name || !cust.customerVilla) { window.location.href = 'login.html'; return; }
  document.getElementById('welcomeSmall').textContent = `${cust.name} • Villa ${cust.customerVilla}`;

  // handle closed state
  const overlay = document.getElementById('closedOverlay');
  function checkShopOpen() {
    const isOpen = localStorage.getItem('isOpen') === 'true';
    if (!isOpen) {
      overlay.style.display = 'flex';
      document.querySelectorAll('.item button').forEach(b=>b.disabled=true);
    } else {
      overlay.style.display = 'none';
      document.querySelectorAll('.item button').forEach(b=>b.disabled=false);
    }
  }
  checkShopOpen();
  window.addEventListener('storage', (e) => { if (e.key === 'isOpen') checkShopOpen(); });

  // cart operations
  let cart = loadCurrentCart(); // [{name, price, qty, img}]
  const bigCart = document.getElementById('bigCart');

  window.addToCart = function(name, price, img){
    if (localStorage.getItem('isOpen') === 'false') { alert('Rahawan is closed.'); return; }
    const existing = cart.find(i=>i.name===name);
    if (existing) existing.qty++;
    else cart.push({ name, price, qty:1, img });
    saveCurrentCart(cart);
    updateCartVisual();
    // small feedback
    showBuyerPopup(`${name} added to cart`, 1500);
  };

  function updateCartVisual(){
    const itemsEl = document.getElementById('bigCartItems');
    const cartCountEl = document.getElementById('cartCount');
    const subtotalEl = document.getElementById('subtotal');
    const deliveryPreview = document.getElementById('deliveryPreview');
    const grandTotalEl = document.getElementById('grandTotal');

    if (!itemsEl) return;
    itemsEl.innerHTML = '';
    let subtotal = 0;
    cart.forEach((it, idx) => {
      subtotal += it.price * it.qty;
      const node = document.createElement('div');
      node.className = 'big-cart-item';
      node.innerHTML = `
        <img src="${it.img || ''}" alt="">
        <div style="flex:1;">
          <div style="font-weight:800">${it.name}</div>
          <div style="color:#666; margin-top:6px;">${it.price} LE <span style="margin-left:10px; color:#888; font-weight:600;">x${it.qty}</span></div>
          <div style="margin-top:8px;" class="qty-controls">
            <button onclick="changeQty(${idx}, -1)">−</button>
            <div style="min-width:28px; text-align:center;">${it.qty}</div>
            <button onclick="changeQty(${idx}, 1)">+</button>
          </div>
        </div>
      `;
      itemsEl.appendChild(node);
    });
    cartCountEl.textContent = cart.reduce((s,i)=>s+i.qty,0);
    subtotalEl.textContent = subtotal;
    // preview delivery now unknown until order page -> show '-'
    deliveryPreview.textContent = '-';
    grandTotalEl.textContent = subtotal;
  }

  window.changeQty = function(idx, delta){
    if (!cart[idx]) return;
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx,1);
    saveCurrentCart(cart);
    updateCartVisual();
  };

  window.clearCart = function(){
    if (!confirm('Clear cart?')) return;
    cart = [];
    saveCurrentCart(cart);
    updateCartVisual();
  };

  window.toggleCart = function(){
    const el = document.getElementById('bigCart');
    if (!el) return;
    el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
    updateCartVisual();
  };

  window.goToOrderPage = function(){
    const cur = loadCurrentCart();
    if (!cur || cur.length === 0) { alert('Cart is empty'); return; }
    window.location.href = 'order.html';
  };

  // search / filter
  window.filterItems = function(){
    const q = (document.getElementById('searchBox').value || '').toLowerCase();
    const cat = document.getElementById('categoryFilter').value;
    document.querySelectorAll('.item').forEach(it=>{
      const name = (it.getAttribute('data-name')||'').toLowerCase();
      const inCategory = (cat==='all') || it.classList.contains(cat);
      const matches = name.includes(q);
      it.style.display = (inCategory && matches) ? 'block' : 'none';
    });
  };

  // show messages for this customer
  maybeShowMessagesToCustomer();
  // initial cart update
  updateCartVisual();
})();

/* ---- ORDER PAGE CODE (order.html) ---- */
(function(){
  const path = window.location.pathname.split('/').pop();
  if (path !== 'order.html') return;

  const cust = getCustomer();
  if (!cust.name || !cust.customerVilla) { window.location.href = 'login.html'; return; }
  document.getElementById('welcomeSmall2').textContent = `${cust.name} • Villa ${cust.customerVilla}`;
  document.getElementById('customerInfo').innerHTML = `<strong>${cust.name}</strong><br>📍 Villa: ${cust.customerVilla}`;

  // load cart
  let cart = loadCurrentCart();
  const itemsList = document.getElementById('itemsList');
  const timerText = document.getElementById('timerText');
  const orderMsg = document.getElementById('orderMsg');
  let countdownInterval = null;

  function renderItems(){
    if (!cart || cart.length===0) {
      itemsList.innerHTML = '<p style="color:#666">Cart is empty — <a href="shop.html">Back to shop</a></p>';
      document.getElementById('placeBtn').disabled = true;
      return;
    }
    itemsList.innerHTML = cart.map(i => `<div style="padding:6px 0;">${i.name} x${i.qty} — ${i.price * i.qty} LE</div>`).join('');
  }

  function getDeliveryChoice() {
    const r = document.querySelector('input[name="deliveryOpt"]:checked');
    return r ? parseInt(r.value) : 15;
  }
  function getDeliveryMinutes() {
    const v = getDeliveryChoice();
    return v === 15 ? 45 : 30;
  }

  window.placeOrderOnOrderPage = function(){
    if (!cart || cart.length===0) { alert('Cart empty'); return; }
    if (localStorage.getItem('isOpen') === 'false') { alert('Rahawan is closed'); return; }

    const deliveryCost = getDeliveryChoice();
    const deliveryText = deliveryCost === 15 ? 'Standard (45 min)' : 'Fast (30 min)';
    const minutes = getDeliveryMinutes();

    const subtotal = cart.reduce((s,i)=>s + i.price * i.qty, 0);
    const total = subtotal + deliveryCost;
    const order = {
      customerName: cust.name,
      customerVilla: cust.customerVilla,
      items: cart.map(i=>({ name:i.name, price:i.price, qty:i.qty })),
      deliveryCost, deliveryText, total,
      time: new Date().toLocaleString(),
      eta: new Date(Date.now() + minutes*60000).toISOString(),
      processed:false
    };

    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));

    // clear currentCart
    localStorage.removeItem('currentCart');
    cart = [];
    renderItems();
    document.getElementById('placeBtn').disabled = true;
    orderMsg.textContent = 'Order placed — timer started.';
    startTimer(order.eta);
  };

  function startTimer(etaISO) {
    timerText.style.display = 'block';
    if (countdownInterval) clearInterval(countdownInterval);
    function tick() {
      const now = Date.now();
      const eta = new Date(etaISO).getTime();
      const diff = eta - now;
      if (diff <= 0) {
        timerText.textContent = '✅ Order ETA reached.';
        clearInterval(countdownInterval);
        return;
      }
      const m = Math.floor(diff/60000);
      const s = Math.floor((diff%60000)/1000);
      timerText.textContent = `Estimated arrival: ${m}m ${s}s`;
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  // On load, render any most recent order for this customer and show timer
  (function showRecent(){
    renderItems();
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    for (let i = orders.length - 1; i >= 0; i--) {
      const o = orders[i];
      if (o.customerName === cust.name && String(o.customerVilla) === String(cust.customerVilla)) {
        startTimer(o.eta);
        document.getElementById('placeBtn').disabled = true;
        document.getElementById('orderMsg').textContent = 'Showing your latest order timer.';
        return;
      }
    }
  })();

  // show admin messages targeted to this customer
  maybeShowMessagesToCustomer();

})();

/* ---- ADMIN helpers available to admin.html through inline scripts ---- */

/* Message helper for admin UI (exposed) */
function sendMessageToCustomer(name, villa, text) {
  const msgs = JSON.parse(localStorage.getItem('rahawan_messages') || '[]');
  const msg = { id: Date.now(), name, villa, text, time: new Date().toLocaleString() };
  msgs.push(msg);
  localStorage.setItem('rahawan_messages', JSON.stringify(msgs));
}

/* Mark order processed / delete (helpers used in admin inline script) */
function toggleProcessed(index) {
  const orders = JSON.parse(localStorage.getItem('orders') || '[]');
  if (!orders[index]) return;
  orders[index].processed = !orders[index].processed;
  localStorage.setItem('orders', JSON.stringify(orders));
}
function deleteOrder(index) {
  const orders = JSON.parse(localStorage.getItem('orders') || '[]');
  orders.splice(index,1);
  localStorage.setItem('orders', JSON.stringify(orders));
}
