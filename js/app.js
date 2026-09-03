/**
 * SmartPOS Client Application (Supabase Integrated)
 * State, DB Sync, Multi-price, Bill Pin Auth, UI Logic & Auto Bill Gen
 */

// ==========================================
// 1. SUPABASE CONFIG & STATE SETUP
// ==========================================

const SUPABASE_URL = 'https://relogavxtjjbfciifuel.supabase.co'; // Thay URL của ông vào đây
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Thay Key của ông vào đây
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let storeInfo = { name: 'Cửa Hàng Của Tôi', phone: '0901234567', address: '123 Đường ABC', pin: '1234' };
let products = [];
let customers = [];
let cart = JSON.parse(localStorage.getItem('smartpos_cart')) || [];
let bills = [];

let pendingPinAction = null;
let currentActiveBill = null;

// ==========================================
// 2. HELPER UTILITIES
// ==========================================

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
}

// ==========================================
// 3. INITIALIZATION & SUPABASE FETCH
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  await fetchAllData();
  initStoreHeader();
  renderPosProducts();
  renderProductsTable();
  renderCustomersTable();
  renderCustomerSelectOptions();
  renderCart();
  initDateFilters();
  renderReports();
});

async function fetchAllData() {
  try {
    const { data: storeData } = await supabase.from('store_info').select('*').eq('id', 1).single();
    if (storeData) storeInfo = storeData;

    const { data: prodData } = await supabase.from('products').select('*');
    if (prodData) products = prodData;

    const { data: custData } = await supabase.from('customers').select('*');
    if (custData) customers = custData;

    const { data: billData } = await supabase.from('bills').select('*').order('timestamp', { ascending: false });
    if (billData) {
      bills = billData.map(b => ({
        id: b.id,
        timestamp: b.timestamp,
        customer: b.customer,
        items: b.items,
        totalAmount: parseFloat(b.total_amount)
      }));
    }
  } catch (err) {
    console.error('Lỗi lấy dữ liệu từ Supabase:', err);
  }
}

function initStoreHeader() {
  document.getElementById('header-store-name').innerText = storeInfo.name;
  document.getElementById('header-store-phone').innerHTML = `<i class="ph ph-phone"></i> ${storeInfo.phone || '---'}`;
  document.getElementById('header-store-address').innerHTML = `<i class="ph ph-map-pin"></i> ${storeInfo.address || '---'}`;
}

function switchTab(tabName) {
  const tabs = ['pos', 'products', 'customers', 'reports'];
  
  tabs.forEach(tab => {
    const section = document.getElementById(`section-${tab}`);
    const btn = document.getElementById(`tab-${tab}`);
    
    if (tab === tabName) {
      section.classList.remove('hidden');
      btn.className = 'px-4 py-2 rounded-lg bg-white shadow-sm text-indigo-600 transition';
    } else {
      section.classList.add('hidden');
      btn.className = 'px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 transition';
    }
  });

  const searchContainer = document.getElementById('search-container');
  if (tabName === 'pos') {
    searchContainer.classList.remove('hidden');
  } else {
    searchContainer.classList.add('hidden');
  }

  if (tabName === 'reports') {
    renderReports();
  }
}

// ==========================================
// 4. POS PRODUCT SELECTION & CART LOGIC
// ==========================================

