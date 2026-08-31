// --- KHỞI TẠO BIẾN TOÀN CỤC ---
let products = [];
let customers = [];
let cart = [];

// Đường dẫn Supabase (Thay bằng URL & KEY thực tế của ông nếu có)
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_KEY';
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCustomers();
});

// --- LẤY DANH SÁCH SẢN PHẨM ---
async function loadProducts() {
    if (db) {
        const { data, error } = await db.from('Products').select('*');
        if (!error && data) {
            products = data;
        } else {
            console.warn("Chưa kết nối Supabase hoặc lỗi fetch, dùng dữ liệu mẫu.");
            useSampleProducts();
        }
    } else {
        useSampleProducts();
    }
    renderPosProducts();
    renderProductTable();
}

function useSampleProducts() {
    products = [
        { id: 1, name: 'Máy đo huyết áp OMRON', unit: 'Cái', price: 1500000 },
        { id: 2, name: 'Khẩu trang y tế 4 lớp', unit: 'Hộp', price: 35000 },
        { id: 3, name: 'Nước rửa tay khô 500ml', unit: 'Chai', price: 65000 }
    ];
}

// --- HIỂN THỊ SẢN PHẨM Ở TAB BÁN HÀNG (POS) ---
function renderPosProducts() {
    const grid = document.getElementById('pos-product-grid');
    if (!grid) return;

    const query = (document.getElementById('pos-search')?.value || '').toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(query));

    grid.innerHTML = filtered.map(p => `
        <div onclick="addToCart(${p.id})" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md cursor-pointer transition flex flex-col justify-between hover:border-indigo-500">
            <div>
                <h4 class="font-bold text-gray-800 text-sm line-clamp-2">${p.name}</h4>
                <p class="text-xs text-gray-400 mt-1">ĐVT: ${p.unit || 'Cái'}</p>
            </div>
            <div class="mt-3 flex justify-between items-center">
                <span class="text-indigo-600 font-bold text-sm">${Number(p.price).toLocaleString('vi-VN')} ₫</span>
                <button class="bg-indigo-50 text-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-600 hover:text-white transition">
                    <i class="fa-solid fa-plus text-xs"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// --- QUẢN LÝ GIỎ HÀNG ---
function addToCart(productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const itemInCart = cart.find(item => item.id === productId);
    if (itemInCart) {
        itemInCart.quantity += 1;
    } else {
        cart.push({ ...prod, quantity: 1 });
    }
    renderCart();
}

function updateCartQuantity(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== productId);
    }
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(i => i.id !== productId);
    renderCart();
}

function renderCart() {
    const cartContainer = document.getElementById('cart-items');
    const cartCountEl = document.getElementById('cart-count');
    const cartTotalEl = document.getElementById('cart-total');

    if (!cartContainer) return;

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p class="text-center text-gray-400 py-8">Chưa có sản phẩm nào trong giỏ</p>';
        if (cartCountEl) cartCountEl.innerText = '0 món';
        if (cartTotalEl) cartTotalEl.innerText = '0 ₫';
        return;
    }

    let total = 0;
    let totalItems = 0;

    cartContainer.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        totalItems += item.quantity;

        return `
            <div class="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div class="flex-1 pr-2">
                    <h5 class="font-semibold text-xs text-gray-800 line-clamp-1">${item.name}</h5>
                    <span class="text-xs text-indigo-600 font-bold">${Number(item.price).toLocaleString('vi-VN')} ₫</span>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="updateCartQuantity(${item.id}, -1)" class="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100">-</button>
                    <span class="text-xs font-bold w-4 text-center">${item.quantity}</span>
                    <button onclick="updateCartQuantity(${item.id}, 1)" class="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100">+</button>
                    <button onclick="removeFromCart(${item.id})" class="text-red-400 hover:text-red-600 ml-1 text-xs"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');

    if (cartCountEl) cartCountEl.innerText = `${totalItems} món`;
    if (cartTotalEl) cartTotalEl.innerText = `${total.toLocaleString('vi-VN')} ₫`;
}

