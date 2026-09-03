// ==========================================
// 1. CẤU HÌNH SUPABASE API
// ==========================================
const SUPABASE_URL = 'https://relogavxtjjbfciifuel.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbG9nYXZ4dGpqYmZjaWlmdWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDI3MDYsImV4cCI6MjEwMzcxODcwNn0.RaRNG00RYPpU4JqixjR0d7vpw0Al8JUwJXslIDfh41Y';

if (typeof window.supabaseClient === 'undefined') {
  window.supabaseClient = null;
  if (typeof createClient !== 'undefined' && SUPABASE_URL !== 'https://your-supabase-project.supabase.co') {
    window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}

var supabase = window.supabaseClient;

// ==========================================
// 2. STATE MANAGEMENT & LOCAL STORAGE
// ==========================================
let products = JSON.parse(localStorage.getItem('pos_products')) || [];
let customers = JSON.parse(localStorage.getItem('pos_customers')) || [];
let storeConfig = JSON.parse(localStorage.getItem('pos_store_config')) || {
  name: 'Cửa Hàng Dụng Cụ Y Khoa Phát',
  phone: '0909997617',
  address: '55/52 Lê Ngã, P. Tân Phú, TP.HCM',
  pin: '1234'
};

let orders = JSON.parse(localStorage.getItem('pos_orders')) || [];
let cart = [];
let pendingPinCallback = null;
let currentActiveOrder = null;

// Chuẩn hóa dữ liệu tương thích với đa mức giá
function sanitizePrices(product) {
  if (product && Array.isArray(product.prices) && product.prices.length > 0) {
    return product.prices;
  }
  if (product && typeof product.prices === 'string') {
    try {
      const parsed = JSON.parse(product.prices);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch(e){}
  }
  const val = Number(product?.Price || product?.price) || 0;
  return [{ label: 'Giá Chuẩn', price: val }];
}

const formatMoney = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

function saveToLocalStorage() {
  localStorage.setItem('pos_products', JSON.stringify(products));
  localStorage.setItem('pos_customers', JSON.stringify(customers));
  localStorage.setItem('pos_store_config', JSON.stringify(storeConfig));
  localStorage.setItem('pos_orders', JSON.stringify(orders));
}

// ==========================================
// 3. KHI TRANG TẢI XONG
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  renderStoreInfo();
  initDateFilters();
  setupUIEventListeners();

  if (supabase) {
    await fetchProductsFromAPI();
    await fetchCustomersFromAPI();
    await fetchOrdersFromAPI();
  }

  renderPosProducts();
  renderProductsTable();
  renderCustomersTable();
  renderCustomerSelect();
  renderReports();
});

function initDateFilters() {
  const today = new Date().toISOString().split('T')[0];
  const startDate = document.getElementById('report-start-date');
  const endDate = document.getElementById('report-end-date');
  if (startDate) startDate.value = today;
  if (endDate) endDate.value = today;
}

function setupUIEventListeners() {
  const searchInput = document.getElementById('pos-search');
  if (searchInput) searchInput.addEventListener('input', renderPosProducts);

  const startDate = document.getElementById('report-start-date');
  const endDate = document.getElementById('report-end-date');
  if (startDate) startDate.addEventListener('change', renderReports);
  if (endDate) endDate.addEventListener('change', renderReports);
}

// ==========================================
// 4. CHUYỂN TAB & CẤU HÌNH CỬA HÀNG
// ==========================================
function switchTab(tab) {
  ['pos', 'products', 'customers', 'reports'].forEach(t => {
    const section = document.getElementById(`section-${t}`);
    const tabBtn = document.getElementById(`tab-${t}`);
    if (section && tabBtn) {
      if (t === tab) {
        section.classList.remove('hidden');
        tabBtn.className = 'px-4 py-2 rounded-lg bg-white shadow-sm text-indigo-600 transition font-bold';
      } else {
        section.classList.add('hidden');
        tabBtn.className = 'px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 transition font-semibold';
      }
    }
  });

  const searchContainer = document.getElementById('search-container');
  if (searchContainer) {
    if (tab === 'pos') searchContainer.classList.remove('hidden');
    else searchContainer.classList.add('hidden');
  }

  if (tab === 'reports') renderReports();
}

