const SUPABASE_URL = 'https://relogavxtjjbfciifuel.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbG9nYXZ4dGpqYmZjaWlmdWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDI3MDYsImV4cCI6MjEwMzcxODcwNn0.RaRNG00RYPpU4JqixjR0d7vpw0Al8JUwJXslIDfh41Y';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let products = [];
let customers = [];
let cart = [];

document.addEventListener('DOMContentLoaded', () => {
  loadStoreSettings();
  initData();
});

async function initData() {
  await Promise.all([fetchProducts(), fetchCustomers()]);
  renderPosProducts();
  renderCustomerSelect();
  renderProductTable();
  renderCustomerTable();
  renderCart();
}

// ----------------- FETCH DATA -----------------
async function fetchProducts() {
  const { data, error } = await db.from('Products').select('*');
  if (!error) products = data || [];
}

async function fetchCustomers() {
  const { data, error } = await db.from('Customers').select('*');
  if (!error) customers = data || [];
}

// ----------------- SWITCH TABS & MODALS -----------------
function switchTab(tab) {
  ['pos', 'products', 'customers'].forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const section = document.getElementById(`section-${t}`);
    if (btn && section) {
      if (t === tab) {
        btn.className = 'px-4 py-2 rounded-lg bg-white shadow-sm text-indigo-600 font-bold transition';
        section.classList.remove('hidden');
      } else {
        btn.className = 'px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 font-medium transition';
        section.classList.add('hidden');
      }
    }
  });
}

function toggleModal(id, show) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (show) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
  else { modal.classList.remove('flex'); modal.classList.add('hidden'); }
}

function toggleProductModal(show) { toggleModal('product-modal', show); }
function toggleCustomerModal(show) { toggleModal('customer-modal', show); }
function toggleStoreSettingsModal(show) { toggleModal('store-modal', show); }
function toggleReceiptModal(show) { toggleModal('receipt-modal', show); }

// ----------------- CỬA HÀNG SETTINGS -----------------
function loadStoreSettings() {
  const store = JSON.parse(localStorage.getItem('store_info')) || {
    name: 'Cửa Hàng Của Tôi',
    phone: '0901 234 567',
    address: 'Hồ Chí Minh'
  };

  document.getElementById('header-store-name').innerText = store.name;
  document.getElementById('header-store-phone').innerHTML = `<i class="ph ph-phone"></i> ${store.phone}`;
  document.getElementById('header-store-address').innerHTML = `<i class="ph ph-map-pin"></i> ${store.address}`;

  document.getElementById('store-name-input').value = store.name;
  document.getElementById('store-phone-input').value = store.phone;
  document.getElementById('store-address-input').value = store.address;
}

function saveStoreSettings(e) {
  e.preventDefault();
  const storeInfo = {
    name: document.getElementById('store-name-input').value,
    phone: document.getElementById('store-phone-input').value,
    address: document.getElementById('store-address-input').value
  };

  localStorage.setItem('store_info', JSON.stringify(storeInfo));
  loadStoreSettings();
  toggleStoreSettingsModal(false);
}

// ----------------- POS & CART LOGIC -----------------
function renderPosProducts() {
  const grid = document.getElementById('pos-product-grid');
  if (!grid) return;
  const search = (document.getElementById('pos-search')?.value || '').toLowerCase();
  
  const filtered = products.filter(p => (p.Name || '').toLowerCase().includes(search));
  
  grid.innerHTML = filtered.map(p => `
    <div onclick="addToCart(${p.Id || p.id})" class="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:shadow-md cursor-pointer transition active:scale-95 flex flex-col justify-between">
      <div>
        <h4 class="font-bold text-slate-800 text-sm mb-1">${p.Name}</h4>
        <span class="text-xs text-slate-400">ĐVT: ${p.Unit || 'Cái'}</span>
      </div>
      <div class="mt-3 text-indigo-600 font-bold text-base">${Number(p.Price || 0).toLocaleString('vi-VN')} ₫</div>
    </div>
  `).join('');
}

function renderCustomerSelect() {
  const select = document.getElementById('cart-customer');
  if (!select) return;
  select.innerHTML = `<option value="">Khách Vãng Lai</option>` + 
    customers.map(c => `<option value="${c.Id || c.id}">${c.FullName} ${c.Phone ? '- ' + c.Phone : ''}</option>`).join('');
}

function addToCart(id) {
  const product = products.find(p => (p.Id || p.id) == id);
  if (!product) return;
  
  const item = cart.find(i => (i.Id || i.id) == id);
  if (item) item.quantity += 1;
  else cart.push({ ...product, quantity: 1 });
  
  renderCart();
}

function updateCartQty(id, delta) {
  const item = cart.find(i => (i.Id || i.id) == id);
  if (!item) return;
  
  item.quantity += delta;
  if (item.quantity <= 0) removeCartItem(id);
  else renderCart();
}

