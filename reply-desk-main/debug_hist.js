async function debug() {
  const baseUrl = 'http://localhost:3000';
  const email = `debug-${Date.now()}@test.com`;
  const headers = { 'Content-Type': 'application/json' };

  const reg = await (await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST', headers, body: JSON.stringify({ email, password: 'Password123!' })
  })).json();
  
  const authHeaders = { ...headers, Authorization: `Bearer ${reg.token}` };

  const biz = await (await fetch(`${baseUrl}/api/v1/businesses`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ name: 'Debug Cafe', category: 'Cafe' })
  })).json();

  await fetch(`${baseUrl}/api/v1/replies/generate`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ business_id: biz.id, customer_name: 'Test', rating: 5, review_text: 'Great place!', tone: 'friendly', context: '' })
  });

  const histRes = await fetch(`${baseUrl}/api/v1/businesses/${biz.id}/history?limit=10&offset=0`, { headers: authHeaders });
  console.log('Status:', histRes.status);
  const histBody = await histRes.text();
  console.log('Body:', histBody);
}
debug().catch(e => console.error(e));
