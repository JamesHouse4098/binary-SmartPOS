const SUPABASE_URL = 'https://relogavxtjjbfciifuel.supabase.co';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let products = [];
let customers = [];
let cart = [];

document.addEventListener('DOMContentLoaded', () => {
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

// ----------------- MODALS CONTROL -----------------
function toggleProductModal(show) {
  const modal = document.getElementById('product-modal');
  if (show) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
  else { modal.classList.remove('flex'); modal.classList.add('hidden'); }
}

function toggleCustomerModal(show) {
  const modal = document.getElementById('customer-modal');
  if (show) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
  else { modal.classList.remove('flex'); modal.classList.add('hidden'); }
}

// ----------------- POS LOGIC -----------------
function renderPosProducts() {
  const grid = document.getElementById('pos-product-grid');
  const search = (document.getElementById('pos-search')?.value || '').toLowerCase();
  
  const filtered = products.filter(p => (p.Name || '').toLowerCase().includes(search));
  
  grid.innerHTML = filtered.map(p => `
    <div onclick="addToCart(${p.Id || p.id})" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-indigo-500 cursor-pointer transition flex flex-col justify-between">
      <div>
        <h4 class="font-bold text-gray-800 text-sm mb-1">${p.Name}</h4>
        <span class="text-xs text-gray-400">ĐVT: ${p.Unit || 'Cái'}</span>
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
    container.innerHTML = `<p class="text-center text-gray-400 py-8">Chưa có sản phẩm nào trong giỏ</p>`;
    return;
  }

  container.innerHTML = cart.map(i => `
    <div class="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg border">
      <div>
        <h5 class="text-xs font-bold">${i.Name}</h5>
        <span class="text-xs text-gray-500">${Number(i.Price || 0).toLocaleString('vi-VN')} ₫</span>
      </div>
      <div class="flex items-center space-x-2">
        <button onclick="updateCartQty(${i.Id || i.id}, -1)" class="w-6 h-6 bg-white border rounded font-bold text-xs">-</button>
        <span class="text-xs font-semibold">${i.quantity}</span>
        <button onclick="updateCartQty(${i.Id || i.id}, 1)" class="w-6 h-6 bg-white border rounded font-bold text-xs">+</button>
      </div>
    </div>
  `).join('');
}

// ----------------- CRUD PRODUCTS -----------------
function renderProductTable() {
  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;
  tbody.innerHTML = products.map(p => `
    <tr>
      <td class="p-4 font-medium">${p.Name}</td>
      <td class="p-4 text-gray-500">${p.Unit || 'Cái'}</td>
      <td class="p-4 font-bold text-indigo-600">${Number(p.Price || 0).toLocaleString('vi-VN')} ₫</td>
      <td class="p-4 text-right">
        <button onclick="deleteProduct(${p.Id || p.id})" class="text-red-500 hover:underline">Xóa</button>
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
  await db.from('Products').delete().eq(products[0].Id ? 'Id' : 'id', id);
  await initData();
}

// ----------------- CRUD CUSTOMERS -----------------
function renderCustomerTable() {
  const tbody = document.getElementById('customer-table-body');
  if (!tbody) return;
  tbody.innerHTML = customers.map(c => `
    <tr>
      <td class="p-4 font-medium">${c.FullName}</td>
      <td class="p-4 text-gray-500">${c.Phone}</td>
      <td class="p-4 text-right">
        <button onclick="deleteCustomer(${c.Id || c.id})" class="text-red-500 hover:underline">Xóa</button>
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
  await db.from('Customers').delete().eq(customers[0].Id ? 'Id' : 'id', id);
  await initData();
}
