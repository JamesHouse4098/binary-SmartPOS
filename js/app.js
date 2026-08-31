// 1. CẤU HÌNH SUPABASE
const SUPABASE_URL = 'https://YOUR_SUPABASE_URL.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbG9nYXZ4dGpqYmZjaWlmdWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDI3MDYsImV4cCI6MjEwMzcxODcwNn0.RaRNG00RYPpU4JqixjR0d7vpw0Al8JUwJXslIDfh41Y';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// STATE QUẢN LÝ
let state = {
  products: [],
  customers: [],
  invoices: [],
  cart: [],
  chartInstance: null
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  initData();
});

async function initData() {
  await Promise.all([fetchProducts(), fetchCustomers(), fetchInvoices()]);
  renderPosProducts();
  renderCustomerSelect();
  initChart();
}

// 2. FETCH DATA FROM SUPABASE
async function fetchProducts() {
  const { data, error } = await db.from('products').select('*').order('created_at', { ascending: false });
  if (!error && data) {
    state.products = data;
    renderProductTable();
  }
}

async function fetchCustomers() {
  const { data, error } = await db.from('customers').select('*').order('created_at', { ascending: false });
  if (!error && data) {
    state.customers = data;
    renderCustomerTable();
    renderCustomerSelect();
  }
}

async function fetchInvoices() {
  const { data, error } = await db.from('invoices').select('*, invoice_items(*), customers(name)').order('created_at', { ascending: false });
  if (!error && data) {
    state.invoices = data;
    renderInvoiceTable();
    updateDashboardStats();
  }
}

