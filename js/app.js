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

// ----------------- UI & TABS & MODALS -----------------
function switchTab(tab) {
  const tabs = ['pos', 'products', 'customers'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const section = document.getElementById(`section-${t}`);
    if (btn && section) {
      if (t === tab) {
        btn.className = 'px-4 py-2 rounded-lg bg-white shadow-sm text-indigo-600 transition';
        section.classList.remove('hidden');
      } else {
        btn.className = 'px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 transition';
        section.classList.add('hidden');
      }
    }
  });
}

function toggleModal(id, show) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (show) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } else {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  }
}

function toggleProductModal(show) { toggleModal('product-modal', show); }
function toggleCustomerModal(show) { toggleModal('customer-modal', show); }
function toggleStoreSettingsModal(show) { toggleModal('store-modal', show); }

// ----------------- STORE SETTINGS -----------------
function loadStoreSettings() {
  const store = JSON.parse(localStorage.getItem('store_info')) || {
    name: 'Cửa Hàng Của Tôi',
    phone: '---',
    address: '---'
  };

  const nameEl = document.getElementById('header-store-name');
  const phoneEl = document.getElementById('header-store-phone');
  const addrEl = document.getElementById('header-store-address');

  if (nameEl) nameEl.innerText = store.name;
  if (phoneEl) phoneEl.innerHTML = `<i class="ph ph-phone"></i> ${store.phone}`;
  if (addrEl) addrEl.innerHTML = `<i class="ph ph-map-pin"></i> ${store.address}`;

  const inputName = document.getElementById('store-name-input');
  const inputPhone = document.getElementById('store-phone-input');
  const inputAddr = document.getElementById('store-address-input');

  if (inputName) inputName.value = store.name;
  if (inputPhone) inputPhone.value = store.phone;
  if (inputAddr) inputAddr.value = store.address;
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

// ----------------- POS LOGIC -----------------
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
    customers.map(c => `<option value="${c.Id || c.id}">${c.FullName} - ${c.Phone}</option>`).join('');
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
  if (item.quantity <= 0) cart = cart.filter(i => (i.Id || i.id) != id);
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
      <div>
        <h5 class="text-xs font-bold text-slate-800">${i.Name}</h5>
        <span class="text-xs text-slate-500">${Number(i.Price || 0).toLocaleString('vi-VN')} ₫</span>
      </div>
      <div class="flex items-center space-x-2">
        <button onclick="updateCartQty(${i.Id || i.id}, -1)" class="w-6 h-6 bg-white border border-slate-200 rounded-lg font-bold text-xs hover:bg-slate-100 flex items-center justify-center">-</button>
        <span class="text-xs font-semibold text-slate-700">${i.quantity}</span>
        <button onclick="updateCartQty(${i.Id || i.id}, 1)" class="w-6 h-6 bg-white border border-slate-200 rounded-lg font-bold text-xs hover:bg-slate-100 flex items-center justify-center">+</button>
      </div>
    </div>
  `).join('');
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
      <td class="p-4 text-right">
        <button onclick="deleteProduct(${p.Id || p.id})" class="text-red-500 hover:text-red-700 font-medium text-xs">Xóa</button>
      </td>
    </tr>
  `).join('');
}

async function saveProduct(e) {
  e.preventDefault();
  const Name = document.getElementById('prod-name').value;
  const Unit = document.getElementById('prod-unit').value;
  const Price = parseFloat(document.getElementById('prod-price').value);

  const { error } = await db.from('Products').insert([{ Name, Unit, Price }]);
  if (error) return alert('Lỗi thêm sản phẩm: ' + error.message);

  toggleProductModal(false);
  e.target.reset();
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
      <td class="p-4 text-slate-500">${c.Phone}</td>
      <td class="p-4 text-right">
        <button onclick="deleteCustomer(${c.Id || c.id})" class="text-red-500 hover:text-red-700 font-medium text-xs">Xóa</button>
      </td>
    </tr>
  `).join('');
}

async function saveCustomer(e) {
  e.preventDefault();
  const FullName = document.getElementById('cust-name').value;
  const Phone = document.getElementById('cust-phone').value;

  const { error } = await db.from('Customers').insert([{ FullName, Phone }]);
  if (error) return alert('Lỗi thêm khách hàng: ' + error.message);

  toggleCustomerModal(false);
  e.target.reset();
  await initData();
}

async function deleteCustomer(id) {
  if (!confirm('Xóa khách hàng này?')) return;
  await db.from('Customers').delete().eq(customers[0]?.Id !== undefined ? 'Id' : 'id', id);
  await initData();
}