function renderPosProducts() {
  const grid = document.getElementById('pos-product-grid');
  const searchKey = document.getElementById('pos-search').value.toLowerCase().trim();
  
  grid.innerHTML = '';

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchKey));

  if (filteredProducts.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 font-medium">Không tìm thấy sản phẩm nào.</div>`;
    return;
  }

  filteredProducts.forEach(product => {
    const minPrice = Math.min(...product.prices.map(p => p.price));
    const priceDisplay = product.prices.length > 1 
      ? `Từ ${formatCurrency(minPrice)}` 
      : formatCurrency(product.prices[0].price);

    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:shadow-md cursor-pointer transition flex flex-col justify-between group';
    card.onclick = () => selectProductForCart(product.id);

    card.innerHTML = `
      <div>
        <h3 class="font-bold text-slate-800 group-hover:text-indigo-600 transition line-clamp-2">${product.name}</h3>
        <p class="text-xs text-slate-400 mt-1">ĐVT: ${product.unit || '---'}</p>
      </div>
      <div class="mt-3 flex items-center justify-between">
        <span class="text-sm font-bold text-indigo-600">${priceDisplay}</span>
        <span class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
          <i class="ph-bold ph-plus"></i>
        </span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function selectProductForCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (product.prices.length === 1) {
    addToCart(product, product.prices[0]);
  } else {
    openPriceSelectorModal(product);
  }
}

function openPriceSelectorModal(product) {
  const modal = document.getElementById('price-selector-modal');
  const title = document.getElementById('price-selector-title');
  const container = document.getElementById('price-selector-options');

  title.innerText = `Chọn Giá - ${product.name}`;
  container.innerHTML = '';

  product.prices.forEach(priceObj => {
    const btn = document.createElement('button');
    btn.className = 'w-full p-3 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-xl flex justify-between items-center transition';
    btn.onclick = () => {
      addToCart(product, priceObj);
      togglePriceSelectorModal(false);
    };
    btn.innerHTML = `
      <span class="font-semibold text-slate-700">${priceObj.label}</span>
      <span class="font-bold text-indigo-600">${formatCurrency(priceObj.price)}</span>
    `;
    container.appendChild(btn);
  });

  togglePriceSelectorModal(true);
}

function togglePriceSelectorModal(show) {
  const modal = document.getElementById('price-selector-modal');
  modal.classList.toggle('hidden', !show);
  modal.classList.toggle('flex', show);
}

function addToCart(product, priceObj) {
  const cartItemId = `${product.id}_${priceObj.label}`;
  const existingIndex = cart.findIndex(item => item.cartItemId === cartItemId);

  if (existingIndex > -1) {
    cart[existingIndex].quantity += 1;
  } else {
    cart.push({
      cartItemId: cartItemId,
      productId: product.id,
      name: product.name,
      label: priceObj.label,
      price: priceObj.price,
      quantity: 1
    });
  }

  localStorage.setItem('smartpos_cart', JSON.stringify(cart));
  renderCart();
}

function updateCartQuantity(cartItemId, delta) {
  const index = cart.findIndex(item => item.cartItemId === cartItemId);
  if (index === -1) return;

  cart[index].quantity += delta;
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }

  localStorage.setItem('smartpos_cart', JSON.stringify(cart));
  renderCart();
}

function clearCart() {
  cart = [];
  localStorage.setItem('smartpos_cart', JSON.stringify(cart));
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const totalDisplay = document.getElementById('cart-total');
  
  container.innerHTML = '';

  if (cart.length === 0) {
    container.innerHTML = `<div class="text-center py-12 text-slate-400 text-sm">Giỏ hàng đang trống</div>`;
    totalDisplay.innerText = formatCurrency(0);
    return;
  }

  let grandTotal = 0;

  cart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    grandTotal += itemTotal;

    const div = document.createElement('div');
    div.className = 'p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2';
    div.innerHTML = `
      <div class="min-w-0 flex-1">
        <h4 class="font-bold text-sm text-slate-800 truncate">${item.name}</h4>
        <div class="text-xs text-slate-500">
          <span class="font-medium text-indigo-600">${item.label}</span> • ${formatCurrency(item.price)}
        </div>
      </div>
      <div class="flex items-center space-x-1 shrink-0">
        <button onclick="updateCartQuantity('${item.cartItemId}', -1)" class="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-600 active:scale-95 transition">-</button>
        <span class="w-8 text-center text-xs font-bold">${item.quantity}</span>
        <button onclick="updateCartQuantity('${item.cartItemId}', 1)" class="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-600 active:scale-95 transition">+</button>
      </div>
    `;
    container.appendChild(div);
  });

  totalDisplay.innerText = formatCurrency(grandTotal);
}

// ==========================================
// 5. CHECKOUT & RECEIPT MODAL
// ==========================================

async function checkout() {
  if (cart.length === 0) {
    alert('Giỏ hàng chưa có sản phẩm nào!');
    return;
  }

  const customerSelect = document.getElementById('cart-customer');
  const customerId = customerSelect.value;
  const customer = customers.find(c => c.id === customerId) || { name: 'Khách Vãng Lai', phone: '---' };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const bill = {
    id: 'BILL' + Math.floor(100000 + Math.random() * 900000),
    timestamp: new Date().toISOString(),
    customer: customer,
    items: [...cart],
    totalAmount: totalAmount
  };

  const { error } = await supabase.from('bills').insert([{
    id: bill.id,
    customer: bill.customer,
    items: bill.items,
    total_amount: bill.totalAmount
  }]);

  if (error) {
    alert('Lỗi lưu hóa đơn!');
    console.error(error);
    return;
  }

  bills.unshift(bill);
  currentActiveBill = bill;
  renderReceiptModal(bill);
  clearCart();
}

function renderReceiptModal(bill) {
  const container = document.getElementById('printable-receipt');
  const dateStr = new Date(bill.timestamp).toLocaleString('vi-VN');

  let itemsHtml = bill.items.map(i => `
    <div class="flex justify-between text-xs py-1 border-b border-dashed border-slate-200">
      <div>
        <div class="font-bold">${i.name} (${i.label})</div>
        <div class="text-slate-500">${i.quantity} x ${formatCurrency(i.price)}</div>
      </div>
      <div class="font-bold align-bottom self-end">${formatCurrency(i.price * i.quantity)}</div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="text-center pb-3 border-b border-slate-300">
      <h2 class="text-lg font-bold uppercase">${storeInfo.name}</h2>
      <p class="text-xs text-slate-500">${storeInfo.address || ''}</p>
      <p class="text-xs text-slate-500">ĐT: ${storeInfo.phone || ''}</p>
    </div>
    
    <div class="text-xs space-y-1 py-2 border-b border-slate-300">
      <div class="flex justify-between"><span>Mã HĐ:</span><span class="font-bold">${bill.id}</span></div>
      <div class="flex justify-between"><span>Ngày:</span><span>${dateStr}</span></div>
      <div class="flex justify-between"><span>Khách hàng:</span><span class="font-bold">${bill.customer.name}</span></div>
    </div>

    <div class="py-2 space-y-1">
      ${itemsHtml}
    </div>

    <div class="pt-2 border-t border-slate-300 flex justify-between items-center text-sm font-bold">
      <span>TỔNG CỘNG:</span>
      <span class="text-base text-indigo-600">${formatCurrency(bill.totalAmount)}</span>
    </div>

    <div class="text-center text-xs text-slate-400 mt-6 pt-2 border-t border-dashed border-slate-200">
      Cảm ơn quý khách & Hẹn gặp lại!
    </div>
  `;

  toggleReceiptModal(true);
}

function toggleReceiptModal(show) {
  const modal = document.getElementById('receipt-modal');
  modal.classList.toggle('hidden', !show);
  modal.classList.toggle('flex', show);
}

function printReceipt() {
  const printContents = document.getElementById('printable-receipt').innerHTML;
  const originalContents = document.body.innerHTML;

  document.body.innerHTML = `<div style="padding:20px; font-family: monospace;">${printContents}</div>`;
  window.print();
  document.body.innerHTML = originalContents;
  window.location.reload();
}

// ==========================================
// 6. AUTO GENERATE BILL (USING CUST & PROD)
// ==========================================

async function generateRandomBill() {
  if (!customers || customers.length === 0) {
    alert('Bro chưa có khách hàng nào trong database!');
    return;
  }
  if (!products || products.length === 0) {
    alert('Bro chưa có sản phẩm nào!');
    return;
  }

  const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
  const numItems = Math.floor(Math.random() * 3) + 1;
  const billItems = [];
  let totalAmount = 0;

  for (let i = 0; i < numItems; i++) {
    const prod = products[Math.floor(Math.random() * products.length)];
    const priceObj = prod.prices[Math.floor(Math.random() * prod.prices.length)];
    const quantity = Math.floor(Math.random() * 3) + 1;
    
    const itemTotal = priceObj.price * quantity;
    totalAmount += itemTotal;

    billItems.push({
      cartItemId: `${prod.id}_${priceObj.label}`,
      productId: prod.id,
      name: prod.name,
      label: priceObj.label,
      price: priceObj.price,
      quantity: quantity
    });
  }

  const newBill = {
    id: 'BILL' + Math.floor(100000 + Math.random() * 900000),
    timestamp: new Date().toISOString(),
    customer: {
      id: randomCustomer.id,
      name: randomCustomer.name,
      phone: randomCustomer.phone || '---'
    },
    items: billItems,
    totalAmount: totalAmount
  };

  const { error } = await supabase.from('bills').insert([{
    id: newBill.id,
    customer: newBill.customer,
    items: newBill.items,
    total_amount: newBill.totalAmount
  }]);

  if (error) {
    console.error('Lỗi tạo bill:', error);
    alert('Không thể lưu bill lên Supabase!');
    return;
  }

  bills.unshift(newBill);
  renderReports();
  renderReceiptModal(newBill);
}

// ==========================================
// 7. PRODUCT MANAGEMENT
// ==========================================

function renderProductsTable() {
  const tbody = document.getElementById('product-table-body');
  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Chưa có sản phẩm nào</td></tr>`;
    return;
  }

  products.forEach(p => {
    const pricesList = p.prices.map(pr => `<span class="inline-block bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-md mr-1 mb-1 font-mono"><b>${pr.label}:</b> ${formatCurrency(pr.price)}</span>`).join('');

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';
    tr.innerHTML = `
      <td class="p-4 font-bold text-slate-800">${p.name}</td>
      <td class="p-4 text-slate-500 text-xs">${p.unit || '---'}</td>
      <td class="p-4">${pricesList}</td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editProduct('${p.id}')" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"><i class="ph-bold ph-pencil-simple"></i></button>
        <button onclick="deleteProduct('${p.id}')" class="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg"><i class="ph-bold ph-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openProductModal(isEdit = false) {
  document.getElementById('prod-modal-title').innerText = isEdit ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới';
  if (!isEdit) {
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-unit').value = '';
    document.getElementById('price-rows-container').innerHTML = '';
    addPriceRow('Mặc định', '');
  }
  toggleProductModal(true);
}

function toggleProductModal(show) {
  const modal = document.getElementById('product-modal');
  modal.classList.toggle('hidden', !show);
  modal.classList.toggle('flex', show);
}

function addPriceRow(label = '', price = '') {
  const container = document.getElementById('price-rows-container');
  const div = document.createElement('div');
  div.className = 'flex items-center gap-2 price-row';
  div.innerHTML = `
    <input type="text" placeholder="Tên mức giá (Size M, Sỉ...)" value="${label}" required class="price-label flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500">
    <input type="number" placeholder="Giá tiền" value="${price}" required min="0" class="price-value flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500">
    <button type="button" onclick="this.parentElement.remove()" class="p-2 text-slate-400 hover:text-red-500"><i class="ph-bold ph-x"></i></button>
  `;
  container.appendChild(div);
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value || generateId('prod');
  const name = document.getElementById('prod-name').value.trim();
  const unit = document.getElementById('prod-unit').value.trim();

  const priceRows = document.querySelectorAll('.price-row');
  const prices = [];

  priceRows.forEach(row => {
    const label = row.querySelector('.price-label').value.trim();
    const price = parseFloat(row.querySelector('.price-value').value);
    if (label && !isNaN(price)) {
      prices.push({ label, price });
    }
  });

  if (prices.length === 0) {
    alert('Vui lòng thêm ít nhất một mức giá!');
    return;
  }

  const newProd = { id, name, unit, prices };
  const { error } = await supabase.from('products').upsert([newProd]);

  if (error) {
    alert('Lỗi lưu sản phẩm!');
    return;
  }

  const index = products.findIndex(p => p.id === id);
  if (index > -1) products[index] = newProd;
  else products.push(newProd);

  renderProductsTable();
  renderPosProducts();
  toggleProductModal(false);
}

function editProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  document.getElementById('prod-id').value = product.id;
  document.getElementById('prod-name').value = product.name;
  document.getElementById('prod-unit').value = product.unit || '';

  const container = document.getElementById('price-rows-container');
  container.innerHTML = '';

  product.prices.forEach(pr => addPriceRow(pr.label, pr.price));
  openProductModal(true);
}

async function deleteProduct(id) {
  if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) {
      products = products.filter(p => p.id !== id);
      renderProductsTable();
      renderPosProducts();
    }
  }
}

// ==========================================
// 8. CUSTOMER MANAGEMENT
// ==========================================

function renderCustomersTable() {
  const tbody = document.getElementById('customer-table-body');
  tbody.innerHTML = '';

  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400">Chưa có khách hàng nào</td></tr>`;
    return;
  }

  customers.forEach(c => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';
    tr.innerHTML = `
      <td class="p-4 font-bold text-slate-800">${c.name}</td>
      <td class="p-4 text-slate-500 font-mono text-xs">${c.phone || '---'}</td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editCustomer('${c.id}')" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"><i class="ph-bold ph-pencil-simple"></i></button>
        <button onclick="deleteCustomer('${c.id}')" class="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg"><i class="ph-bold ph-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCustomerSelectOptions() {
  const select = document.getElementById('cart-customer');
  select.innerHTML = `<option value="">Khách Vãng Lai</option>`;
  customers.forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.innerText = `${c.name} - ${c.phone || 'N/A'}`;
    select.appendChild(option);
  });
}

function openCustomerModal(isEdit = false) {
  document.getElementById('cust-modal-title').innerText = isEdit ? 'Chỉnh Sửa Khách Hàng' : 'Thêm Khách Hàng Mới';
  if (!isEdit) {
    document.getElementById('cust-id').value = '';
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-phone').value = '';
  }
  toggleCustomerModal(true);
}

function toggleCustomerModal(show) {
  const modal = document.getElementById('customer-modal');
  modal.classList.toggle('hidden', !show);
  modal.classList.toggle('flex', show);
}

async function saveCustomer(e) {
  e.preventDefault();
  const id = document.getElementById('cust-id').value || generateId('cust');
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();

  const newCust = { id, name, phone };
  const { error } = await supabase.from('customers').upsert([newCust]);

  if (error) {
    alert('Lỗi lưu khách hàng!');
    return;
  }

  const index = customers.findIndex(c => c.id === id);
  if (index > -1) customers[index] = newCust;
  else customers.push(newCust);

  renderCustomersTable();
  renderCustomerSelectOptions();
  toggleCustomerModal(false);
}

function editCustomer(id) {
  const customer = customers.find(c => c.id === id);
  if (!customer) return;

  document.getElementById('cust-id').value = customer.id;
  document.getElementById('cust-name').value = customer.name;
  document.getElementById('cust-phone').value = customer.phone || '';
  openCustomerModal(true);
}

async function deleteCustomer(id) {
  if (confirm('Xóa khách hàng này?')) {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) {
      customers = customers.filter(c => c.id !== id);
      renderCustomersTable();
      renderCustomerSelectOptions();
    }
  }
}

// ==========================================
// 9. STORE SETTINGS & PIN LOGIC
// ==========================================

function toggleStoreSettingsModal(show) {
  const modal = document.getElementById('store-modal');
  if (show) {
    document.getElementById('store-name-input').value = storeInfo.name || '';
    document.getElementById('store-phone-input').value = storeInfo.phone || '';
    document.getElementById('store-address-input').value = storeInfo.address || '';
    document.getElementById('store-pin-input').value = storeInfo.pin || '1234';
  }
  modal.classList.toggle('hidden', !show);
  modal.classList.toggle('flex', show);
}

async function saveStoreSettings(e) {
  e.preventDefault();
  storeInfo = {
    id: 1,
    name: document.getElementById('store-name-input').value.trim(),
    phone: document.getElementById('store-phone-input').value.trim(),
    address: document.getElementById('store-address-input').value.trim(),
    pin: document.getElementById('store-pin-input').value.trim() || '1234'
  };

  const { error } = await supabase.from('store_info').upsert([storeInfo]);
  if (error) {
    alert('Lỗi cập nhật cửa hàng!');
    return;
  }

  initStoreHeader();
  toggleStoreSettingsModal(false);
}

function requestPinVerification(actionCallback) {
  pendingPinAction = actionCallback;
  document.getElementById('pin-input').value = '';
  togglePinModal(true);
}

function togglePinModal(show) {
  const modal = document.getElementById('pin-modal');
  modal.classList.toggle('hidden', !show);
  modal.classList.toggle('flex', show);
}

function confirmPin(e) {
  e.preventDefault();
  const inputPin = document.getElementById('pin-input').value.trim();

  if (inputPin === storeInfo.pin) {
    togglePinModal(false);
    if (typeof pendingPinAction === 'function') {
      pendingPinAction();
      pendingPinAction = null;
    }
  } else {
    alert('Mã PIN không đúng!');
  }
}

// ==========================================
// 10. REPORTS & BILL MANAGEMENT
// ==========================================

function initDateFilters() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('report-start-date').value = today;
  document.getElementById('report-end-date').value = today;
}

function renderReports() {
  const startDateVal = document.getElementById('report-start-date').value;
  const endDateVal = document.getElementById('report-end-date').value;

  const start = startDateVal ? new Date(startDateVal + 'T00:00:00') : new Date(0);
  const end = endDateVal ? new Date(endDateVal + 'T23:59:59') : new Date();

  const filteredBills = bills.filter(b => {
    const bDate = new Date(b.timestamp);
    return bDate >= start && bDate <= end;
  });

  let totalRev = 0;
  const tbody = document.getElementById('report-table-body');
  tbody.innerHTML = '';

  if (filteredBills.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Không có hóa đơn nào trong khoảng thời gian này</td></tr>`;
  } else {
    filteredBills.forEach(b => {
      totalRev += b.totalAmount;
      const dateStr = new Date(b.timestamp).toLocaleString('vi-VN');

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';
      tr.innerHTML = `
        <td class="p-4 font-bold text-indigo-600 font-mono">${b.id}</td>
        <td class="p-4 text-slate-500 text-xs">${dateStr}</td>
        <td class="p-4 font-semibold text-slate-700">${b.customer.name}</td>
        <td class="p-4 font-bold text-slate-800">${formatCurrency(b.totalAmount)}</td>
        <td class="p-4 text-right space-x-2">
          <button onclick="viewBillDetails('${b.id}')" class="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition">Xem</button>
          <button onclick="deleteBillProtected('${b.id}')" class="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg"><i class="ph-bold ph-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('report-total-revenue').innerText = formatCurrency(totalRev);
}

function viewBillDetails(billId) {
  const bill = bills.find(b => b.id === billId);
  if (bill) {
    renderReceiptModal(bill);
  }
}

function deleteBillProtected(billId) {
  requestPinVerification(async () => {
    const { error } = await supabase.from('bills').delete().eq('id', billId);
    if (!error) {
      bills = bills.filter(b => b.id !== billId);
      renderReports();
    }
  });
}
