// ========== CART SYSTEM ==========

function addToCart(name, price) {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const existing = cart.find(item => item.name === name);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price, qty: 1 });
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  alert(`${name} added to cart`);
}

function loadCart() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const container = document.getElementById('cart-items');
  const totalDisplay = document.getElementById('total');
  if (!container || !totalDisplay) return;

  container.innerHTML = '';
  let total = 0;

  cart.forEach((item, index) => {
    const subtotal = item.price * item.qty;
    total += subtotal;
    container.innerHTML += `
      <div>
        <strong>${item.name}</strong> - ₾${item.price.toFixed(2)} x ${item.qty} = ₾${subtotal.toFixed(2)}
        <button onclick="removeItem(${index})">Remove</button>
      </div>
    `;
  });

  totalDisplay.textContent = `Total: ₾${total.toFixed(2)}`;
}

function removeItem(index) {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  cart.splice(index, 1);
  localStorage.setItem('cart', JSON.stringify(cart));
  loadCart();
}

// ========== CHECKOUT SUMMARY ==========

function loadSummary() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const summary = document.getElementById('summary');
  if (!summary) return;

  let total = 0;
  summary.innerHTML = '';

  cart.forEach(item => {
    const subtotal = item.price * item.qty;
    total += subtotal;
    summary.innerHTML += `<p>${item.name} x ${item.qty} = ₾${subtotal.toFixed(2)}</p>`;
  });

  summary.innerHTML += `<strong>Total: ₾${total.toFixed(2)}</strong>`;
}

// ========== CHECKOUT FORM ==========

function checkout() {
  console.log('checkout() function called'); // check if function runs
  const form = document.getElementById('checkout-form');
  if (!form) {
    console.error('Checkout form not found!');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Checkout form submitted');

    const name = form.elements['dropoffName'].value.trim();
    const phone = form.elements['dropoffPhone'].value.trim();
    const address = form.elements['dropoffAddress'].value.trim();
    const paymentMethod = form.elements['payment_method'].value;
    const cart = JSON.parse(localStorage.getItem('cart')) || [];

    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }
    if (!name || !phone || !address) {
      alert("Please fill in all required fields.");
      return;
    }

    if (paymentMethod === 'bog') {
      const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
      const externalOrderId = 'order-' + Date.now();

      const dropoffLat = parseFloat(form.elements['dropoffLat'].value);
      const dropoffLng = parseFloat(form.elements['dropoffLng'].value);

      const orderData = {
        callback_url: 'https://0d663c4c9a13.ngrok-free.app/callback',
        external_order_id: externalOrderId,
        customer_info: { name, phone, address, lat: dropoffLat, lng: dropoffLng },
        purchase_units: {
          currency: 'GEL',
          total_amount: totalAmount,
          basket: cart.map(item => ({
            quantity: item.qty,
            unit_price: item.price,
            product_id: item.name
          }))
        },
        redirect_urls: {
          success: `http://localhost:3000/success?order_id=${externalOrderId}`,
          fail: `http://localhost:3000/fail?order_id=${externalOrderId}`
        }
      };



      try {
        const response = await fetch('http://localhost:3000/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'omit', // You can use 'include' if your server uses sessions & cookies
          body: JSON.stringify(orderData)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error('Server error:', errData);
          alert('Failed to create order. See console for details.');
          return;
        }

        const result = await response.json();

        if (result.redirectUrl) {
          localStorage.removeItem('cart');
          console.log("Result from server:", result);
          window.location.href = result.redirectUrl;
        } else {
          alert('Failed to create order');
        }
      } catch (error) {
        console.error('Fetch error:', error);
        alert('Error processing payment');
      }
    } else if (paymentMethod === 'tbc') {
      alert('TBC payment option coming soon!');
    } else {
      alert('Please select a payment method.');
    }
  });
}

// ========== ADMIN PANEL: LOAD ORDERS ==========

async function loadOrders() {
  const container = document.getElementById('orders');
  if (!container) return;

  try {
    const response = await fetch('http://localhost:3000/admin/orders', {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch orders');

    const orders = await response.json();

    if (orders.length === 0) {
      container.innerHTML = "<p>No orders yet.</p>";
      return;
    }

    container.innerHTML = '';

    orders.forEach(order => {
      // Defensive check for purchase_units array & basket array:
      const basket = (order.purchase_units && order.purchase_units[0] && order.purchase_units[0].basket) || [];

      const div = document.createElement('div');
      div.classList.add('order');
      div.innerHTML = `
        <h3>${order.customer_info.name} (${order.customer_info.phone})</h3>
        <p><strong>Address:</strong> ${order.customer_info.address}</p>
        <p><strong>Date:</strong> ${order.created_at}</p>
        <p><strong>Status:</strong> ${order.status}</p>
        <ul>
          ${basket.map(item => `<li>${item.product_id} x ${item.quantity} — ₾${item.unit_price.toFixed(2)}</li>`).join('')}
        </ul>
        <hr>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Failed to load orders", err);
    container.innerHTML = "<p>Error loading orders.</p>";
  }
}

// ========== DYNAMIC PRODUCT LOADING ==========

async function loadProducts() {
  try {
    const res = await fetch('http://localhost:3000/products');
    if (!res.ok) {
      const container = document.getElementById('productList');
      if (container) container.innerHTML = '<p>Failed to load products.</p>';
      return;
    }
    const products = await res.json();
    const container = document.getElementById('productList');
    if (!container) return;

    container.innerHTML = '';

    products.forEach(product => {
      const div = document.createElement('div');
      div.classList.add('product');
      div.innerHTML = `
        <img src="${product.image}" alt="${product.name}" width="150" />
        <h3>${product.name}</h3>
        <p>₾${product.price.toFixed(2)} / kg</p>
        <button onclick="addToCart('${product.name}', ${product.price})">Add to Cart</button>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Error loading products:', err);
    const container = document.getElementById('productList');
    if (container) container.innerHTML = '<p>Error loading products.</p>';
  }
}

// ========== PAGE LOAD LOGIC ==========

window.onload = () => {
  loadCart();
  loadSummary();
  checkout();
  loadOrders(); // For admin.html only, will silently do nothing if no container
  loadProducts(); // For products.html only, will silently do nothing if no container
};
