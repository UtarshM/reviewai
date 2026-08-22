async function runTest() {
  const email = `test-user-${Date.now()}@example.com`;
  const password = 'Password123!';
  const baseUrl = 'http://localhost:3000';

  console.log('1. Registering user...');
  let res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!res.ok) {
    console.error('Registration failed:', res.status, await res.text());
    return;
  }
  const registerData = await res.json();
  const token = registerData.token;
  console.log('Registration successful, token received.');

  console.log('2. Creating business profile...');
  res = await fetch(`${baseUrl}/api/v1/businesses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Next Bakery',
      category: 'Bakery & Cafe',
      tone_default: 'friendly',
      google_review_link: 'https://g.page/r/next-bakery/review'
    })
  });

  if (!res.ok) {
    console.error('Business creation failed:', res.status, await res.text());
    return;
  }
  const businessData = await res.json();
  const businessId = businessData.id;
  console.log('Business created, ID:', businessId);

  console.log('3. Generating reply...');
  try {
    res = await fetch(`${baseUrl}/api/v1/replies/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        business_id: businessId,
        customer_name: 'Mark Johnson',
        rating: 5,
        review_text: 'Best sourdough bread in town!',
        tone: 'friendly',
        context: 'We use 100-year-old starter'
      })
    });
    
    console.log('Generation response status:', res.status);
    const text = await res.text();
    console.log('Generation response body:', text);
  } catch (err) {
    console.error('Generation network/connection error:', err);
  }
}

runTest();
