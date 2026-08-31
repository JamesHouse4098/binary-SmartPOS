// 1. Khởi tạo Supabase Client (Dùng URL và Anon Key từ Supabase Dashboard)
const SUPABASE_URL = 'https://relogavxtjjbfciifuel.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbG9nYXZ4dGpqYmZjaWlmdWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDI3MDYsImV4cCI6MjEwMzcxODcwNn0.RaRNG00RYPpU4JqixjR0d7vpw0Al8JUwJXslIDfh41Y'; // Thay Anon Key của bro vào đây
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Hàm lấy danh sách sản phẩm (đồng bộ 100% với WPF)
async function loadProducts() {
    const { data, error } = await supabase
        .from('Products')
        .select('Name, Unit, Price');

    if (error) {
        console.error('Lỗi tải dữ liệu:', error.message);
        return;
    }

    console.log('Danh sách sản phẩm:', data);
    // Code render UI danh sách sản phẩm lên HTML của bro ở đây...
}

// 3. Gọi hàm khi trang web load xong
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
});
