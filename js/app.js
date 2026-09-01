// Cấu hình Supabase Client
const SUPABASE_URL = 'https://relogavxtjjbfciifuel.supabase.co/rest/v1/';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbG9nYXZ4dGpqYmZjaWlmdWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDI3MDYsImV4cCI6MjEwMzcxODcwNn0.RaRNG00RYPpU4JqixjR0d7vpw0Al8JUwJXslIDfh41Y';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let products = [];
let customers = [];
let invoices = [];
let cart = [];

// Khởi tạo ứng dụng khi load xong DOM
document.addEventListener('DOMContentLoaded', () => {
  initData();
});

async function initData() {
  await Promise.all([fetchProducts(), fetchCustomers(), fetchInvoices()]);
  renderPosProducts();
  renderCustomerSelect();
  renderProductTable();
  renderCustomerTable();
  renderInvoiceTable();
  initDashboard();
}

// ----------------- FETCH DATA -----------------
async function fetchProducts() {
  const { data, error } = await db.from('products').select('*').order('created_at', { ascending: false });
  if (!error) products = data || [];
}

async function fetchCustomers() {
  const { data, error } = await db.from('customers').select('*').order('created_at', { ascending: false });
  if (!error) customers = data || [];
}

async function fetchInvoices() {
  const { data, error } = await db.from('invoices').select('*, customers(name)').order('created_at', { ascending: false });
  if (!error) invoices = data || [];
}

// ----------------- POS LOGIC -----------------
function renderPosProducts() {
  const grid = document.getElementById('pos-product-grid');
  const search = document.getElementById('pos-search').value.toLowerCase();
  
  const filtered = products.filter(p => p.name.toLowerCase().includes(search));
  
  grid.innerHTML = filtered.map(p => `
    <div onclick="addToCart('${p.id}')" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-indigo-500 cursor-pointer transition flex flex-col justify-between">
      <div>
        <h4 class="font-bold text-gray-800 text-sm mb-1">${p.name}</h4>
        <span class="text-xs text-gray-400">ĐVT: ${p.unit || 'Cái'}</span>
      </div>
      <div class="mt-3 text-indigo-600 font-bold text-base">${Number(p.price).toLocaleString('vi-VN')} ₫</div>
    </div>
  `).join('');
}

function renderCustomerSelect() {
  const select = document.getElementById('cart-customer');
  select.innerHTML = `<option value="">Khách Vãng Lai</option>` + 
    customers.map(c => `<option value="${c.id}">${c.name} - ${c.phone}</option>`).join('');
}

function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  
  const item = cart.find(i => i.id === id);
  if (item) item.quantity += 1;
  else cart.push({ ...product, quantity: 1 });
  
  renderCart();
}

function updateCartQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const countEl = document.getElementById('cart-count');

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = cart.reduce((sum, i) => sum + i.quantity, 0);

  totalEl.innerText = `${total.toLocaleString('vi-VN')} ₫`;
  countEl.innerText = `${count} món`;

  if (cart.length === 0) {
    container.innerHTML = `<p class="text-center text-gray-400 py-8">Chưa có sản phẩm nào trong giỏ</p>`;
    return;
  }

  container.innerHTML = cart.map(i => `
    <div class="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg border">
      <div>
        <h5 class="text-xs font-bold">${i.name}</h5>
        <span class="text-xs text-gray-500">${Number(i.price).toLocaleString('vi-VN')} ₫</span>
      </div>
      <div class="flex items-center space-x-2">
        <button onclick="updateCartQty('${i.id}', -1)" class="w-6 h-6 bg-white border rounded font-bold text-xs">-</button>
        <span class="text-xs font-semibold">${i.quantity}</span>
        <button onclick="updateCartQty('${i.id}', 1)" class="w-6 h-6 bg-white border rounded font-bold text-xs">+</button>
      </div>
    </div>
  `).join('');
}

async function checkout() {
  if (cart.length === 0) return alert('Giỏ hàng trống!');
  
  const customerId = document.getElementById('cart-customer').value || null;
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Tạo Hóa Đơn
  const { data: invoice, error } = await db.from('invoices').insert({
    customer_id: customerId,
    total: parseFloat(total)
  }).select().single();

  if (error) return alert('Lỗi khi thanh toán: ' + error.message);

  // Thêm Chi Tiết Hóa Đơn
  const items = cart.map(i => ({
    invoice_id: invoice.id,
    product_id: i.id,
    quantity: i.quantity,
    price: i.price
  }));

  await db.from('invoice_items').insert(items);

  // In hóa đơn & reset
  printReceipt(invoice.id, total);
  cart = [];
  renderCart();
  await initData();
  switchTab('invoices');
}

