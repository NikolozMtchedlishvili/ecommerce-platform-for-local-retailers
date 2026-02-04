async function checkAuth() {
  try {
    const res = await fetch('http://localhost:3000/admin/check-auth', {
      credentials: 'include'
    });

    if (!res.ok) {
      window.location.href = 'login.html';
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = 'login.html';
  }
}

checkAuth(); // Run on page load to protect admin panel

async function logout() {
  await fetch('http://localhost:3000/admin/logout', {
    method: 'POST',
    credentials: 'include'
  });
  window.location.href = 'login.html';
}

let allOrders = [];

async function loadOrders() {
  const container = document.getElementById('orders');
  if (!container) return;

  try {
    const response = await fetch('http://localhost:3000/admin/orders', {
      credentials: 'include'
    });

    if (!response.ok) {
      container.innerHTML = "<p>Not authorized to view orders.</p>";
      return;
    }

    allOrders = await response.json();
    console.log('📦 Orders loaded:', allOrders);
    displayOrders();
  } catch (err) {
    console.error('❌ Error loading orders:', err);
    container.innerHTML = "<p>Error loading orders.</p>";
  }
}

function displayOrders() {
  const container = document.getElementById('orders');
  const filter = document.getElementById('filterStatus').value;
  const sort = document.getElementById('sortOrder').value;

  let filtered = [...allOrders];

  if (filter !== 'all') {
    filtered = filtered.filter(order => order.status === filter);
  }

  filtered.sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return sort === 'newest' ? dateB - dateA : dateA - dateB;
  });

  if (filtered.length === 0) {
    container.innerHTML = "<p>No matching orders.</p>";
    return;
  }

  container.innerHTML = '';

  filtered.forEach(order => {
    const div = document.createElement('div');
    div.classList.add('order');

    const customer = order.customer_info || {};

    div.innerHTML = `
      <h3>${customer.name || 'Unknown'} (${customer.phone || ''})</h3>
      <p><strong>Address:</strong> ${customer.address || 'N/A'}</p>
      <p><strong>Date:</strong> ${order.created_at}</p>
      <ul>
        ${order.purchase_units?.basket.map(item => `
          <li>${item.product_id} x ${item.quantity} — ₾${item.unit_price}</li>
        `).join('') || ''}
      </ul>
      <p><strong>Status:</strong> ${order.status}</p>
      <hr>
    `;
    container.appendChild(div);
  });
}

// Bind dropdowns
document.getElementById('filterStatus').addEventListener('change', displayOrders);
document.getElementById('sortOrder').addEventListener('change', displayOrders);

window.addEventListener('DOMContentLoaded', loadOrders);
