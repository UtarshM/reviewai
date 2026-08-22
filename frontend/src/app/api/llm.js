const BANNED_PHRASES = [
  "we strive to provide",
  "your satisfaction is our priority",
  "we take this seriously",
  "thank you for your feedback",
  "thanks for your feedback"
];

function checkBannedPhrases(text) {
  const lowerText = text.toLowerCase();
  return BANNED_PHRASES.some(phrase => lowerText.includes(phrase));
}

export async function generateReply({
  businessName,
  category,
  tone,
  context,
  customerName,
  rating,
  reviewText
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key is not configured');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const systemPrompt = `You are helping a small business owner reply to a customer review on Google.

Write the reply using only the details given. Do not invent facts, names,
dates, or specifics that aren't provided.

Match the tone to the star rating:
- 4-5 stars: warm, appreciative, specific
- 3 stars: honest acknowledgment of a mixed experience, don't oversell it
- 1-2 stars: acknowledge the exact complaint, stay non-defensive, and if
  appropriate invite them to reach out directly to make it right

Reference at least one concrete detail from the review itself. Never use:
"we strive to provide great service," "your satisfaction is our priority,"
"we take this seriously," "thank you for your feedback."

Reply in the same language the review is written in. Keep each reply to
2-4 sentences. Sign off like a real owner, not "the team."

Output ONLY valid JSON, no markdown fences:
{"variants":[{"label":"...","text":"..."}, x3]}`;

  const userPrompt = `Business Name: ${businessName}
Business Category: ${category}
Requested Tone: ${tone}
Additional Context: ${context}
Customer Name: ${customerName}
Star Rating: ${rating} stars
Review Text: ${reviewText}`;

  return callGroq(systemPrompt, userPrompt, model, apiKey);
}

export async function generateReview({
  businessName,
  category,
  tone,
  rating,
  liked,
  disliked
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key is not configured');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const systemPrompt = `Help a customer turn their real experience into a short, honest Google
review draft, in their own voice.

Only use details explicitly given. Never invent staff names, dates, or
specifics not mentioned.

Match sentiment exactly to the star rating - don't inflate a 3-star
experience into glowing praise, don't make a 5-star review sound lukewarm.

Write in first person. Include at least one specific detail given - avoid
generic lines like "highly recommend, great service." Keep negative
feedback in unless the rating is 5 stars and it's clearly minor.

Keep it to 2-4 sentences, natural spoken register, not marketing copy.

Output ONLY valid JSON, no markdown fences:
{"variants":[{"label":"...","text":"..."}, x3]}`;

  const userPrompt = `Business Name: ${businessName}
Business Category: ${category}
Requested Tone: ${tone}
Star Rating: ${rating} stars
What was liked: ${liked}
What was disliked: ${disliked}`;

  return callGroq(systemPrompt, userPrompt, model, apiKey);
}

async function callGroq(systemPrompt, userPrompt, model, apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    let errMsg = 'unknown groq error';
    try {
      const errJson = await response.json();
      if (errJson.error && errJson.error.message) {
        errMsg = errJson.error.message;
      }
    } catch (_) {}
    throw new Error(`Groq API returned status ${response.status}: ${errMsg}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error('No choices returned from Groq');
  }

  let llmText = data.choices[0].message.content.trim();

  // Clean markdown wrappers if any
  if (llmText.startsWith('```json')) {
    llmText = llmText.substring(7);
  } else if (llmText.startsWith('```')) {
    llmText = llmText.substring(3);
  }
  if (llmText.endsWith('```')) {
    llmText = llmText.substring(0, llmText.length - 3);
  }
  llmText = llmText.trim();

  let genResp;
  try {
    genResp = JSON.parse(llmText);
  } catch (err) {
    throw new Error(`Model output is not valid JSON: ${err.message} (output was: ${llmText})`);
  }

  if (!genResp.variants || genResp.variants.length === 0) {
    throw new Error('Model returned zero variants');
  }

  // Check banned phrases
  for (let i = 0; i < genResp.variants.length; i++) {
    if (checkBannedPhrases(genResp.variants[i].text)) {
      throw new Error(`Model generated a banned stock phrase in variant ${i + 1}: ${genResp.variants[i].text}`);
    }
  }

  return genResp;
}

export async function callGroqDirect(systemPrompt, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key is not configured');
  }
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    let errMsg = 'unknown groq error';
    try {
      const errJson = await response.json();
      if (errJson.error && errJson.error.message) {
        errMsg = errJson.error.message;
      }
    } catch (_) {}
    throw new Error(`Groq API returned status ${response.status}: ${errMsg}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error('No choices returned from Groq');
  }

  let content = data.choices[0].message.content.trim();
  
  if (content.startsWith('```json')) {
    content = content.substring(7);
  } else if (content.startsWith('```')) {
    content = content.substring(3);
  }
  if (content.endsWith('```')) {
    content = content.substring(0, content.length - 3);
  }
  content = content.trim();

  return JSON.parse(content);
}