function printReceipt(id, total) {
  const printArea = document.getElementById('print-area');
  printArea.innerHTML = `
    <h1>SMART POS</h1>
    <p style="text-align:center;">HÓA ĐƠN BÁN HÀNG</p>
    <p>Mã HĐ: #${id.slice(0, 8)}</p>
    <hr>
    <table>
      ${cart.map(i => `<tr><td>${i.name} x${i.quantity}</td><td style="text-align:right">${(i.price * i.quantity).toLocaleString('vi-VN')} ₫</td></tr>`).join('')}
    </table>
    <hr>
    <h3 class="total">TỔNG: ${total.toLocaleString('vi-VN')} ₫</h3>
  `;
  window.print();
}

// ----------------- CRUD PRODUCTS -----------------
function renderProductTable() {
  const tbody = document.getElementById('product-table-body');
  tbody.innerHTML = products.map(p => `
    <tr>
      <td class="p-4 font-medium">${p.name}</td>
      <td class="p-4 text-gray-500">${p.unit || 'Cái'}</td>
      <td class="p-4 font-bold text-indigo-600">${Number(p.price).toLocaleString('vi-VN')} ₫</td>
      <td class="p-4 text-right">
        <button onclick="deleteProduct('${p.id}')" class="text-red-500 hover:underline">Xóa</button>
      </td>
    </tr>
  `).join('');
}

async function saveProduct(e) {
  e.preventDefault();
  const name = document.getElementById('prod-name').value;
  const unit = document.getElementById('prod-unit').value;
  const price = parseFloat(document.getElementById('prod-price').value);

  const { error } = await db.from('products').insert({ name, unit, price });
  if (error) return alert(error.message);

  toggleProductModal(false);
  e.target.reset();
  await initData();
}

async function deleteProduct(id) {
  if (!confirm('Xóa sản phẩm này?')) return;
  await db.from('products').delete().eq('id', id);
  await initData();
}

// ----------------- CRUD CUSTOMERS -----------------
function renderCustomerTable() {
  const tbody = document.getElementById('customer-table-body');
  tbody.innerHTML = customers.map(c => `
    <tr>
      <td class="p-4 font-medium">${c.name}</td>
      <td class="p-4 text-gray-500">${c.phone}</td>
      <td class="p-4 text-right">
        <button onclick="deleteCustomer('${c.id}')" class="text-red-500 hover:underline">Xóa</button>
      </td>
    </tr>
  `).join('');
}

async function saveCustomer(e) {
  e.preventDefault();
  const name = document.getElementById('cust-name').value;
  const phone = document.getElementById('cust-phone').value;

  const { error } = await db.from('customers').insert({ name, phone });
  if (error) return alert(error.message);

  toggleCustomerModal(false);
  e.target.reset();
  await initData();
}

async function deleteCustomer(id) {
  if (!confirm('Xóa khách hàng này?')) return;
  await db.from('customers').delete().eq('id', id);
  await initData();
}

// ----------------- INVOICES & DASHBOARD -----------------
function renderInvoiceTable() {
  const tbody = document.getElementById('invoice-table-body');
  tbody.innerHTML = invoices.map(i => `
    <tr>
      <td class="p-4 font-bold text-gray-700">#${i.id.slice(0, 8)}</td>
      <td class="p-4 text-gray-600">${i.customers ? i.customers.name : 'Khách Vãng Lai'}</td>
      <td class="p-4 font-bold text-indigo-600 text-right">${Number(i.total).toLocaleString('vi-VN')} ₫</td>
    </tr>
  `).join('');
}

function initDashboard() {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter(i => i.created_at && i.created_at.startsWith(todayStr));
  const todaySales = todayInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);

  document.getElementById('dash-today-sales').innerText = `${todaySales.toLocaleString('vi-VN')} ₫`;
  document.getElementById('dash-today-invoices').innerText = todayInvoices.length;

  if (window.myChart) window.myChart.destroy();
  const ctx = document.getElementById('salesChart');
  if (ctx) {
    window.myChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
        datasets: [{ label: 'Doanh Số', data: [1200000, 1900000, 3000000, 500000, 2000000, 3500000, todaySales], backgroundColor: '#4f46e5' }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}
