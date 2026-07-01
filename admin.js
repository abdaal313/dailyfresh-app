// Helper to get headers with the token
const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
});

// Helper for JSON requests
const getJSONHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
});

// --- 1. AUTHENTICATION CHECK ---
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        console.warn('❌ No adminToken found, redirecting to login...');
        window.location.href = 'login.html';
        return;
    }
    loadAdminData();
});

// --- 2. LOGOUT FUNCTION ---
window.logout = function() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    }
};

// --- 3. LOAD ALL ADMIN DATA ---
async function loadAdminData() {
    try {
        const [resData, resBiz] = await Promise.all([
            fetch('/api/admin/data', { headers: getHeaders() }),
            fetch('/api/businesses', { headers: getHeaders() })
        ]);

        if (resData.status === 401 || resBiz.status === 401) {
            console.error('Unauthorized - token invalid or expired');
            localStorage.removeItem('adminToken');
            window.location.href = 'login.html';
            return;
        }

        if (!resData.ok || !resBiz.ok) {
            console.error('Server error loading admin data:', resData.status, resBiz.status);
            return;
        }

        const data = await resData.json();
        const businesses = await resBiz.json();

        // Update Stats
        const totalRevenue = data.orders?.reduce((sum, o) => sum + parseFloat(o.total || 0), 0) || 0;
        if (document.getElementById('stat-orders')) document.getElementById('stat-orders').innerText = data.orders?.length || 0;
        if (document.getElementById('stat-revenue')) document.getElementById('stat-revenue').innerText = '₹' + totalRevenue.toFixed(2);
        if (document.getElementById('stat-subs')) document.getElementById('stat-subs').innerText = data.subs?.length || 0;

        renderOrderTable(data.orders || []);
        renderMenuTable(data.menu || []);
        renderEmployeeTable(data.employees || []);
        renderBusinessTable(businesses || []);
    } catch (err) {
        console.error('❌ Dashboard load error:', err);
    }
}

// --- 4. RENDER TABLES ---
function renderOrderTable(orders) {
    const table = document.getElementById('order-table');
    if (!table) return;
    table.innerHTML = '<tr><th>ID</th><th>Customer</th><th>Phone</th><th>Total</th><th>Status</th><th>Action</th></tr>';
    orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>#${order.id}</td><td>${order.customer_name}</td><td>${order.phone}</td>
                         <td>₹${parseFloat(order.total).toFixed(2)}</td>
                         <td><span class="status-badge">${order.status}</span></td>
                         <td>${order.status === 'Pending' ? `<button onclick="confirmOrder(${order.id})">✓ Confirm</button>` : '✅'}</td>`;
        table.appendChild(row);
    });
}

function renderMenuTable(menu) {
    const table = document.getElementById('menu-table');
    if (!table) return;
    table.innerHTML = '<tr><th>Item</th><th>Price</th><th>Action</th></tr>';
    menu.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.name}</td><td>₹${parseFloat(item.price).toFixed(2)}</td>
                         <td><button onclick="deleteProduct(${item.id})">🗑️ Delete</button></td>`;
        table.appendChild(row);
    });
}

function renderEmployeeTable(employees) {
    const table = document.getElementById('employee-table');
    if (!table) return;
    table.innerHTML = '<tr><th>Name</th><th>Role</th><th>Action</th></tr>';
    employees.forEach(emp => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${emp.name}</td><td>${emp.role}</td>
                         <td><button onclick="deleteEmployee(${emp.id})">🗑️ Remove</button></td>`;
        table.appendChild(row);
    });
}

function renderBusinessTable(businesses) {
    const table = document.getElementById('business-table');
    if (!table) return;
    table.innerHTML = '<tr><th>Shop</th><th>Owner</th><th>Action</th></tr>';
    businesses.forEach(biz => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${biz.shop_name}</td><td>${biz.owner_name}</td>
                         <td><button onclick="deleteBusiness(${biz.id})">🗑️ Remove</button></td>`;
        table.appendChild(row);
    });
}

// --- 5. ACTION FUNCTIONS ---

window.confirmOrder = async (id) => {
    const res = await fetch('/api/confirm-order', {
        method: 'POST', headers: getJSONHeaders(),
        body: JSON.stringify({ orderId: id })
    });
    if (res.ok) loadAdminData();
    else console.error('Failed to confirm order:', res.status);
};

window.deleteProduct = async (id) => {
    const res = await fetch(`/api/admin/delete-product/${id}`, { method: 'DELETE', headers: getHeaders() });
    if (res.ok) loadAdminData();
    else console.error('Failed to delete product:', res.status);
};

window.deleteEmployee = async (id) => {
    const res = await fetch(`/api/admin/delete-employee/${id}`, { method: 'DELETE', headers: getHeaders() });
    if (res.ok) loadAdminData();
    else console.error('Failed to delete employee:', res.status);
};

window.deleteBusiness = async (id) => {
    const res = await fetch(`/api/admin/delete-business/${id}`, { method: 'DELETE', headers: getHeaders() });
    if (res.ok) loadAdminData();
    else console.error('Failed to delete business:', res.status);
};

window.addProduct = async () => {
    const fd = new FormData();
    fd.append('name', document.getElementById('p-name').value);
    fd.append('price', document.getElementById('p-price').value);
    if (document.getElementById('p-image').files[0]) fd.append('image', document.getElementById('p-image').files[0]);
    const res = await fetch('/api/admin/add-product', { method: 'POST', headers: getHeaders(), body: fd });
    if (res.ok) loadAdminData();
    else console.error('Failed to add product:', res.status);
};

// ADDED: this was missing — needed if your HTML has an "Add Employee" button
window.addEmployee = async () => {
    const name = document.getElementById('e-name')?.value.trim();
    const role = document.getElementById('e-role')?.value.trim();
    const email = document.getElementById('e-email')?.value.trim();
    const salary = document.getElementById('e-salary')?.value.trim();

    if (!name || !role) {
        console.error('Name and role are required');
        return;
    }

    const res = await fetch('/api/admin/add-employee', {
        method: 'POST',
        headers: getJSONHeaders(),
        body: JSON.stringify({
            name,
            role,
            email: email || null,
            salary: salary ? parseFloat(salary) : 0
        })
    });

    if (res.ok) {
        if (document.getElementById('e-name')) document.getElementById('e-name').value = '';
        if (document.getElementById('e-role')) document.getElementById('e-role').value = '';
        if (document.getElementById('e-email')) document.getElementById('e-email').value = '';
        if (document.getElementById('e-salary')) document.getElementById('e-salary').value = '';
        loadAdminData();
    } else {
        console.error('Failed to add employee:', res.status);
    }
};