function removeCartItem(id) {
  cart = cart.filter(i => (i.Id || i.id) != id);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const countEl = document.getElementById('cart-count');

  const total = cart.reduce((sum, i) => sum + (i.Price || 0) * i.quantity, 0);
  const count = cart.reduce((sum, i) => sum + i.quantity, 0);

  if (totalEl) totalEl.innerText = `${total.toLocaleString('vi-VN')} ₫`;
  if (countEl) countEl.innerText = `${count} món`;

  if (cart.length === 0) {
    container.innerHTML = `<p class="text-center text-slate-400 py-12 text-sm">Chưa có sản phẩm nào trong giỏ</p>`;
    return;
  }

  container.innerHTML = cart.map(i => `
    <div class="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
      <div class="flex-1 pr-2">
        <h5 class="text-xs font-bold text-slate-800 line-clamp-1">${i.Name}</h5>
        <span class="text-xs text-slate-500">${Number(i.Price || 0).toLocaleString('vi-VN')} ₫</span>
      </div>
      <div class="flex items-center space-x-1.5">
        <button onclick="updateCartQty(${i.Id || i.id}, -1)" class="w-6 h-6 bg-white border border-slate-200 rounded-lg font-bold text-xs hover:bg-slate-100 flex items-center justify-center">-</button>
        <span class="text-xs font-semibold text-slate-700 w-5 text-center">${i.quantity}</span>
        <button onclick="updateCartQty(${i.Id || i.id}, 1)" class="w-6 h-6 bg-white border border-slate-200 rounded-lg font-bold text-xs hover:bg-slate-100 flex items-center justify-center">+</button>
        <button onclick="removeCartItem(${i.Id || i.id})" class="text-slate-400 hover:text-red-500 ml-1 text-sm"><i class="ph-bold ph-trash"></i></button>
      </div>
    </div>
  `).join('');
}

