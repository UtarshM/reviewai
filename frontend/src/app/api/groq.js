const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const bannedPhrases = [
  "we strive to provide",
  "your satisfaction is our priority",
  "we take this seriously",
  "thank you for your feedback",
  "thanks for your feedback",
];

function checkBannedPhrases(text) {
  const lowerText = (text || '').toLowerCase();
  return bannedPhrases.some(phrase => lowerText.includes(phrase));
}

export async function callGroq(systemPrompt, userPrompt) {
  if (!GROQ_API_KEY) {
    throw new Error('groq api key is not configured');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || `groq api returned status ${response.status}`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error('no choices returned from groq');
  }

  let llmText = data.choices[0].message.content.trim();

  // Clean markdown code blocks if the model returned them anyway
  if (llmText.startsWith('```json')) {
    llmText = llmText.substring(7, llmText.length - 3);
  } else if (llmText.startsWith('```')) {
    llmText = llmText.substring(3, llmText.length - 3);
  }
  llmText = llmText.trim();

  let parsed;
  try {
    parsed = JSON.parse(llmText);
  } catch (e) {
    throw new Error(`model output is not valid json: ${e.message} (output was: ${llmText})`);
  }

  if (!parsed.variants || parsed.variants.length === 0) {
    throw new Error('model returned zero variants');
  }

  // Enforce banned phrases server-side
  for (let i = 0; i < parsed.variants.length; i++) {
    if (checkBannedPhrases(parsed.variants[i].text)) {
      throw new Error(`model generated a banned stock phrase in variant ${i + 1}: ${parsed.variants[i].text}`);
    }
  }

  return parsed; // { variants: [{ label, text }] }
}
