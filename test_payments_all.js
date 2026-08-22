async function runPaymentTests() {
  const baseUrl = 'http://localhost:8080';
  const email = `test-user-${Date.now()}@example.com`;
  const password = 'Password123!';

  console.log('--- STARTING REVMEAI PAYMENT & SYSTEM TESTS ---');

  // 1. Register User
  let res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const authData = await res.json();
  const token = authData.token;
  console.log('✅ Auth Register Success. Token:', !!token);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Check Subscription Status
  res = await fetch(`${baseUrl}/api/v1/payments/status`, { headers });
  const statusData = await res.json();
  console.log('✅ Subscription Status fetched:', statusData.plans.map(p => `${p.key}: ${p.display_price}`));

  // 3. Test Order Creation for 1 Month (₹1,000)
  res = await fetch(`${baseUrl}/api/v1/payments/create-order`, {
    method: 'POST', headers,
    body: JSON.stringify({ plan: '1_month' })
  });
  const order1 = await res.json();
  console.log('✅ 1 Month Order Created:', order1.plan, 'Amount:', order1.amount / 100);

  // 4. Verify Payment for 1 Month
  res = await fetch(`${baseUrl}/api/v1/payments/verify-payment`, {
    method: 'POST', headers,
    body: JSON.stringify({
      razorpay_order_id: order1.order_id,
      razorpay_payment_id: `pay_test_${Date.now()}`,
      razorpay_signature: 'test_sig',
      plan: '1_month'
    })
  });
  const verify1 = await res.json();
  console.log('✅ 1 Month Verification Status:', verify1.status, verify1.message);

  // 5. Test Order Creation for 6 Months (₹4,000)
  res = await fetch(`${baseUrl}/api/v1/payments/create-order`, {
    method: 'POST', headers,
    body: JSON.stringify({ plan: '6_months' })
  });
  const order6 = await res.json();
  console.log('✅ 6 Months Order Created:', order6.plan, 'Amount:', order6.amount / 100);

  // 6. Verify Payment for 6 Months
  res = await fetch(`${baseUrl}/api/v1/payments/verify-payment`, {
    method: 'POST', headers,
    body: JSON.stringify({
      razorpay_order_id: order6.order_id,
      razorpay_payment_id: `pay_test_${Date.now()}`,
      razorpay_signature: 'test_sig',
      plan: '6_months'
    })
  });
  const verify6 = await res.json();
  console.log('✅ 6 Months Verification Status:', verify6.status, verify6.message);

  // 7. Test Order Creation for 12 Months (₹5,000)
  res = await fetch(`${baseUrl}/api/v1/payments/create-order`, {
    method: 'POST', headers,
    body: JSON.stringify({ plan: '12_months' })
  });
  const order12 = await res.json();
  console.log('✅ 12 Months Order Created:', order12.plan, 'Amount:', order12.amount / 100);

  // 8. Verify Payment for 12 Months
  res = await fetch(`${baseUrl}/api/v1/payments/verify-payment`, {
    method: 'POST', headers,
    body: JSON.stringify({
      razorpay_order_id: order12.order_id,
      razorpay_payment_id: `pay_test_${Date.now()}`,
      razorpay_signature: 'test_sig',
      plan: '12_months'
    })
  });
  const verify12 = await res.json();
  console.log('✅ 12 Months Verification Status:', verify12.status, verify12.message);

  // 9. Final Subscription Status Check
  res = await fetch(`${baseUrl}/api/v1/payments/status`, { headers });
  const finalStatus = await res.json();
  console.log('🎉 Final Active Plan:', finalStatus.subscription_plan, 'Is Active:', finalStatus.is_active);
}

runPaymentTests().catch(err => console.error('Test Failed:', err));