// 3. UI RENDERING
function renderPosProducts() {
  const query = document.getElementById('pos-search')?.value.toLowerCase() || '';
  const grid = document.getElementById('pos-product-grid');
  if (!grid) return;

  const filtered = state.products.filter(p => p.name.toLowerCase().includes(query));
  
  grid.innerHTML = filtered.map(p => `
    <div onclick="addToCart('${p.id}')" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-indigo-500 cursor-pointer transition flex flex-col justify-between">
      <div>
        <h4 class="font-bold text-gray-800 text-sm mb-1 line-clamp-2">${p.name}</h4>
        <span class="text-xs text-gray-400">ĐVT: ${p.unit || 'Cái'}</span>
      </div>
      <div class="mt-3 text-indigo-600 font-bold text-base">
        ${p.price.toLocaleString('vi-VN')} ₫
      </div>
    </div>
  `).join('');
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const countEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total');

  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (countEl) countEl.innerText = `${totalItems} món`;
  if (totalEl) totalEl.innerText = `${totalPrice.toLocaleString('vi-VN')} ₫`;

  if (state.cart.length === 0) {
    container.innerHTML = `<p class="text-center text-gray-400 py-8">Chưa có sản phẩm nào trong giỏ</p>`;
    return;
  }

  container.innerHTML = state.cart.map(item => `
    <div class="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg border border-gray-100">
      <div class="flex-1 pr-2">
        <h5 class="text-xs font-bold text-gray-800">${item.name}</h5>
        <span class="text-xs text-gray-500">${item.price.toLocaleString('vi-VN')} ₫</span>
      </div>
      <div class="flex items-center space-x-2">
        <button onclick="updateCartQty('${item.id}', -1)" class="w-6 h-6 bg-white border border-gray-200 rounded text-xs font-bold flex items-center justify-center">-</button>
        <span class="text-xs font-semibold w-4 text-center">${item.quantity}</span>
        <button onclick="updateCartQty('${item.id}', 1)" class="w-6 h-6 bg-white border border-gray-200 rounded text-xs font-bold flex items-center justify-center">+</button>
        <button onclick="removeFromCart('${item.id}')" class="text-red-500 text-xs pl-1"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function renderProductTable() {
  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;

  tbody.innerHTML = state.products.map(p => `
    <tr>
      <td class="p-4 font-medium text-gray-800">${p.name}</td>
      <td class="p-4 text-gray-500">${p.unit || 'Cái'}</td>
      <td class="p-4 font-bold text-indigo-600">${p.price.toLocaleString('vi-VN')} ₫</td>
      <td class="p-4 text-right">
        <button onclick="deleteProduct('${p.id}')" class="text-red-500 hover:text-red-700 font-medium">Xóa</button>
      </td>
    </tr>
  `).join('');
}

function renderCustomerTable() {
  const tbody = document.getElementById('customer-table-body');
  if (!tbody) return;

  tbody.innerHTML = state.customers.map(c => `
    <tr>
      <td class="p-4 font-medium text-gray-800">${c.name}</td>
      <td class="p-4 text-gray-500">${c.phone}</td>
      <td class="p-4 text-right">
        <button onclick="deleteCustomer('${c.id}')" class="text-red-500 hover:text-red-700 font-medium">Xóa</button>
      </td>
    </tr>
  `).join('');
}

function renderCustomerSelect() {
  const select = document.getElementById('cart-customer');
  if (!select) return;

  select.innerHTML = `<option value="">Khách Vãng Lai</option>` + 
    state.customers.map(c => `<option value="${c.id}">${c.name} - ${c.phone}</option>`).join('');
}

function renderInvoiceTable() {
  const tbody = document.getElementById('invoice-table-body');
  if (!tbody) return;

  tbody.innerHTML = state.invoices.map(i => `
    <tr>
      <td class="p-4 font-bold text-gray-700">#${i.id.slice(0, 8)}</td>
      <td class="p-4 text-gray-600">${i.customers?.name || 'Khách Vãng Lai'}</td>
      <td class="p-4 font-bold text-indigo-600 text-right">${i.total.toLocaleString('vi-VN')} ₫</td>
    </tr>
  `).join('');
}

// 4. CART & POS LOGIC
function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const existing = state.cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ ...product, quantity: 1 });
  }
  renderCart();
}

function updateCartQty(productId, delta) {
  const item = state.cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    renderCart();
  }
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(i => i.id !== productId);
  renderCart();
}

// 5. CHECKOUT & PRINT
async function checkout() {
  if (state.cart.length === 0) return alert('Giỏ hàng trống!');

  const customerId = document.getElementById('cart-customer').value || null;
  const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const { data: invoice, error: invError } = await db.from('invoices').insert({
    customer_id: customerId,
    total: total
  }).select().single();

  if (invError) return alert('Lỗi tạo hóa đơn: ' + invError.message);

  const invoiceItems = state.cart.map(item => ({
    invoice_id: invoice.id,
    product_id: item.id,
    quantity: item.quantity,
    price: item.price
  }));

  const { error: itemError } = await db.from('invoice_items').insert(invoiceItems);
  if (itemError) return alert('Lỗi lưu chi tiết hóa đơn: ' + itemError.message);

  printReceipt(invoice.id, total);

  state.cart = [];
  renderCart();
  await fetchInvoices();
  alert('Thanh toán thành công!');
}

function printReceipt(invoiceId, total) {
  const printArea = document.getElementById('print-area');
  const custName = document.getElementById('cart-customer').selectedOptions[0]?.text || 'Khách Vãng Lai';
  
  const itemsHtml = state.cart.map(i => `
    <tr>
      <td>${i.name} x${i.quantity}</td>
      <td style="text-align:right">${(i.price * i.quantity).toLocaleString('vi-VN')} ₫</td>
    </tr>
  `).join('');

  printArea.innerHTML = `
    <div class="title">SMART POS</div>
    <div style="text-align:center; font-size: 12px; margin-bottom: 10px;">HÓA ĐƠN BÁN HÀNG</div>
    <div>Mã HĐ: #${invoiceId.slice(0, 8)}</div>
    <div>Khách: ${custName}</div>
    <div>Ngày: ${new Date().toLocaleString('vi-VN')}</div>
    <hr style="border-dash: 1px dashed #000; margin: 8px 0;">
    <table>${itemsHtml}</table>
    <hr style="border-dash: 1px dashed #000; margin: 8px 0;">
    <div class="total" style="display:flex; justify-between:space-between;">
      <span>TỔNG CỘNG:</span>
      <span>${total.toLocaleString('vi-VN')} ₫</span>
    </div>
  `;
  window.print();
}

// 6. CRUD DATABASE
async function saveProduct(e) {
  e.preventDefault();
  const name = document.getElementById('prod-name').value;
  const unit = document.getElementById('prod-unit').value;
  const price = parseFloat(document.getElementById('prod-price').value);

  const { error } = await db.from('products').insert({ name, unit, price });
  if (error) return alert('Lỗi thêm sản phẩm: ' + error.message);

  toggleProductModal(false);
  e.target.reset();
  await fetchProducts();
  renderPosProducts();
}

async function deleteProduct(id) {
  if (!confirm('Xóa sản phẩm này?')) return;
  const { error } = await db.from('products').delete().eq('id', id);
  if (!error) {
    await fetchProducts();
    renderPosProducts();
  }
}

async function saveCustomer(e) {
  e.preventDefault();
  const name = document.getElementById('cust-name').value;
  const phone = document.getElementById('cust-phone').value;

  const { error } = await db.from('customers').insert({ name, phone });
  if (error) return alert('Lỗi thêm khách hàng: ' + error.message);

  toggleCustomerModal(false);
  e.target.reset();
  await fetchCustomers();
}

async function deleteCustomer(id) {
  if (!confirm('Xóa khách hàng này?')) return;
  const { error } = await db.from('customers').delete().eq('id', id);
  if (!error) fetchCustomers();
}

// 7. DASHBOARD & CHART
function updateDashboardStats() {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = state.invoices.filter(i => i.created_at.startsWith(todayStr));

  const todaySales = todayInvoices.reduce((sum, i) => sum + i.total, 0);
  const todayItems = todayInvoices.reduce((sum, i) => {
    return sum + (i.invoice_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0);
  }, 0);

  document.getElementById('dash-today-sales').innerText = `${todaySales.toLocaleString('vi-VN')} ₫`;
  document.getElementById('dash-today-invoices').innerText = todayInvoices.length;
  document.getElementById('dash-today-items').innerText = todayItems;
}

function initChart() {
  const ctx = document.getElementById('salesChart')?.getContext('2d');
  if (!ctx) return;

  state.chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      datasets: [{
        label: 'Doanh Số (₫)',
        data: [1200000, 1900000, 3000000, 500000, 2000000, 3500000, 4200000],
        backgroundColor: '#4f46e5',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

// 8. GOOGLE DRIVE INTEGRATION
function connectGoogleDrive() {
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: async (response) => {
      if (response.access_token) {
        await uploadBackupToDrive(response.access_token);
      }
    },
  });
  tokenClient.requestAccessToken();
}

async function uploadBackupToDrive(accessToken) {
  const backupData = JSON.stringify({
    products: state.products,
    customers: state.customers,
    invoices: state.invoices,
    exported_at: new Date().toISOString()
  });

  const file = new Blob([backupData], { type: 'application/json' });
  const metadata = {
    name: `pos_backup_${new Date().toISOString().slice(0, 10)}.json`,
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  });

  if (res.ok) {
    alert('Sao lưu lên Google Drive thành công!');
  } else {
    alert('Sao lưu thất bại!');
  }
}
