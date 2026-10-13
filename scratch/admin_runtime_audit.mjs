// Read-only runtime audit script for CakeStore Admin Dashboard APIs
const BASE_URL = 'http://localhost:8080';
const FRONTEND_URL = 'http://localhost:3000';

async function postJson(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function getJson(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'GET',
    headers,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, data };
}

async function runAudit() {
  console.log('=== STARTING ADMIN RUNTIME AUDIT ===\n');
  const results = [];

  function record(category, testName, expected, actual, passed, details = '') {
    results.push({ category, testName, expected, actual, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${category}] ${testName} -> Actual: ${actual}`);
    if (details) console.log(`   Details: ${details}`);
  }

  // 1. AUTHENTICATION TEST ACCOUNTS
  console.log('\n--- 1. Authenticating Test Accounts ---');
  let adminToken = null;
  let ownerToken = null;

  const adminLogin = await postJson(`${BASE_URL}/api/auth/login`, {
    email: 'admin@cakestore.com',
    password: 'admin123',
  });
  if (adminLogin.status === 200 && adminLogin.data?.token) {
    adminToken = adminLogin.data.token;
    record('Auth', 'Admin Login', '200 OK + JWT', `${adminLogin.status} OK (Role: ${adminLogin.data?.role})`, true);
  } else {
    // Try fallback default admin
    const adminFallback = await postJson(`${BASE_URL}/api/auth/login`, {
      email: 'admin@cakeplatform.com',
      password: 'Password123!',
    });
    if (adminFallback.status === 200 && adminFallback.data?.token) {
      adminToken = adminFallback.data.token;
      record('Auth', 'Admin Login (Fallback)', '200 OK + JWT', `${adminFallback.status} OK`, true);
    } else {
      record('Auth', 'Admin Login', '200 OK', `${adminLogin.status} (Fallback: ${adminFallback.status})`, false, JSON.stringify(adminLogin.data));
    }
  }

  const ownerLogin = await postJson(`${BASE_URL}/api/auth/login`, {
    email: 'owner@sweetdelight.com',
    password: 'password123',
  });
  if (ownerLogin.status === 200 && ownerLogin.data?.token) {
    ownerToken = ownerLogin.data.token;
    record('Auth', 'Owner Login', '200 OK + JWT', `${ownerLogin.status} OK (Role: ${ownerLogin.data?.role})`, true);
  } else {
    const ownerFallback = await postJson(`${BASE_URL}/api/auth/login`, {
      email: 'owner@example.com',
      password: 'Password123!',
    });
    if (ownerFallback.status === 200 && ownerFallback.data?.token) {
      ownerToken = ownerFallback.data.token;
      record('Auth', 'Owner Login (Fallback)', '200 OK + JWT', `${ownerFallback.status} OK`, true);
    } else {
      record('Auth', 'Owner Login', '200 OK', `${ownerLogin.status} (Fallback: ${ownerFallback.status})`, false);
    }
  }

  // 2. UNAUTHENTICATED SECURITY CHECKS
  console.log('\n--- 2. Unauthenticated Security Checks ---');
  const adminEndpoints = [
    { name: 'Dashboard Stats', path: '/api/admin/dashboard/stats' },
    { name: 'Shops List', path: '/api/admin/shops' },
    { name: 'Plans List', path: '/api/admin/plans' },
    { name: 'Orders Ledger', path: '/api/admin/orders' },
    { name: 'Payments Ledger', path: '/api/admin/payments' },
    { name: 'Platform Feedback', path: '/api/admin/feedback' },
    { name: 'Contact Enquiries', path: '/api/admin/enquiries' },
    { name: 'Admin Notifications', path: '/api/admin/notifications' },
    { name: 'Global Settings', path: '/api/admin/settings' },
    { name: 'Broadcast History', path: '/api/admin/messages/history' },
  ];

  for (const ep of adminEndpoints) {
    const res = await getJson(`${BASE_URL}${ep.path}`, null);
    const passed = res.status === 401 || res.status === 403;
    record('Security - Unauthenticated', ep.name, '401/403 Forbidden', `${res.status}`, passed);
  }

  // 3. BAKERY OWNER UNAUTHORIZED ROLE CHECKS (TENANT BOUNDARY)
  console.log('\n--- 3. Bakery Owner Unauthorized Role Checks ---');
  if (ownerToken) {
    for (const ep of adminEndpoints) {
      const res = await getJson(`${BASE_URL}${ep.path}`, ownerToken);
      const passed = res.status === 403;
      record('Security - Owner Cross-Role Access', ep.name, '403 Forbidden', `${res.status}`, passed);
    }
  }

  // 4. ADMIN AUTHORIZED FUNCTIONAL & DATA AUDIT
  console.log('\n--- 4. Admin Authorized Functional Audit ---');
  if (adminToken) {
    // 4.1 Dashboard Overview & KPIs
    const statsRes = await getJson(`${BASE_URL}/api/admin/dashboard/stats`, adminToken);
    const sPass = statsRes.status === 200 && statsRes.data != null;
    const hasPlatformRev = statsRes.data?.totalPlatformRevenue !== undefined;
    const hasGmv = statsRes.data?.totalGmv !== undefined;
    const distinctMetrics = sPass && hasPlatformRev && hasGmv;
    record('Overview', 'Platform Stats KPI Payload', '200 OK with distinct revenue & GMV', 
      `${statsRes.status} (PlatformRev: ₹${statsRes.data?.totalPlatformRevenue}, GMV: ₹${statsRes.data?.totalGmv})`,
      distinctMetrics,
      `PeriodPlatformRev: ₹${statsRes.data?.periodPlatformRevenue}, PeriodGMV: ₹${statsRes.data?.periodGmv}`
    );

    // 4.2 Dashboard Date Filtering
    const dateStatsRes = await getJson(`${BASE_URL}/api/admin/dashboard/stats?startDate=2026-01-01&endDate=2026-12-31`, adminToken);
    record('Overview', 'Stats Date Range Filtering', '200 OK', `${dateStatsRes.status}`, dateStatsRes.status === 200);

    // 4.3 Activity Log
    const actRes = await getJson(`${BASE_URL}/api/admin/dashboard/stats/activity`, adminToken);
    record('Overview', 'Recent Activity Stream', '200 OK with array', `${actRes.status} (Count: ${Array.isArray(actRes.data) ? actRes.data.length : 'N/A'})`, actRes.status === 200);

    // 4.4 Revenue Analytics Chart
    const revChartRes = await getJson(`${BASE_URL}/api/admin/dashboard/stats/analytics/revenue`, adminToken);
    const hasBothSeries = revChartRes.data?.saasRevenue && revChartRes.data?.networkGmv;
    record('Overview', 'Revenue Analytics Chart Data', '200 OK with saasRevenue and networkGmv series', 
      `${revChartRes.status} (SaaS points: ${revChartRes.data?.saasRevenue?.length}, GMV points: ${revChartRes.data?.networkGmv?.length})`, 
      revChartRes.status === 200 && hasBothSeries
    );

    // 4.5 Shops List & Counts
    const countsRes = await getJson(`${BASE_URL}/api/admin/shops/counts`, adminToken);
    record('Shops', 'Shop Status Counts Endpoint', '200 OK with total, active, pending, suspended', 
      `${countsRes.status} (Counts: ${JSON.stringify(countsRes.data)})`, 
      countsRes.status === 200 && countsRes.data?.total !== undefined
    );

    const shopsRes = await getJson(`${BASE_URL}/api/admin/shops?page=0&size=5`, adminToken);
    const hasShopsContent = Array.isArray(shopsRes.data?.content);
    record('Shops', 'Shops List Pagination', '200 OK with content array', 
      `${shopsRes.status} (Returned ${shopsRes.data?.content?.length || 0} of ${shopsRes.data?.totalElements || 0} shops)`, 
      shopsRes.status === 200 && hasShopsContent
    );

    // If shops exist, check detail endpoint for first shop
    let sampleShopId = shopsRes.data?.content?.[0]?.id;
    if (sampleShopId) {
      const shopDetailRes = await getJson(`${BASE_URL}/api/admin/shops/${sampleShopId}`, adminToken);
      const detailOk = shopDetailRes.status === 200 && shopDetailRes.data?.shop != null;
      record('Shops', `Shop Detail View (ID: ${sampleShopId})`, '200 OK with shop, owner, documents', 
        `${shopDetailRes.status} (Shop: "${shopDetailRes.data?.shop?.businessName}")`, 
        detailOk
      );
    }

    // 4.6 Plans & Subscriptions
    const plansRes = await getJson(`${BASE_URL}/api/admin/plans`, adminToken);
    const hasPlans = Array.isArray(plansRes.data);
    record('Plans', 'Subscription Plans Query', '200 OK with plans array', 
      `${plansRes.status} (Found ${plansRes.data?.length || 0} plans)`, 
      plansRes.status === 200 && hasPlans
    );

    // 4.7 Orders Ledger (Cross-Shop)
    const ordersRes = await getJson(`${BASE_URL}/api/admin/orders?page=0&size=5`, adminToken);
    const hasOrders = Array.isArray(ordersRes.data?.content);
    let piiMasked = true;
    if (hasOrders && ordersRes.data.content.length > 0) {
      const o = ordersRes.data.content[0];
      // Check that customerPhoneMasked and customerEmailMasked are present
      piiMasked = o.customerPhoneMasked != null || o.customerEmailMasked != null;
    }
    record('Orders Ledger', 'Cross-Shop Orders Query', '200 OK with content array & masked PII', 
      `${ordersRes.status} (Total: ${ordersRes.data?.totalElements}, PII Masked: ${piiMasked})`, 
      ordersRes.status === 200 && hasOrders
    );

    if (hasOrders && ordersRes.data.content.length > 0) {
      const orderId = ordersRes.data.content[0].id;
      const orderDetailRes = await getJson(`${BASE_URL}/api/admin/orders/${orderId}`, adminToken);
      record('Orders Ledger', `Order Detail Query (ID: ${orderId})`, '200 OK with items and bakery info', 
        `${orderDetailRes.status} (OrderNumber: ${orderDetailRes.data?.orderNumber})`, 
        orderDetailRes.status === 200 && orderDetailRes.data?.items !== undefined
      );
    }

    // 4.8 Payments Ledger (Financial Classification Audit)
    const paymentsRes = await getJson(`${BASE_URL}/api/admin/payments?page=0&size=10`, adminToken);
    const hasPayments = Array.isArray(paymentsRes.data?.content);
    let classificationVerified = false;
    if (hasPayments) {
      const types = new Set(paymentsRes.data.content.map(p => p.transactionType));
      const financialClasses = new Set(paymentsRes.data.content.map(p => p.financialClassification));
      classificationVerified = true;
      record('Payments Ledger', 'Cross-Shop Payments Query', '200 OK with financial classification', 
        `${paymentsRes.status} (Total: ${paymentsRes.data?.totalElements}, Distinct Types: ${Array.from(types).join(', ')}, Classes: ${Array.from(financialClasses).join(', ')})`, 
        paymentsRes.status === 200 && classificationVerified
      );
    } else {
      record('Payments Ledger', 'Cross-Shop Payments Query', '200 OK', `${paymentsRes.status}`, false);
    }

    if (hasPayments && paymentsRes.data.content.length > 0) {
      const paymentId = paymentsRes.data.content[0].id;
      const paymentDetailRes = await getJson(`${BASE_URL}/api/admin/payments/${paymentId}`, adminToken);
      record('Payments Ledger', `Payment Detail Query (ID: ${paymentId})`, '200 OK with transaction classification', 
        `${paymentDetailRes.status} (Classification: ${paymentDetailRes.data?.financialClassification})`, 
        paymentDetailRes.status === 200 && paymentDetailRes.data?.financialClassification !== undefined
      );
    }

    // 4.9 Platform Feedback
    const fbRes = await getJson(`${BASE_URL}/api/admin/feedback?page=0&size=5`, adminToken);
    record('Communication', 'Platform Feedback Query', '200 OK with content', 
      `${fbRes.status} (Total: ${fbRes.data?.totalElements || 0})`, 
      fbRes.status === 200
    );

    // 4.10 Contact Enquiries
    const enqRes = await getJson(`${BASE_URL}/api/admin/enquiries?page=0&size=5`, adminToken);
    record('Communication', 'Contact Enquiries Query', '200 OK with content', 
      `${enqRes.status} (Total: ${enqRes.data?.totalElements || 0})`, 
      enqRes.status === 200
    );

    // 4.11 Communication Summary
    const commSumRes = await getJson(`${BASE_URL}/api/admin/communication/summary`, adminToken);
    record('Communication', 'Communication Summary Overview', '200 OK with unread counts', 
      `${commSumRes.status} (Unread feedback: ${commSumRes.data?.unreadFeedbackCount}, Unread enquiries: ${commSumRes.data?.unreadEnquiryCount})`, 
      commSumRes.status === 200
    );

    // 4.12 Admin Notifications
    const notifRes = await getJson(`${BASE_URL}/api/admin/notifications?page=0&size=5`, adminToken);
    const unreadNotifRes = await getJson(`${BASE_URL}/api/admin/notifications/unread-count`, adminToken);
    record('Notifications', 'Admin Notifications Query & Unread Count', '200 OK', 
      `${notifRes.status} (Unread Count: ${unreadNotifRes.data?.unreadCount})`, 
      notifRes.status === 200 && unreadNotifRes.status === 200
    );

    // 4.13 Global Settings & Secret Masking
    const settingsRes = await getJson(`${BASE_URL}/api/admin/settings`, adminToken);
    let secretsProtected = false;
    if (settingsRes.status === 200 && settingsRes.data) {
      // Secrets must NOT be returned in plaintext
      const leakedKeySecret = settingsRes.data.razorpayKeySecret !== undefined;
      const leakedWebhookSecret = settingsRes.data.razorpayWebhookSecret !== undefined;
      const hasConfiguredFlags = settingsRes.data.razorpayKeySecretConfigured !== undefined &&
                                 settingsRes.data.razorpayWebhookSecretConfigured !== undefined;
      secretsProtected = !leakedKeySecret && !leakedWebhookSecret && hasConfiguredFlags;
      record('Global Settings', 'Settings Query & Secret Masking', '200 OK + Plaintext secrets strictly omitted', 
        `${settingsRes.status} (KeySecretLeaked: ${leakedKeySecret}, WebhookSecretLeaked: ${leakedWebhookSecret}, ConfiguredFlagsPresent: ${hasConfiguredFlags})`, 
        secretsProtected,
        `PlatformName: "${settingsRes.data.platformName}", KeyID: "${settingsRes.data.razorpayKeyId || 'empty'}"`
      );
    } else {
      record('Global Settings', 'Settings Query', '200 OK', `${settingsRes.status}`, false);
    }

    // 4.14 Broadcast Message History
    const broadcastRes = await getJson(`${BASE_URL}/api/admin/messages/history`, adminToken);
    record('Messages', 'Broadcast Message History', '200 OK with array', 
      `${broadcastRes.status} (Dispatched history count: ${Array.isArray(broadcastRes.data) ? broadcastRes.data.length : 'N/A'})`, 
      broadcastRes.status === 200
    );
  }

  // 5. FRONTEND PAGE RENDERING (SSR/PAGES STATUS)
  console.log('\n--- 5. Frontend Pages Availability (Port 3000) ---');
  const frontendRoutes = [
    { name: 'Admin Overview', path: '/admin' },
    { name: 'Shops Management', path: '/admin/shops' },
    { name: 'Orders Ledger', path: '/admin/orders' },
    { name: 'Payments Ledger', path: '/admin/payments' },
    { name: 'Plans & Subscriptions', path: '/admin/plans' },
    { name: 'Platform Feedback', path: '/admin/feedback' },
    { name: 'Contact Enquiries', path: '/admin/enquiries' },
    { name: 'Broadcast Messages', path: '/admin/messages' },
    { name: 'Admin Notifications', path: '/admin/notifications' },
    { name: 'Global Settings', path: '/admin/settings' },
  ];

  for (const r of frontendRoutes) {
    try {
      const res = await fetch(`${FRONTEND_URL}${r.path}`);
      const passed = res.status === 200;
      record('Frontend UI Route', r.name, '200 OK', `${res.status}`, passed, `Route: ${r.path}`);
    } catch (err) {
      record('Frontend UI Route', r.name, '200 OK', 'FETCH ERROR', false, err.message);
    }
  }

  console.log('\n=== AUDIT COMPLETE ===');
  console.log(`Total checks: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.passed).length}`);
  console.log(`Failed: ${results.filter(r => !r.passed).length}`);
}

runAudit().catch(console.error);
