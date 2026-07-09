const http = require('http');

async function request(method, path, data = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk.toString());
      res.on('end', () => {
        let setCookie = res.headers['set-cookie'] || [];
        resolve({
          status: res.statusCode,
          headers: res.headers,
          cookie: setCookie[0] || cookie,
          data: body ? JSON.parse(body) : null
        });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- 1. Testing Auth Flow ---');
  // Login as admin
  let res = await request('POST', '/api/auth/login', {
    email: 'admin@emart.com',
    password: 'admin123'
  });
  console.log('Admin Login:', res.status, res.data.message);
  const adminCookie = res.cookie;

  // Login as shopkeeper
  let resShop = await request('POST', '/api/auth/login', {
    email: 'shopkeeper@emart.com',
    password: 'admin123'
  });
  console.log('Shopkeeper Login:', resShop.status, resShop.data.message);
  const shopCookie = resShop.cookie;

  // Session Check
  let resSession = await request('GET', '/api/auth/me', null, adminCookie);
  console.log('Session Check Admin:', resSession.status, resSession.data.role);

  let resShopUsers = await request('GET', '/api/users', null, shopCookie);
  console.log('Shopkeeper Admin API Block:', resShopUsers.status, resShopUsers.data.message);

  console.log('\n--- 2. Testing Inventory CRUD ---');
  // Add product
  let newProduct = {
    name: 'Test Product',
    sku: 'TST-' + Date.now(),
    category_id: 1,
    purchase_price: 10,
    selling_price: 20,
    quantity: 50,
    supplier_id: 1
  };
  let resAdd = await request('POST', '/api/products', newProduct, adminCookie);
  console.log('Add Product:', resAdd.status, resAdd.data.message);
  const productId = resAdd.data.productId;

  // Get products to verify
  let resGet = await request('GET', '/api/products', null, adminCookie);
  let found = resGet.data.products.find(p => p.id === productId);
  console.log('Product exists in DB:', !!found);

  console.log('\n--- 3. Testing POS Sales Flow ---');
  // POS Checkout
  let checkoutData = {
    customer_id: 1, // walk-in
    items: [
      { id: productId, quantity: 5 }
    ],
    discount: 0,
    tax: 0,
    payment_method: 'cash'
  };
  let resCheckout = await request('POST', '/api/pos/checkout', checkoutData, shopCookie);
  console.log('POS Checkout:', resCheckout.status, resCheckout.data.message);
  const invoiceNumber = resCheckout.data.invoiceNumber;

  // Check Inventory after checkout
  let resGetAfter = await request('GET', '/api/products', null, adminCookie);
  let foundAfter = resGetAfter.data.products.find(p => p.id === productId);
  console.log('Product quantity after sale:', foundAfter.quantity, '(Expected: 45)');

  // Print Invoice
  let resInvoice = await request('GET', `/api/pos/invoice/${invoiceNumber}`, null, shopCookie);
  console.log('Invoice retrieve:', resInvoice.status, resInvoice.data.sale.invoice_number);

  console.log('\n--- Cleanup ---');
  let resDel = await request('DELETE', `/api/products/${productId}`, null, adminCookie);
  console.log('Delete Product:', resDel.status, resDel.data.message);
}

runTests().catch(console.error);