// ----------------- THANH TOÁN & GỬI BILL TRỰC TIẾP SANG PRINT.HTML -----------------
function checkout() {
  if (cart.length === 0) return alert('Giỏ hàng đang trống!');

  const store = JSON.parse(localStorage.getItem('store_info')) || { name: 'Cửa Hàng Của Tôi', phone: '---', address: '---' };
  const custId = document.getElementById('cart-customer').value;
  const customer = customers.find(c => (c.Id || c.id) == custId);
  const custName = customer ? customer.FullName : 'Khách Vãng Lai';
  const custPhone = customer && customer.Phone ? customer.Phone : '---';

  const now = new Date();
  const createdTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  const total = cart.reduce((sum, i) => sum + (i.Price || 0) * i.quantity, 0);

  const receiptHTML = `
    <div class="text-center pb-3 border-b border-dashed border-slate-300">
      <h2 class="font-bold text-2xl text-slate-900">${store.name}</h2>
      <p class="text-base">Đ/c: ${store.address}</p>
      <p class="text-base">SĐT: ${store.phone}</p>
    </div>

    <div class="py-2 border-b border-dashed border-slate-300 text-base">
      <p><strong>Ngày tạo:</strong> ${createdTime}</p>
      <p><strong>Khách hàng:</strong> ${custName}</p>
      <p><strong>SĐT:</strong> ${custPhone}</p>
    </div>

    <table class="w-full text-left my-3 text-base">
      <thead>
        <tr class="border-b border-slate-300">
          <th class="py-1">Tên SP</th>
          <th class="py-1 text-center">SL</th>
          <th class="py-1 text-right">Đơn giá</th>
          <th class="py-1 text-right">T.Tiền</th>
        </tr>
      </thead>
      <tbody>
        ${cart.map(i => `
          <tr class="border-b border-slate-100">
            <td class="py-1.5">${i.Name}</td>
            <td class="py-1.5 text-center">${i.quantity}</td>
            <td class="py-1.5 text-right">${Number(i.Price).toLocaleString('vi-VN')}</td>
            <td class="py-1.5 text-right font-semibold">${Number(i.Price * i.quantity).toLocaleString('vi-VN')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="pt-2 border-t border-slate-400 text-right text-lg">
      <p class="font-bold">TỔNG THÀNH TIỀN:</p>
      <p class="text-2xl font-black text-indigo-700 total-price">${total.toLocaleString('vi-VN')} ₫</p>
    </div>

    <div class="text-center pt-4 text-base italic text-slate-600">
      <p>Cảm ơn quý khách và hẹn gặp lại!</p>
    </div>
  `;

  // 1. Lưu HTML hóa đơn vào localStorage cho print.html lấy
  localStorage.setItem('POS_PRINT_DATA', receiptHTML);

  // 2. Mở cửa sổ print.html tự động bật lệnh in
  const printWindow = window.open('print.html', '_blank', 'width=450,height=600');
  if (printWindow) {
    printWindow.focus();
  } else {
    alert('Trình duyệt đang chặn Pop-up! Hãy cho phép Pop-up để tự động in bill nhé.');
  }

  // 3. Clear giỏ hàng sạch sẽ
  clearCart();
}

// Bổ sung hàm backup nếu vẫn muốn gọi thủ công từ Modal
function printReceipt() {
  const receiptHTML = document.getElementById('printable-receipt').innerHTML;
  if (!receiptHTML) return alert('Chưa có nội dung hóa đơn!');

  localStorage.setItem('POS_PRINT_DATA', receiptHTML);
  const printWindow = window.open('print.html', '_blank', 'width=450,height=600');
  
  if (printWindow) {
    printWindow.focus();
  } else {
    alert('Vui lòng cho phép mở Pop-up trên trình duyệt để in hóa đơn!');
  }
}

// ----------------- CRUD PRODUCTS -----------------
function renderProductTable() {
  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;
  tbody.innerHTML = products.map(p => `
    <tr class="hover:bg-slate-50/80 transition">
      <td class="p-4 font-medium text-slate-800">${p.Name}</td>
      <td class="p-4 text-slate-500">${p.Unit || 'Cái'}</td>
      <td class="p-4 font-bold text-indigo-600">${Number(p.Price || 0).toLocaleString('vi-VN')} ₫</td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editProduct(${p.Id || p.id})" class="text-indigo-600 hover:text-indigo-800 font-semibold text-xs">Sửa</button>
        <button onclick="deleteProduct(${p.Id || p.id})" class="text-red-500 hover:text-red-700 font-semibold text-xs">Xóa</button>
      </td>
    </tr>
  `).join('');
}

function openProductModal() {
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-unit').value = '';
  document.getElementById('prod-price').value = '';
  document.getElementById('prod-modal-title').innerText = 'Thêm Sản Phẩm Mới';
  toggleProductModal(true);
}

function editProduct(id) {
  const p = products.find(item => (item.Id || item.id) == id);
  if (!p) return;
  document.getElementById('prod-id').value = p.Id || p.id;
  document.getElementById('prod-name').value = p.Name;
  document.getElementById('prod-unit').value = p.Unit || '';
  document.getElementById('prod-price').value = p.Price;
  document.getElementById('prod-modal-title').innerText = 'Chỉnh Sửa Sản Phẩm';
  toggleProductModal(true);
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value;
  const Name = document.getElementById('prod-name').value;
  const Unit = document.getElementById('prod-unit').value;
  const Price = parseFloat(document.getElementById('prod-price').value);

  if (id) {
    const { error } = await db.from('Products').update({ Name, Unit, Price }).eq(products[0]?.Id !== undefined ? 'Id' : 'id', id);
    if (error) return alert('Lỗi sửa sản phẩm: ' + error.message);
  } else {
    const { error } = await db.from('Products').insert([{ Name, Unit, Price }]);
    if (error) return alert('Lỗi thêm sản phẩm: ' + error.message);
  }

  toggleProductModal(false);
  await initData();
}

async function deleteProduct(id) {
  if (!confirm('Xóa sản phẩm này?')) return;
  await db.from('Products').delete().eq(products[0]?.Id !== undefined ? 'Id' : 'id', id);
  await initData();
}

// ----------------- CRUD CUSTOMERS -----------------
function renderCustomerTable() {
  const tbody = document.getElementById('customer-table-body');
  if (!tbody) return;
  tbody.innerHTML = customers.map(c => `
    <tr class="hover:bg-slate-50/80 transition">
      <td class="p-4 font-medium text-slate-800">${c.FullName}</td>
      <td class="p-4 text-slate-500">${c.Phone || '---'}</td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editCustomer(${c.Id || c.id})" class="text-indigo-600 hover:text-indigo-800 font-semibold text-xs">Sửa</button>
        <button onclick="deleteCustomer(${c.Id || c.id})" class="text-red-500 hover:text-red-700 font-semibold text-xs">Xóa</button>
      </td>
    </tr>
  `).join('');
}

function openCustomerModal() {
  document.getElementById('cust-id').value = '';
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-phone').value = '';
  document.getElementById('cust-modal-title').innerText = 'Thêm Khách Hàng Mới';
  toggleCustomerModal(true);
}

function editCustomer(id) {
  const c = customers.find(item => (item.Id || item.id) == id);
  if (!c) return;
  document.getElementById('cust-id').value = c.Id || c.id;
  document.getElementById('cust-name').value = c.FullName;
  document.getElementById('cust-phone').value = c.Phone || '';
  document.getElementById('cust-modal-title').innerText = 'Chỉnh Sửa Khách Hàng';
  toggleCustomerModal(true);
}

async function saveCustomer(e) {
  e.preventDefault();
  const id = document.getElementById('cust-id').value;
  const FullName = document.getElementById('cust-name').value;
  const Phone = document.getElementById('cust-phone').value;

  if (id) {
    const { error } = await db.from('Customers').update({ FullName, Phone }).eq(customers[0]?.Id !== undefined ? 'Id' : 'id', id);
    if (error) return alert('Lỗi sửa khách hàng: ' + error.message);
  } else {
    const { error } = await db.from('Customers').insert([{ FullName, Phone }]);
    if (error) return alert('Lỗi thêm khách hàng: ' + error.message);
  }

  toggleCustomerModal(false);
  await initData();
}

async function deleteCustomer(id) {
  if (!confirm('Xóa khách hàng này?')) return;
  await db.from('Customers').delete().eq(customers[0]?.Id !== undefined ? 'Id' : 'id', id);
  await initData();
}
