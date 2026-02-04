const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');

const app = express();
const allowedOrigin = 'http://localhost:5500';

// QuickShipper API token (replace with your actual token)
const QUICKSHIPPER_API_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjAyMzk0QTQxOURFM0Q4RDQxMUFBQ0I4M0Q5NzRFRENEIiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3NTQzMzM5ODQsImV4cCI6MjA2OTY5Mzk4NCwiaXNzIjoiaHR0cHM6Ly90ZXN0LWF1dGgucXVpY2tzaGlwcGVyLmdlLyIsImF1ZCI6IkRlbGl2ZXJ5QXBpIiwiY2xpZW50X2lkIjoiRGVsaXZlcnlBcGlDbGllbnQiLCJzdWIiOiIxODk1IiwiYXV0aF90aW1lIjoxNzU0MzMzOTg0LCJpZHAiOiJsb2NhbCIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6Ik93bmVyIiwiVXNlclBlcm1pc3Npb25zIjoiTm9uZSxDb21wYW55RWRpdCxPcmRlcnNDUlVELFVzZXJDUlVELE93bmVyQ1JVRCIsIlVzZXJSb2xlcyI6Ik93bmVyIiwiU2hvcCI6IjEwMzIiLCJTaG9wT2Zmc2V0IjoiNCIsImp0aSI6IjA3MUFBQ0U1RjREQkQyMjk3OUEyQzM4MTE5RDZBMTc5IiwiaWF0IjoxNzU0MzMzOTg0LCJzY29wZSI6WyJEZWxpdmVyeUFwaSJdLCJhbXIiOlsicHdkIl19.E-kcao5X3BxzSoCYILfh9pdWsa2aueDk0l9jvbZk4zl2FgGbcNUC6gNaVHiiSIRezbguwgBAP3ZyTjWmJpznee2vXuZIrR6rspqSx-2k7T-aEFtA3Kn7LKUAYZGw7vjFKfnrBiRxNQaJDymr8tNYoUwJzKfG3LO_LKo_q1jvT1h4qmXd983r7kNTwE_0AVZAoK8qv5E5RomwTvCHU2PtTxLU5Q8zCs5LOFgYFYexEvjueBUDoSypc4_uEMnSWwWe8dwmTL5ZPHcPFIqK0gMB1St95PWq42wWh7tKPflqW9KbMEj_r1Ra7yMpL7AHKP6FSK0-3ePLZ5LuAmeO4tPR4w';

// Middleware
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));
app.use(bodyParser.json());

app.use(session({
  secret: 'your-super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Your existing constants
const clientId = '68586';
const clientSecret = 'X7Uo7c8V8fPs';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

// --- Products & Orders loading/saving logic (unchanged) ---
const productsFilePath = path.join(__dirname, 'public', 'products.json');
let products = [];
try {
  if (fs.existsSync(productsFilePath)) {
    const data = fs.readFileSync(productsFilePath, 'utf-8');
    products = JSON.parse(data);
  }
} catch (err) {
  console.error('Failed to load products.json:', err);
}
function saveProducts() {
  fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
}

const ordersFilePath = path.join(__dirname, 'orders.json');
let orders = [];
try {
  if (fs.existsSync(ordersFilePath)) {
    const data = fs.readFileSync(ordersFilePath, 'utf-8');
    orders = JSON.parse(data);
  }
} catch (err) {
  console.error('Failed to load orders.json:', err);
}
function saveOrders() {
  fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2));
}

// --- Admin Auth routes (unchanged) ---
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});
app.get('/admin/check-auth', (req, res) => {
  if (req.session.authenticated) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});
app.post('/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// --- BOG Payment routes (unchanged) ---
async function getAccessToken() {
  const tokenUrl = 'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token';
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await axios.post(tokenUrl, 'grant_type=client_credentials', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
    });

    console.log("✅ Got access token from BOG:", response.data.access_token);
    return response.data.access_token;
  } catch (err) {
    console.error("❌ Error getting access token:", err.response?.data || err.message);
    throw new Error('Failed to get BOG access token');
  }
}

async function createOrder(accessToken, orderData) {
  const orderUrl = 'https://api.bog.ge/payments/v1/ecommerce/orders';
  const response = await axios.post(orderUrl, orderData, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  return {
    redirectUrl: response.data._links.redirect.href,
    orderId: orderData.external_order_id
  };
}
app.post('/create-order', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const orderData = req.body;

    console.log('Creating order with data:', JSON.stringify(orderData, null, 2));

    const order = await createOrder(accessToken, orderData);

    // Save order including lat/lng
    const newOrder = {
      external_order_id: order.orderId,
      customer_info: {
        ...orderData.customer_info,
        lat: parseFloat(orderData.customer_info.lat),
        lng: parseFloat(orderData.customer_info.lng)
      },
      purchase_units: orderData.purchase_units,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    orders.push(newOrder);
    saveOrders();

    res.json({ redirectUrl: order.redirectUrl });

  } catch (error) {
    console.error("❌ Full BOG error:", error?.response?.data || error.message);
    res.status(error?.response?.status || 500).json({
      error: 'Error creating order',
      details: error?.response?.data || error.message
    });
  }
});


