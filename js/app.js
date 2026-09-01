const SUPABASE_URL = 'https://your-supabase-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbG9nYXZ4dGpqYmZjaWlmdWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDI3MDYsImV4cCI6MjEwMzcxODcwNn0.RaRNG00RYPpU4JqixjR0d7vpw0Al8JUwJXslIDfh41Y';

let supabase = null;
if (typeof createClient !== 'undefined' && SUPABASE_URL !== 'https://your-supabase-project.supabase.co') {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ==========================================
// 2. STATE MANAGEMENT & LOCAL STORAGE
// ==========================================
let products = JSON.parse(localStorage.getItem('pos_products')) || [
  { id: '1', name: 'Cà Phê Đen', unit: 'Ly', prices: [{ label: 'Giá Chuẩn', price: 25000 }, { label: 'Mang Về', price: 20000 }] },
  { id: '2', name: 'Trà Sữa Thái', unit: 'Ly', prices: [{ label: 'Size M', price: 30000 }, { label: 'Size L', price: 40000 }] },
  { id: '3', name: 'Bánh Mỳ Thịt', unit: 'Ổ', prices: [{ label: 'Bình Thường', price: 20000 }, { label: 'Đặc Biệt', price: 30000 }] }
];

let customers = JSON.parse(localStorage.getItem('pos_customers')) || [
  { id: '1', name: 'Nguyễn Văn A', phone: '0901234567' }
];

let storeConfig = JSON.parse(localStorage.getItem('pos_store_config')) || {
  name: 'Cửa Hàng Của Tôi',
  phone: '0909 123 456',
  address: '123 Đường ABC, Q. Tân Phú, TP.HCM',
  pin: '1234'
};

let orders = JSON.parse(localStorage.getItem('pos_orders')) || [];
let cart = [];
let pendingPinCallback = null;

// ==========================================
// 3. KHI TRANG TẢI XONG
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  renderStoreInfo();
  initDateFilters();

  // Tải dữ liệu từ Supabase API (nếu có cấu hình)
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

const formatMoney = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

function saveToLocalStorage() {
  localStorage.setItem('pos_products', JSON.stringify(products));
  localStorage.setItem('pos_customers', JSON.stringify(customers));
  localStorage.setItem('pos_store_config', JSON.stringify(storeConfig));
  localStorage.setItem('pos_orders', JSON.stringify(orders));
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
// 5. MÃ PIN BẢO MẬT (DÙNG CHO SỬA / XÓA BILL)
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
// 6. POS & SẢN PHẨM ĐA MỨC GIÁ
// ==========================================
function renderPosProducts() {
  const searchInput = document.getElementById('pos-search');
  const query = searchInput ? searchInput.value.toLowerCase() : '';
  const grid = document.getElementById('pos-product-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = products.filter(p => p.name.toLowerCase().includes(query));

  filtered.forEach(p => {
    const card = document.createElement('div');
    card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between active:scale-95";
    
    let priceText = '';
    if (p.prices && p.prices.length > 1) {
      priceText = `<span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">${p.prices.length} Mức giá</span>`;
    } else {
      const singlePrice = (p.prices && p.prices.length > 0) ? p.prices[0].price : 0;
      priceText = `<span class="font-bold text-indigo-600 text-sm">${formatMoney(singlePrice)}</span>`;
    }

    card.innerHTML = `
      <div>
        <h4 class="font-bold text-slate-800 text-sm leading-snug line-clamp-2">${p.name}</h4>
        <p class="text-xs text-slate-400 mt-1">ĐVT: ${p.unit || '---'}</p>
      </div>
      <div class="mt-3 flex justify-between items-center">
        ${priceText}
        <div class="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-bold">
          <i class="ph-bold ph-plus"></i>
        </div>
      </div>
    `;
    card.onclick = () => handlePosProductClick(p);
    grid.appendChild(card);
  });
}

function handlePosProductClick(product) {
  if (!product.prices || product.prices.length === 0) return;

  if (product.prices.length === 1) {
    addToCart(product, product.prices[0]);
  } else {
    openPriceSelectorModal(product);
  }
}

function openPriceSelectorModal(product) {
  const container = document.getElementById('price-selector-options');
  const title = document.getElementById('price-selector-title');
  if (title) title.innerText = `Chọn giá - ${product.name}`;
  if (!container) return;
  container.innerHTML = '';

  product.prices.forEach((priceObj) => {
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
  const cartItemKey = `${product.id}_${priceObj.label}_${priceObj.price}`;
  const existing = cart.find(item => item.key === cartItemKey);
  
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      key: cartItemKey,
      productId: product.id,
      name: product.name,
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
// 8. THANH TOÁN & TẠO HÓA ĐƠN
// ==========================================
async function checkout() {
  if (cart.length === 0) {
    alert('Giỏ hàng đang trống!');
    return;
  }

  const customerSelect = document.getElementById('cart-customer');
  const customerId = customerSelect ? customerSelect.value : '';
  const cust = customers.find(c => c.id === customerId);

  const order = {
    id: 'BILL' + Date.now().toString().slice(-6),
    timestamp: new Date().toISOString(),
    customerName: cust ? cust.name : 'Khách Vãng Lai',
    customerPhone: cust ? cust.phone : '',
    items: [...cart],
    total: cart.reduce((sum, item) => sum + (item.price * item.qty), 0)
  };

  orders.unshift(order);
  saveToLocalStorage();

  // Đồng bộ lên Supabase nếu có API
  if (supabase) {
    await supabase.from('orders').insert([order]);
  }

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
  window.print();
}

// ==========================================
// 9. QUẢN LÝ SẢN PHẨM & ĐA MỨC GIÁ
// ==========================================
function renderProductsTable() {
  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  products.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/50 transition";
    
    let priceListBadge = p.prices.map(pr => `
      <span class="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md text-xs font-semibold text-slate-700">
        ${pr.label}: <strong class="text-indigo-600">${formatMoney(pr.price)}</strong>
      </span>
    `).join(' ');

    tr.innerHTML = `
      <td class="p-4 font-bold text-slate-800">${p.name}</td>
      <td class="p-4 text-slate-500">${p.unit || '---'}</td>
      <td class="p-4 flex flex-wrap gap-1.5">${priceListBadge}</td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editProduct('${p.id}')" class="text-indigo-600 hover:text-indigo-800 font-semibold text-xs px-2 py-1 bg-indigo-50 rounded-lg">Sửa</button>
        <button onclick="deleteProduct('${p.id}')" class="text-red-500 hover:text-red-700 font-semibold text-xs px-2 py-1 bg-red-50 rounded-lg">Xóa</button>
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
    <input type="text" placeholder="Tên mức giá (vd: Giá sỉ, Size L)" value="${label}" required class="flex-1 p-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 price-label-input">
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
  const prices = [];
  priceRows.forEach(row => {
    const label = row.querySelector('.price-label-input').value;
    const price = Number(row.querySelector('.price-value-input').value);
    prices.push({ label, price });
  });

  if (prices.length === 0) {
    alert('Sản phẩm phải có ít nhất một mức giá!');
    return;
  }

  const productData = { name, unit, prices };

  if (id) {
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) products[index] = { id, ...productData };
    if (supabase) await supabase.from('products').update(productData).eq('id', id);
  } else {
    const newId = Date.now().toString();
    const newProduct = { id: newId, ...productData };
    products.push(newProduct);
    if (supabase) await supabase.from('products').insert([newProduct]);
  }

  saveToLocalStorage();
  renderProductsTable();
  renderPosProducts();
  toggleProductModal(false);
}

function editProduct(id) {
  const p = products.find(prod => prod.id === id);
  if (!p) return;

  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-unit').value = p.unit;
  document.getElementById('prod-modal-title').innerText = 'Chỉnh Sửa Sản Phẩm';

  const container = document.getElementById('price-rows-container');
  if (container) {
    container.innerHTML = '';
    p.prices.forEach(pr => addPriceRow(pr.label, pr.price));
  }

  toggleProductModal(true);
}

async function deleteProduct(id) {
  if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
    products = products.filter(p => p.id !== id);
    if (supabase) await supabase.from('products').delete().eq('id', id);
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
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/50 transition";
    tr.innerHTML = `
      <td class="p-4 font-bold text-slate-800">${c.name}</td>
      <td class="p-4 text-slate-500">${c.phone || '---'}</td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editCustomer('${c.id}')" class="text-indigo-600 hover:text-indigo-800 font-semibold text-xs px-2 py-1 bg-indigo-50 rounded-lg">Sửa</button>
        <button onclick="deleteCustomer('${c.id}')" class="text-red-500 hover:text-red-700 font-semibold text-xs px-2 py-1 bg-red-50 rounded-lg">Xóa</button>
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
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.innerText = `${c.name} ${c.phone ? '(' + c.phone + ')' : ''}`;
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

  const custData = { name, phone };

  if (id) {
    const idx = customers.findIndex(c => c.id === id);
    if (idx !== -1) customers[idx] = { id, ...custData };
    if (supabase) await supabase.from('customers').update(custData).eq('id', id);
  } else {
    const newId = Date.now().toString();
    const newCust = { id: newId, ...custData };
    customers.push(newCust);
    if (supabase) await supabase.from('customers').insert([newCust]);
  }

  saveToLocalStorage();
  renderCustomersTable();
  renderCustomerSelect();
  toggleCustomerModal(false);
}

function editCustomer(id) {
  const c = customers.find(cust => cust.id === id);
  if (!c) return;

  document.getElementById('cust-id').value = c.id;
  document.getElementById('cust-name').value = c.name;
  document.getElementById('cust-phone').value = c.phone;
  document.getElementById('cust-modal-title').innerText = 'Chỉnh Sửa Khách Hàng';
  toggleCustomerModal(true);
}

async function deleteCustomer(id) {
  if (confirm('Xóa khách hàng này?')) {
    customers = customers.filter(c => c.id !== id);
    if (supabase) await supabase.from('customers').delete().eq('id', id);
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
// 11. BÁO CÁO & XÓA BILL CÓ XÁC THỰC PIN
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
    const orderDate = order.timestamp.split('T')[0];
    if (startDate && orderDate < startDate) return false;
    if (endDate && orderDate > endDate) return false;
    return true;
  });

  filteredOrders.forEach(order => {
    totalRevenue += order.total;
    const dateStr = new Date(order.timestamp).toLocaleString('vi-VN');
    
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/50 transition";
    tr.innerHTML = `
      <td class="p-4 font-bold text-indigo-600 font-mono">${order.id}</td>
      <td class="p-4 text-slate-500 text-xs">${dateStr}</td>
      <td class="p-4 text-slate-800 font-semibold">${order.customerName}</td>
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
    renderReceipt(order);
    toggleReceiptModal(true);
  }
}

function deleteBillWithPin(orderId) {
  requestPin(async () => {
    if (confirm(`Xác nhận xóa Bill ${orderId}? Thao tác này sẽ cập nhật lại báo cáo doanh thu.`)) {
      orders = orders.filter(o => o.id !== orderId);
      if (supabase) await supabase.from('orders').delete().eq('id', orderId);
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
  const { data, error } = await supabase.from('products').select('*');
  if (!error && data && data.length > 0) {
    products = data;
    saveToLocalStorage();
  }
}

async function fetchCustomersFromAPI() {
  const { data, error } = await supabase.from('customers').select('*');
  if (!error && data && data.length > 0) {
    customers = data;
    saveToLocalStorage();
  }
}

async function fetchOrdersFromAPI() {
  const { data, error } = await supabase.from('orders').select('*').order('timestamp', { ascending: false });
  if (!error && data && data.length > 0) {
    orders = data;
    saveToLocalStorage();
  }
}
