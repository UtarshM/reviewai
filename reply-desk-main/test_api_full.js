async function runFullTest() {
  const email = `full-test-${Date.now()}@example.com`;
  const password = 'Password123!';
  const baseUrl = 'http://localhost:3000';
  let passed = 0;
  let failed = 0;

  function check(label, condition) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else { console.error(`  ❌ ${label}`); failed++; }
  }

  // 1. Register
  console.log('\n1. Register user');
  let res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  check('Register returns 201', res.status === 201);
  const { token, user } = await res.json();
  check('Token received', !!token);
  check('User email matches', user.email === email.toLowerCase());

  // 2. Login
  console.log('\n2. Login');
  res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  check('Login returns 200', res.status === 200);
  const loginData = await res.json();
  check('Login token received', !!loginData.token);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 3. Create business
  console.log('\n3. Create business');
  res = await fetch(`${baseUrl}/api/v1/businesses`, {
    method: 'POST', headers,
    body: JSON.stringify({ name: 'Test Cafe', category: 'Restaurant', tone_default: 'friendly', google_review_link: '' })
  });
  check('Business creation returns 201', res.status === 201);
  const biz = await res.json();
  check('Business has ID', !!biz.id);
  const bizId = biz.id;

  // 4. List businesses
  console.log('\n4. List businesses');
  res = await fetch(`${baseUrl}/api/v1/businesses`, { headers });
  check('List businesses returns 200', res.status === 200);
  const bizList = await res.json();
  check('Business list is array', Array.isArray(bizList));
  check('Our business is in the list', bizList.some(b => b.id === bizId));

  // 5. Generate reply
  console.log('\n5. Generate reply');
  res = await fetch(`${baseUrl}/api/v1/replies/generate`, {
    method: 'POST', headers,
    body: JSON.stringify({
      business_id: bizId, customer_name: 'Jane Doe', rating: 5,
      review_text: 'Amazing latte art and the croissants were flaky perfection!',
      tone: 'friendly', context: ''
    })
  });
  check('Reply generation returns 200', res.status === 200);
  const replyData = await res.json();
  check('Reply has variants', replyData.variants && replyData.variants.length > 0);
  check('Reply has saved draft ID', !!replyData.id);
  const replyId = replyData.id;

  // 6. Get history
  console.log('\n6. Get history');
  res = await fetch(`${baseUrl}/api/v1/businesses/${bizId}/history?limit=10&offset=0`, { headers });
  check('History returns 200', res.status === 200);
  const histData = await res.json();
  check('History has items', histData.history && histData.history.length > 0);
  const histItem = histData.history.find(h => h.id === replyId && h.type === 'reply');
  check('Our reply is in the history', !!histItem);
  check('Status is drafted', histItem && histItem.status === 'drafted');

  // 7. Update status
  console.log('\n7. Update status to posted');
  res = await fetch(`${baseUrl}/api/v1/history/reply/${replyId}/status`, {
    method: 'PUT', headers,
    body: JSON.stringify({ status: 'posted' })
  });
  check('Status update returns 200', res.status === 200);

  // 8. Update text
  console.log('\n8. Update text');
  res = await fetch(`${baseUrl}/api/v1/history/reply/${replyId}/text`, {
    method: 'PUT', headers,
    body: JSON.stringify({ text: 'Updated reply text for verification' })
  });
  check('Text update returns 200', res.status === 200);

  // 9. Verify changes in history
  console.log('\n9. Verify changes in history');
  res = await fetch(`${baseUrl}/api/v1/businesses/${bizId}/history?limit=10&offset=0`, { headers });
  const hist2 = await res.json();
  const updated = hist2.history.find(h => h.id === replyId && h.type === 'reply');
  check('Status changed to edited (text update sets edited)', updated && updated.status === 'edited');
  check('Text was updated', updated && updated.selected_text === 'Updated reply text for verification');

  // 10. Delete
  console.log('\n10. Delete history item');
  res = await fetch(`${baseUrl}/api/v1/history/reply/${replyId}`, {
    method: 'DELETE', headers
  });
  check('Delete returns 200', res.status === 200);

  // 11. Verify deletion
  console.log('\n11. Verify deletion');
  res = await fetch(`${baseUrl}/api/v1/businesses/${bizId}/history?limit=10&offset=0`, { headers });
  const hist3 = await res.json();
  const deleted = hist3.history.find(h => h.id === replyId && h.type === 'reply');
  check('Item no longer in history', !deleted);

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log(`${'='.repeat(40)}`);
}

runFullTest().catch(err => console.error('Test crashed:', err));
