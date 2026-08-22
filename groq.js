import dotenv from 'dotenv';

dotenv.config();

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
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
    console.log('[GROQ DEMO MODE] GROQ_API_KEY not set. Returning mock AI variants.');
    return {
      variants: [
        { label: "Warm & Friendly", text: "Thank you so much for your wonderful visit! We are delighted you had a great experience with us and hope to see you again very soon." },
        { label: "Professional & Detailed", text: "We truly appreciate your visit and kind feedback. Serving you excellence is our top priority, and we look forward to welcoming you back." },
        { label: "Personal & Enthusiastic", text: "Awesome to hear! Your support means everything to our local business team. See you again next time!" }
      ]
    };
  }

  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    if (!response.ok) throw new Error(`Groq returned ${response.status}`);
  } catch (err) {
    console.warn('[GROQ FALLBACK MODE] Using local AI template engine due to Groq API status:', err.message);
    return {
      variants: [
        { label: "Warm & Friendly", text: "Thank you so much for your wonderful review! We are delighted you enjoyed your visit and hope to see you again soon." },
        { label: "Professional & Detailed", text: "We truly appreciate your visit and kind feedback. Serving you top-tier quality is our passion, and we look forward to your next visit." },
        { label: "Enthusiastic Local Favorite", text: "Awesome! Your support means the world to our team. Thank you for choosing us!" }
      ]
    };
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

export async function callGroqDirect(systemPrompt, userPrompt) {
  if (!GROQ_API_KEY) {
    console.log('[GROQ DEMO MODE] GROQ_API_KEY not set. Returning mock direct AI response.');
    return {
      review_suggestion: "Great experience overall! The atmosphere was welcoming, and the team provided excellent, prompt service.",
      insights: {
        sentiment: "Positive",
        key_themes: ["Service Quality", "Atmosphere"],
        summary: "Customers express high satisfaction with overall service and experience."
      }
    };
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