app.get('/success', async (req, res) => {
  const orderId = req.query.order_id || req.query.external_order_id;
  const order = orders.find(o => o.external_order_id === orderId);

  if (!order) return res.status(404).send('Order not found');

  order.status = 'paid';

  // QuickShipper delivery data
  const data = {
    carDelivery: false,
    comment: "From web payment success callback",
    scheduledTime: order.purchase_units[0]?.scheduledTime || new Date().toISOString(),
    dropOffInfo: {
      address: order.customer_info.address,
      longitude: order.customer_info.lng,
      latitude: order.customer_info.lat,
      addressComment: "Web user",
      name: order.customer_info.name,
      phonePrefix: "+995",
      phone: order.customer_info.phone,
      city: "Tbilisi",
      country: "GE"
    },
    pickUpInfo: {
      address: "8 Mtskheta Street, Tbilisi",
      longitude: 44.772855614561635,
      latitude: 41.70637995679531,
      addressComment: "Fixed pickup location",
      name: "Store Warehouse",
      phonePrefix: "+995",
      phone: "598433775",
      city: "Tbilisi",
      country: "GE"
    },
    provider: {
      providerId: 2,
      providerFeeId: "asap",
      deliverySpeedId: 0,
      preparationTime: 0
    },
    autoAssign: true,
    dropThePin: true,
    cashOnDelivery: {
      deliveryPrice: 0,
      parcelPrice: 0
    }
  };

  try {
    // Create QuickShipper order
    const createResponse = await axios.post(
      'https://delivery-test.quickshipper.ge/v1/Order',
      data,
      {
        headers: {
          'accept': 'text/plain',
          'Authorization': `Bearer ${QUICKSHIPPER_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const orderIdQS = createResponse.data.orderId || createResponse.data.OrderId;
    if (!orderIdQS) return res.status(500).send('QuickShipper order ID missing');

    // Confirm QuickShipper order
    await axios.post(
      'https://delivery-test.quickshipper.ge/v1/Order/confirm',
      { orderId: orderIdQS, apiKey: QUICKSHIPPER_API_TOKEN },
      {
        headers: {
          'accept': 'text/plain',
          'Authorization': `Bearer ${QUICKSHIPPER_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Save delivery info
    order.deliveryOrderId = orderIdQS;
    order.deliveryStatus = 'created';
    saveOrders();

    res.send('✅ Payment successful and delivery order created! You may close this window.');

  } catch (err) {
    console.error('QuickShipper order creation failed:', err.response?.data || err.message);
    res.send('✅ Payment successful, but delivery order creation failed. Please contact support.');
  }
});


app.get('/fail', (req, res) => {
  const orderId = req.query.order_id || req.query.external_order_id;
  const order = orders.find(o => o.external_order_id === orderId);
  if (order) {
    order.status = 'failed';
    saveOrders();
  }
  res.send('❌ Payment failed. Please try again.');
});

// --- Admin: Orders and Products API (unchanged) ---
app.get('/admin/orders', (req, res) => {
  if (!req.session.authenticated) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  res.json(orders);
});
app.get('/admin/products', (req, res) => {
  if (!req.session.authenticated) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  res.json(products);
});

// --- Upload products Excel (unchanged) ---
const upload = multer({ dest: 'uploads/' });

app.post('/admin/upload-products', upload.single('file'), (req, res) => {
  if (!req.session.authenticated) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    products = data.map(row => ({
      id: String(row.id),
      name: String(row.name),
      price: Number(row.price),
      image: String(row.image)
    }));

    saveProducts();
    res.json({ success: true, count: products.length });
  } catch (err) {
    console.error('Failed to parse Excel:', err);
    res.status(500).json({ error: 'Failed to process Excel file' });
  }
});

app.get('/admin/download-products', (req, res) => {
  if (!req.session.authenticated) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const ws = xlsx.utils.json_to_sheet(products);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Products');

  const filePath = path.join(__dirname, 'downloads', 'products_export.xlsx');
  if (!fs.existsSync(path.join(__dirname, 'downloads'))) {
    fs.mkdirSync(path.join(__dirname, 'downloads'));
  }

  xlsx.writeFile(wb, filePath);
  res.download(filePath, 'products.xlsx', (err) => {
    if (err) console.error('Download error:', err);
  });
});

// --- Public products endpoint ---
app.get('/products', (req, res) => {
  res.json(products);
});


// ======== HERE STARTS THE NEW QUICKSHIPPER INTEGRATION ========

// POST /api/delivery-fee - get delivery fee estimate from QuickShipper
app.post('/api/delivery-fee', async (req, res) => {
  const { dropoffAddress, dropoffLat, dropoffLng } = req.body;

  if (!dropoffAddress || !dropoffLat || !dropoffLng) {
    return res.status(400).json({ error: 'Missing dropoff address or coordinates' });
  }

  const dropoffStreetName = dropoffAddress.split(',')[0].trim();

  const params = new URLSearchParams({
    FromStreetName: "8 Mtskheta Street",
    FromCityName: "Tbilisi",
    FromLatitude: "41.70637995679531",
    FromLongitude: "44.772855614561635",
    ToStreetName: dropoffStreetName,
    ToCityName: "Tbilisi",
    ToLatitude: dropoffLat.toString(),
    ToLongitude: dropoffLng.toString()
  });

  try {
    console.log('Requesting delivery fee with:', params.toString());
    const response = await axios.get(`https://delivery-test.quickshipper.ge/v1/Order/fees?${params.toString()}`, {
      headers: {
        'accept': 'text/plain',
        'Authorization': `Bearer ${QUICKSHIPPER_API_TOKEN}`
      }
    });

    const cheapest = response.data?.fees?.[0]?.prices?.[0]?.amount ?? null;
    res.json({ fee: cheapest });

  } catch (error) {
    console.error('Fee check failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch delivery fee.' });
  }
});

// POST /api/order - create & confirm delivery order with QuickShipper
app.post('/api/order', async (req, res) => {
  const {
    dropoffName,
    dropoffAddress,
    dropoffPhone,
    dropoffLat,
    dropoffLng,
    scheduledTime
  } = req.body;

  if (!dropoffName || !dropoffAddress || !dropoffPhone || !dropoffLat || !dropoffLng) {
    return res.status(400).json({ error: 'Missing delivery order parameters' });
  }

  const data = {
    carDelivery: false,
    comment: "From web form",
    scheduledTime,
    dropOffInfo: {
      address: dropoffAddress,
      longitude: parseFloat(dropoffLng),
      latitude: parseFloat(dropoffLat),
      addressComment: "Web user",
      name: dropoffName,
      phonePrefix: "+995",
      phone: dropoffPhone,
      city: "Tbilisi",
      country: "GE"
    },
    pickUpInfo: {
      address: "8 Mtskheta Street, Tbilisi",
      longitude: 44.772855614561635,
      latitude: 41.70637995679531,
      addressComment: "Fixed pickup location",
      name: "Store Warehouse",
      phonePrefix: "+995",
      phone: "598433775",
      city: "Tbilisi",
      country: "GE"
    },
    provider: {
      providerId: 2,
      providerFeeId: "asap",
      deliverySpeedId: 0,
      preparationTime: 0
    },
    autoAssign: true,
    dropThePin: true,
    cashOnDelivery: {
      deliveryPrice: 0,
      parcelPrice: 0
    }
  };

  try {
    // Step 1: Create order
    const createResponse = await axios.post('https://delivery-test.quickshipper.ge/v1/Order', data, {
      headers: {
        'accept': 'text/plain',
        'Authorization': `Bearer ${QUICKSHIPPER_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('QuickShipper Create Order Response:', createResponse.data);

    const orderId = createResponse.data.orderId || createResponse.data.OrderId;

    if (!orderId) {
      return res.status(500).json({ success: false, error: 'Order ID not returned from create order.' });
    }

    // Step 2: Confirm order
    const confirmResponse = await axios.post('https://delivery-test.quickshipper.ge/v1/Order/confirm', {
      orderId,
      apiKey: QUICKSHIPPER_API_TOKEN
    }, {
      headers: {
        'accept': 'text/plain',
        'Authorization': `Bearer ${QUICKSHIPPER_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('QuickShipper Confirm Order Response:', confirmResponse.data);

    // Save delivery info to your orders here if needed:
    // e.g., find order by some ID or create a new record.

    // Respond back to frontend with both API responses
    res.json({
      success: true,
      createOrderResponse: createResponse.data,
      confirmOrderResponse: confirmResponse.data
    });

  } catch (err) {
    console.error('Error calling QuickShipper API:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});

// ======= End of QuickShipper integration =======


// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

// Warm up BOG token on server start
(async () => {
  try {
    const token = await getAccessToken();
    console.log("🔥 BOG access token warmed up:", token.slice(0, 10) + '...');
  } catch (err) {
    console.error("🚨 BOG token warm-up failed:", err.message);
  }
})();