// --- THANH TOÁN & IN HÓA ĐƠN ---
function checkout() {
    if (cart.length === 0) {
        alert("Giỏ hàng đang trống! Vui lòng chọn sản phẩm trước.");
        return;
    }

    const customerSelect = document.getElementById('cart-customer');
    const customerName = customerSelect ? (customerSelect.options[customerSelect.selectedIndex]?.text || "Khách Vãng Lai") : "Khách Vãng Lai";
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Tạo hóa đơn in K80
    const printArea = document.getElementById('print-area');
    if (printArea) {
        printArea.innerHTML = `
            <div class="title">HÓA ĐƠN BÁN HÀNG</div>
            <p style="text-align: center; margin-bottom: 10px;">Ngày: ${new Date().toLocaleString('vi-VN')}</p>
            <p><strong>Khách hàng:</strong> ${customerName}</p>
            <hr style="border-top: 1px dashed #000; margin: 8px 0;">
            <table>
                <thead>
                    <tr>
                        <th style="text-align: left;">Món</th>
                        <th style="text-align: center;">SL</th>
                        <th style="text-align: right;">Tiền</th>
                    </tr>
                </thead>
                <tbody>
                    ${cart.map(i => `
                        <tr>
                            <td>${i.name}</td>
                            <td style="text-align: center;">${i.quantity}</td>
                            <td style="text-align: right;">${(i.price * i.quantity).toLocaleString('vi-VN')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <hr style="border-top: 1px dashed #000; margin: 8px 0;">
            <div class="total" style="display: flex; justify-between: space-between;">
                <span>TỔNG TIỀN:</span>
                <span>${totalAmount.toLocaleString('vi-VN')} ₫</span>
            </div>
            <p style="text-align: center; margin-top: 15px; font-size: 13px;">Cảm ơn quý khách & Hẹn gặp lại!</p>
        `;
    }

    window.print();

    // Reset giỏ hàng sau khi thanh toán
    cart = [];
    renderCart();
}

// --- BẢNG SẢN PHẨM & KHÁCH HÀNG ---
function renderProductTable() {
    const tbody = document.getElementById('product-table-body');
    if (!tbody) return;

    tbody.innerHTML = products.map(p => `
        <tr>
            <td class="p-4 font-medium text-gray-800">${p.name}</td>
            <td class="p-4 text-gray-500">${p.unit || 'Cái'}</td>
            <td class="p-4 font-bold text-indigo-600">${Number(p.price).toLocaleString('vi-VN')} ₫</td>
            <td class="p-4 text-right">
                <button onclick="deleteProduct(${p.id})" class="text-red-500 hover:text-red-700 text-xs font-semibold">Xóa</button>
            </td>
        </tr>
    `).join('');
}

async function saveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('prod-name').value;
    const unit = document.getElementById('prod-unit').value;
    const price = Number(document.getElementById('prod-price').value);

    const newProd = { id: Date.now(), name, unit, price };

    if (db) {
        const { data, error } = await db.from('Products').insert([{ name, unit, price }]);
        if (error) {
            alert("Lỗi thêm sản phẩm: " + error.message);
            return;
        }
    }

    products.push(newProd);
    renderPosProducts();
    renderProductTable();
    toggleProductModal(false);
    e.target.reset();
}

async function deleteProduct(id) {
    if (!confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;

    if (db) {
        await db.from('Products').delete().eq('id', id);
    }
    products = products.filter(p => p.id !== id);
    renderPosProducts();
    renderProductTable();
}

function loadCustomers() {
    customers = [
        { id: 1, name: 'Nguyễn Văn A', phone: '0901234567' },
        { id: 2, name: 'Trần Thị B', phone: '0987654321' }
    ];
    renderCustomerSelect();
}

function renderCustomerSelect() {
    const select = document.getElementById('cart-customer');
    if (!select) return;

    select.innerHTML = '<option value="">Khách Vãng Lai</option>' + 
        customers.map(c => `<option value="${c.id}">${c.name} - ${c.phone}</option>`).join('');
}