function renderStoreInfo() {
  const nameEl = document.getElementById('header-store-name');
  const phoneEl = document.getElementById('header-store-phone');
  const addressEl = document.getElementById('header-store-address');

  if (nameEl) nameEl.innerText = storeConfig.name;
  if (phoneEl) phoneEl.innerHTML = `<i class="ph ph-phone"></i> ${storeConfig.phone}`;
  if (addressEl) addressEl.innerHTML = `<i class="ph ph-map-pin"></i> ${storeConfig.address}`;
}

function toggleStoreSettingsModal(show) {
  const modal = document.getElementById('store-modal');
  if (show) {
    document.getElementById('store-name-input').value = storeConfig.name;
    document.getElementById('store-phone-input').value = storeConfig.phone;
    document.getElementById('store-address-input').value = storeConfig.address;
    document.getElementById('store-pin-input').value = storeConfig.pin || '1234';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } else {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function saveStoreSettings(e) {
  e.preventDefault();
  storeConfig = {
    name: document.getElementById('store-name-input').value,
    phone: document.getElementById('store-phone-input').value,
    address: document.getElementById('store-address-input').value,
    pin: document.getElementById('store-pin-input').value || '1234'
  };
  saveToLocalStorage();
  renderStoreInfo();
  toggleStoreSettingsModal(false);
}

// ==========================================
// 5. MÃ PIN BẢO MẬT
// ==========================================
function requestPin(callback) {
  pendingPinCallback = callback;
  const pinInput = document.getElementById('pin-input');
  if (pinInput) pinInput.value = '';
  const modal = document.getElementById('pin-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => pinInput && pinInput.focus(), 100);
  }
}

function togglePinModal(show) {
  const modal = document.getElementById('pin-modal');
  if (modal) {
    if (!show) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      pendingPinCallback = null;
    }
  }
}

function confirmPin(e) {
  e.preventDefault();
  const inputPin = document.getElementById('pin-input').value;
  if (inputPin === storeConfig.pin) {
    togglePinModal(false);
    if (pendingPinCallback) pendingPinCallback();
  } else {
    alert('❌ Mã PIN không chính xác!');
  }
}

// ==========================================
// 6. POS & SẢN PHẨM
// ==========================================
function handlePosProductClick(product) {
  if (!product) return;
  const validPrices = sanitizePrices(product);

  if (validPrices.length === 1) {
    addToCart(product, validPrices[0]);
  } else {
    openPriceSelectorModal(product);
  }
}

function renderPosProducts() {
  const searchInput = document.getElementById('pos-search');
  const query = searchInput ? searchInput.value.toLowerCase() : '';
  const grid = document.getElementById('pos-product-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = products.filter(p => (p.Name || p.name || '').toLowerCase().includes(query));

  filtered.forEach(p => {
    const prices = sanitizePrices(p);
    const prodName = p.Name || p.name || '---';
    const prodUnit = p.Unit || p.unit || '---';

    const card = document.createElement('div');
    card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between active:scale-95 select-none";
    
    let priceText = '';
    if (prices.length > 1) {
      priceText = `<span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">${prices.length} Mức giá</span>`;
    } else {
      const singlePrice = prices[0].price;
      priceText = `<span class="font-bold text-indigo-600 text-sm">${formatMoney(singlePrice)}</span>`;
    }

    card.innerHTML = `
      <div>
        <h4 class="font-bold text-slate-800 text-sm leading-snug line-clamp-2">${prodName}</h4>
        <p class="text-xs text-slate-400 mt-1">ĐVT: ${prodUnit}</p>
      </div>
      <div class="mt-3 flex justify-between items-center pointer-events-none">
        ${priceText}
        <div class="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-bold">
          <i class="ph-bold ph-plus"></i>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      handlePosProductClick(p);
    });

    grid.appendChild(card);
  });
}

function openPriceSelectorModal(product) {
  const container = document.getElementById('price-selector-options');
  const title = document.getElementById('price-selector-title');
  const prodName = product.Name || product.name || '';
  if (title) title.innerText = `Chọn giá - ${prodName}`;
  if (!container) return;
  container.innerHTML = '';

  const validPrices = sanitizePrices(product);

  validPrices.forEach((priceObj) => {
    const btn = document.createElement('button');
    btn.className = "w-full p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl flex justify-between items-center transition active:scale-95 text-left";
    btn.innerHTML = `
      <span class="font-semibold text-sm text-slate-700">${priceObj.label || 'Mức giá'}</span>
      <span class="font-bold text-indigo-600 text-sm">${formatMoney(priceObj.price)}</span>
    `;
    btn.onclick = () => {
      addToCart(product, priceObj);
      togglePriceSelectorModal(false);
    };
    container.appendChild(btn);
  });

  togglePriceSelectorModal(true);
}

function togglePriceSelectorModal(show) {
  const modal = document.getElementById('price-selector-modal');
  if (modal) {
    if (show) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    } else {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }
}

// ==========================================
// 7. GIỎ HÀNG (CART)
// ==========================================
function addToCart(product, priceObj) {
  const prodId = product.Id || product.id;
  const prodName = product.Name || product.name;
  const cartItemKey = `${prodId}_${priceObj.label}_${priceObj.price}`;
  const existing = cart.find(item => item.key === cartItemKey);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      key: cartItemKey,
      productId: prodId,
      name: prodName,
      label: priceObj.label,
      price: Number(priceObj.price),
      qty: 1
    });
  }
  renderCart();
}

function updateCartQty(key, delta) {
  const item = cart.find(i => i.key === key);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(i => i.key !== key);
    }
  }
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items');
  if (!container) return;
  container.innerHTML = '';
  let total = 0;

  cart.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;

    const div = document.createElement('div');
    div.className = "bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center";
    div.innerHTML = `
      <div class="min-w-0 pr-2">
        <h5 class="font-bold text-xs text-slate-800 truncate">${item.name}</h5>
        <div class="text-[11px] text-slate-500">
          <span class="text-indigo-600 font-medium">${item.label ? item.label + ': ' : ''}</span>${formatMoney(item.price)}
        </div>
      </div>
      <div class="flex items-center space-x-2 shrink-0">
        <div class="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
          <button onclick="updateCartQty('${item.key}', -1)" class="px-2 py-0.5 text-slate-600 hover:bg-slate-100 font-bold">-</button>
          <span class="px-2 text-xs font-bold text-slate-800">${item.qty}</span>
          <button onclick="updateCartQty('${item.key}', 1)" class="px-2 py-0.5 text-slate-600 hover:bg-slate-100 font-bold">+</button>
        </div>
        <span class="text-xs font-bold text-slate-800 w-16 text-right">${formatMoney(itemTotal)}</span>
      </div>
    `;
    container.appendChild(div);
  });

  const cartTotalEl = document.getElementById('cart-total');
  if (cartTotalEl) cartTotalEl.innerText = formatMoney(total);
}

// ==========================================
// 8. THANH TOÁN & HÓA ĐƠN
// ==========================================
async function checkout() {
  if (cart.length === 0) {
    alert('Giỏ hàng đang trống!');
    return;
  }

  const customerSelect = document.getElementById('cart-customer');
  const customerId = customerSelect ? customerSelect.value : '';
  const cust = customers.find(c => (c.Id || c.id) == customerId);

  const order = {
    id: 'BILL' + Date.now().toString().slice(-6),
    timestamp: new Date().toISOString(),
    customerName: cust ? (cust.Name || cust.name) : 'Khách Vãng Lai',
    customerPhone: cust ? (cust.Phone || cust.phone) : '',
    items: [...cart],
    total: cart.reduce((sum, item) => sum + (item.price * item.qty), 0)
  };

  orders.unshift(order);
  saveToLocalStorage();

  if (supabase) {
    try {
      await supabase.from('Orders').insert([{
        id: order.id,
        timestamp: order.timestamp,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        items: JSON.stringify(order.items),
        total: order.total
      }]);
    } catch (e) {
      console.error('Lỗi lưu đơn hàng:', e);
    }
  }

  currentActiveOrder = order;
  renderReceipt(order);
  toggleReceiptModal(true);
  clearCart();
}

function renderReceipt(order) {
  const dateStr = new Date(order.timestamp).toLocaleString('vi-VN');
  const container = document.getElementById('printable-receipt');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center border-b border-dashed border-slate-300 pb-4 mb-4">
      <h2 class="font-bold text-xl text-slate-900">${storeConfig.name}</h2>
      <p class="text-xs text-slate-600">${storeConfig.address}</p>
      <p class="text-xs text-slate-600">ĐT: ${storeConfig.phone}</p>
      <h3 class="font-bold text-base mt-3 uppercase tracking-wider text-slate-800">HÓA ĐƠN THANH TOÁN</h3>
      <p class="text-xs text-slate-500">Mã: ${order.id} | Ngày: ${dateStr}</p>
      <p class="text-xs text-slate-500">Khách hàng: ${order.customerName}</p>
    </div>

    <table class="w-full text-xs text-left mb-4">
      <thead>
        <tr class="border-b border-slate-300">
          <th class="py-1">Tên SP</th>
          <th class="py-1 text-center">SL</th>
          <th class="py-1 text-right">Đ.Giá</th>
          <th class="py-1 text-right">T.Tiền</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${order.items.map(i => `
          <tr>
            <td class="py-1.5 font-medium">${i.name} <span class="text-[10px] text-slate-400">(${i.label})</span></td>
            <td class="py-1.5 text-center">${i.qty}</td>
            <td class="py-1.5 text-right">${formatMoney(i.price)}</td>
            <td class="py-1.5 text-right font-bold">${formatMoney(i.price * i.qty)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="border-t border-dashed border-slate-300 pt-3 text-right space-y-1">
      <div class="text-sm font-black flex justify-between">
        <span>TỔNG CỘNG:</span>
        <span class="text-base text-indigo-600">${formatMoney(order.total)}</span>
      </div>
    </div>
    
    <div class="text-center text-xs text-slate-500 mt-6 pt-4 border-t border-slate-200">
      Cảm ơn quý khách & Hẹn gặp lại!
    </div>
  `;
}

function toggleReceiptModal(show) {
  const modal = document.getElementById('receipt-modal');
  if (modal) {
    if (show) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    } else {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }
}

function printReceipt() {
  if (!currentActiveOrder) return;
  const container = document.getElementById('printable-receipt');
  if (container) {
    // Đảm bảo tương thích cả hoa lẫn thường cho print.html
    localStorage.setItem('POS_PRINT_DATA', container.innerHTML);
    localStorage.setItem('pos_print_data', container.innerHTML);
    window.open('print.html', '_blank');
  }
}

// ==========================================
// 9. QUẢN LÝ SẢN PHẨM
// ==========================================
function renderProductsTable() {
  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  products.forEach(p => {
    const prices = sanitizePrices(p);
    const prodId = p.Id || p.id;
    const prodName = p.Name || p.name || '---';
    const prodUnit = p.Unit || p.unit || '---';

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/50 transition";

    const priceListBadge = prices.map(pr => `
      <span class="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md text-xs font-semibold text-slate-700">
        ${pr.label || 'Mức giá'}: <strong class="text-indigo-600">${formatMoney(pr.price)}</strong>
      </span>
    `).join(' ');

    tr.innerHTML = `
      <td class="p-4 font-bold text-slate-800">${prodName}</td>
      <td class="p-4 text-slate-500">${prodUnit}</td>
      <td class="p-4 flex flex-wrap gap-1.5">${priceListBadge}</td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editProduct('${prodId}')" class="text-indigo-600 hover:text-indigo-800 font-semibold text-xs px-2 py-1 bg-indigo-50 rounded-lg">Sửa</button>
        <button onclick="deleteProduct('${prodId}')" class="text-red-500 hover:text-red-700 font-semibold text-xs px-2 py-1 bg-red-50 rounded-lg">Xóa</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openProductModal() {
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-unit').value = '';
  document.getElementById('prod-modal-title').innerText = 'Thêm Sản Phẩm Mới';

  const container = document.getElementById('price-rows-container');
  if (container) {
    container.innerHTML = '';
    addPriceRow('Giá Chuẩn', '');
  }

  toggleProductModal(true);
}

function addPriceRow(label = '', price = '') {
  const container = document.getElementById('price-rows-container');
  if (!container) return;
  const div = document.createElement('div');
  div.className = "flex items-center gap-2 price-row";
  div.innerHTML = `
    <input type="text" placeholder="Tên mức giá" value="${label}" required class="flex-1 p-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 price-label-input">
    <input type="number" placeholder="Giá bán" value="${price}" min="0" required class="w-28 p-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 price-value-input">
    <button type="button" onclick="this.parentElement.remove()" class="p-2 text-red-500 hover:bg-red-50 rounded-lg"><i class="ph-bold ph-trash"></i></button>
  `;
  container.appendChild(div);
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value;
  const name = document.getElementById('prod-name').value;
  const unit = document.getElementById('prod-unit').value;

  const priceRows = document.querySelectorAll('.price-row');
  const pricesList = [];
  priceRows.forEach(row => {
    const l = row.querySelector('.price-label-input').value || 'Mức giá';
    const v = Number(row.querySelector('.price-value-input').value) || 0;
    pricesList.push({ label: l, price: v });
  });

  const firstPrice = pricesList.length > 0 ? pricesList[0].price : 0;

  if (id) {
    const idx = products.findIndex(p => (p.Id || p.id) == id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], Name: name, name, Unit: unit, unit, Price: firstPrice, price: firstPrice, prices: pricesList };
    }
    if (supabase) {
      try {
        await supabase.from('Products').update({ Name: name, Unit: unit, Price: firstPrice, prices: pricesList }).eq('Id', id);
      } catch (err) { console.error(err); }
    }
  } else {
    const newProduct = { Name: name, Unit: unit, Price: firstPrice, prices: pricesList };
    if (supabase) {
      try {
        const { data } = await supabase.from('Products').insert([newProduct]).select();
        if (data && data[0]) products.push(data[0]);
      } catch (err) { console.error(err); }
    } else {
      products.push({ Id: Date.now(), ...newProduct });
    }
  }

  saveToLocalStorage();
  renderProductsTable();
  renderPosProducts();
  toggleProductModal(false);
}

function editProduct(id) {
  const p = products.find(prod => (prod.Id || prod.id) == id);
  if (!p) return;

  document.getElementById('prod-id').value = p.Id || p.id;
  document.getElementById('prod-name').value = p.Name || p.name;
  document.getElementById('prod-unit').value = p.Unit || p.unit;
  document.getElementById('prod-modal-title').innerText = 'Chỉnh Sửa Sản Phẩm';

  const container = document.getElementById('price-rows-container');
  if (container) {
    container.innerHTML = '';
    const prices = sanitizePrices(p);
    prices.forEach(pr => addPriceRow(pr.label, pr.price));
  }

  toggleProductModal(true);
}

async function deleteProduct(id) {
  if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
    products = products.filter(p => (p.Id || p.id) != id);
    if (supabase) {
      try { await supabase.from('Products').delete().eq('Id', id); } catch (e) {}
    }
    saveToLocalStorage();
    renderProductsTable();
    renderPosProducts();
  }
}

function toggleProductModal(show) {
  const modal = document.getElementById('product-modal');
  if (modal) {
    if (show) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    } else {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }
}

// ==========================================
// 10. QUẢN LÝ KHÁCH HÀNG
// ==========================================
function renderCustomersTable() {
  const tbody = document.getElementById('customer-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  customers.forEach(c => {
    const custId = c.Id || c.id;
    const custName = c.Name || c.name || '---';
    const custPhone = c.Phone || c.phone || '---';

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/50 transition";
    tr.innerHTML = `
      <td class="p-4 font-bold text-slate-800">${custName}</td>
      <td class="p-4 text-slate-500">${custPhone}</td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editCustomer('${custId}')" class="text-indigo-600 hover:text-indigo-800 font-semibold text-xs px-2 py-1 bg-indigo-50 rounded-lg">Sửa</button>
        <button onclick="deleteCustomer('${custId}')" class="text-red-500 hover:text-red-700 font-semibold text-xs px-2 py-1 bg-red-50 rounded-lg">Xóa</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCustomerSelect() {
  const select = document.getElementById('cart-customer');
  if (!select) return;
  select.innerHTML = '<option value="">Khách Vãng Lai</option>';
  customers.forEach(c => {
    const custId = c.Id || c.id;
    const custName = c.Name || c.name;
    const custPhone = c.Phone || c.phone;
    const opt = document.createElement('option');
    opt.value = custId;
    opt.innerText = `${custName} ${custPhone ? '(' + custPhone + ')' : ''}`;
    select.appendChild(opt);
  });
}

function openCustomerModal() {
  document.getElementById('cust-id').value = '';
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-phone').value = '';
  document.getElementById('cust-modal-title').innerText = 'Thêm Khách Hàng Mới';
  toggleCustomerModal(true);
}

async function saveCustomer(e) {
  e.preventDefault();
  const id = document.getElementById('cust-id').value;
  const name = document.getElementById('cust-name').value;
  const phone = document.getElementById('cust-phone').value;

  if (id) {
    const idx = customers.findIndex(c => (c.Id || c.id) == id);
    if (idx !== -1) customers[idx] = { ...customers[idx], Name: name, name, Phone: phone, phone };
    if (supabase) {
      try { await supabase.from('Customers').update({ Name: name, Phone: phone }).eq('Id', id); } catch (e) {}
    }
  } else {
    const newCust = { Name: name, Phone: phone };
    if (supabase) {
      try {
        const { data } = await supabase.from('Customers').insert([newCust]).select();
        if (data && data[0]) customers.push(data[0]);
      } catch (e) {}
    } else {
      customers.push({ Id: Date.now(), ...newCust });
    }
  }

  saveToLocalStorage();
  renderCustomersTable();
  renderCustomerSelect();
  toggleCustomerModal(false);
}

function editCustomer(id) {
  const c = customers.find(cust => (cust.Id || cust.id) == id);
  if (!c) return;

  document.getElementById('cust-id').value = c.Id || c.id;
  document.getElementById('cust-name').value = c.Name || c.name;
  document.getElementById('cust-phone').value = c.Phone || c.phone;
  document.getElementById('cust-modal-title').innerText = 'Chỉnh Sửa Khách Hàng';
  toggleCustomerModal(true);
}

async function deleteCustomer(id) {
  if (confirm('Xóa khách hàng này?')) {
    customers = customers.filter(c => (c.Id || c.id) != id);
    if (supabase) {
      try { await supabase.from('Customers').delete().eq('Id', id); } catch (e) {}
    }
    saveToLocalStorage();
    renderCustomersTable();
    renderCustomerSelect();
  }
}

function toggleCustomerModal(show) {
  const modal = document.getElementById('customer-modal');
  if (modal) {
    if (show) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    } else {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }
}

// ==========================================
// 11. BÁO CÁO & XÓA BILL VỚI PIN
// ==========================================
function renderReports() {
  const startDateEl = document.getElementById('report-start-date');
  const endDateEl = document.getElementById('report-end-date');

  const startDate = startDateEl ? startDateEl.value : '';
  const endDate = endDateEl ? endDateEl.value : '';

  const tbody = document.getElementById('report-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  let totalRevenue = 0;

  const filteredOrders = orders.filter(order => {
    const orderDate = order.timestamp ? order.timestamp.split('T')[0] : '';
    if (startDate && orderDate < startDate) return false;
    if (endDate && orderDate > endDate) return false;
    return true;
  });

  filteredOrders.forEach(order => {
    totalRevenue += Number(order.total || 0);
    const dateStr = order.timestamp ? new Date(order.timestamp).toLocaleString('vi-VN') : '---';

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/50 transition";
    tr.innerHTML = `
      <td class="p-4 font-bold text-indigo-600 font-mono">${order.id}</td>
      <td class="p-4 text-slate-500 text-xs">${dateStr}</td>
      <td class="p-4 text-slate-800 font-semibold">${order.customerName || 'Khách Vãng Lai'}</td>
      <td class="p-4 font-bold text-slate-800">${formatMoney(order.total)}</td>
      <td class="p-4 text-right space-x-2">
        <button onclick="viewReportReceipt('${order.id}')" class="text-indigo-600 hover:text-indigo-800 font-semibold text-xs px-2.5 py-1 bg-indigo-50 rounded-lg">Xem Bill</button>
        <button onclick="deleteBillWithPin('${order.id}')" class="text-red-500 hover:text-red-700 font-semibold text-xs px-2.5 py-1 bg-red-50 rounded-lg">Xóa Bill</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const revenueEl = document.getElementById('report-total-revenue');
  if (revenueEl) revenueEl.innerText = formatMoney(totalRevenue);
}

function viewReportReceipt(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (order) {
    currentActiveOrder = order;
    renderReceipt(order);
    toggleReceiptModal(true);
  }
}

function deleteBillWithPin(orderId) {
  requestPin(async () => {
    if (confirm(`Xác nhận xóa Bill ${orderId}?`)) {
      orders = orders.filter(o => o.id !== orderId);
      if (supabase) {
        try { await supabase.from('Orders').delete().eq('id', orderId); } catch (e) {}
      }
      saveToLocalStorage();
      renderReports();
      alert('✅ Đã xóa bill thành công!');
    }
  });
}

// ==========================================
// 12. SUPABASE API FETCHING HELPERS
// ==========================================
async function fetchProductsFromAPI() {
  try {
    const { data, error } = await supabase.from('Products').select('*');
    if (!error && data) {
      products = data;
      saveToLocalStorage();
    }
  } catch (err) {
    console.error('Lỗi lấy Products từ Supabase:', err);
  }
}

async function fetchCustomersFromAPI() {
  try {
    const { data, error } = await supabase.from('Customers').select('*');
    if (!error && data) {
      customers = data;
      saveToLocalStorage();
    }
  } catch (err) {
    console.error('Lỗi lấy Customers từ Supabase:', err);
  }
}

async function fetchOrdersFromAPI() {
  try {
    const { data, error } = await supabase.from('Orders').select('*').order('timestamp', { ascending: false });
    if (!error && data) {
      orders = data.map(o => ({
        ...o,
        items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items
      }));
      saveToLocalStorage();
    }
  } catch (err) {
    console.error('Lỗi lấy Orders từ Supabase:', err);
  }
}
