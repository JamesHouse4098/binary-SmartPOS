// 1. Kiểm tra tránh khai báo trùng lặp Supabase Client
if (typeof supabaseClient === 'undefined') {
    const SUPABASE_URL = 'https://relogavxtjjbfciifuel.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbG9nYXZ4dGpqYmZjaWlmdWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDI3MDYsImV4cCI6MjEwMzcxODcwNn0.RaRNG00RYPpU4JqixjR0d7vpw0Al8JUwJXslIDfh41Y';
    var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Helper format tiền VND
const formatVND = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// 2. Hàm lấy và render Sản Phẩm từ Supabase
async function loadProducts() {
    const { data, error } = await supabaseClient
        .from('Products')
        .select('Name, Unit, Price');

    if (error) {
        console.error('Lỗi tải sản phẩm:', error.message);
        return;
    }

    console.log('Danh sách sản phẩm từ Supabase:', data);

    // Render bảng Quản Lý Sản Phẩm
    const productTableBody = document.getElementById('product-table-body');
    if (productTableBody) {
        productTableBody.innerHTML = data.map(p => `
            <tr>
                <td class="p-4 font-medium text-gray-900">${p.Name}</td>
                <td class="p-4 text-gray-500">${p.Unit || 'Cái'}</td>
                <td class="p-4 font-bold text-indigo-600">${formatVND(p.Price)}</td>
                <td class="p-4 text-right">
                    <button class="text-red-500 hover:text-red-700 font-semibold">Xóa</button>
                </td>
            </tr>
        `).join('');
    }

    // Render lưới sản phẩm bên màn hình POS Bán Hàng
    const posGrid = document.getElementById('pos-product-grid');
    if (posGrid) {
        posGrid.innerHTML = data.map(p => `
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer">
                <h4 class="font-bold text-gray-800">${p.Name}</h4>
                <p class="text-xs text-gray-400 mt-1">ĐVT: ${p.Unit || 'Cái'}</p>
                <div class="mt-3 flex items-center justify-between">
                    <span class="text-indigo-600 font-bold">${formatVND(p.Price)}</span>
                    <button class="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded-lg text-xs font-semibold transition">+ Thêm</button>
                </div>
            </div>
        `).join('');
    }
}

// 3. Hàm thêm Sản Phẩm mới đẩy trực tiếp lên Supabase (Đồng bộ với WPF)
async function saveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('prod-name').value;
    const unit = document.getElementById('prod-unit').value || 'Cái';
    const price = parseFloat(document.getElementById('prod-price').value);

    const { error } = await supabaseClient
        .from('Products')
        .insert([{ Name: name, Unit: unit, Price: price }]);

    if (error) {
        alert('Lỗi thêm sản phẩm: ' + error.message);
        return;
    }

    alert('Đã thêm sản phẩm thành công!');
    toggleProductModal(false);
    loadProducts(); // Reload lại danh sách ngay lập tức
}

// 4. Lấy danh sách Khách Hàng từ Supabase
async function loadCustomers() {
    const { data, error } = await supabaseClient
        .from('Customers')
        .select('FullName, Phone');

    if (error) {
        console.error('Lỗi tải khách hàng:', error.message);
        return;
    }

    const customerBody = document.getElementById('customer-table-body');
    if (customerBody) {
        customerBody.innerHTML = data.map(c => `
            <tr>
                <td class="p-4 font-medium text-gray-900">${c.FullName}</td>
                <td class="p-4 text-gray-500">${c.Phone}</td>
                <td class="p-4 text-right">
                    <button class="text-red-500 hover:text-red-700 font-semibold">Xóa</button>
                </td>
            </tr>
        `).join('');
    }
}

// 5. Khởi chạy khi DOM load xong
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCustomers();
});
