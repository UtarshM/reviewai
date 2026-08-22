import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { callGroqDirect } from '@/app/api/llm';

export async function POST(request) {
  try {
    const {
      campaign_id, rating, liked_aspects, modifier, previous_suggestion
    } = await request.json();

    const campaignId = parseInt(campaign_id, 10);
    const starRating = parseInt(rating, 10);

    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Valid campaign_id is required' }, { status: 400 });
    }
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      return NextResponse.json({ error: 'bad_request', message: 'Star rating must be between 1 and 5' }, { status: 400 });
    }

    // 1. Fetch Campaign and Business Info
    const campaignResult = await query(
      `SELECT 
         c.id, c.template_id, c.review_style, c.review_length, c.language,
         b.name as business_name, b.category as business_category, b.city, b.state, b.country
       FROM review_qr_campaigns c
       JOIN businesses b ON c.business_id = b.id
       WHERE c.id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({ error: 'not_found', message: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaignResult.rows[0];

    // 2. Fetch Custom Prompt Template if configured
    let systemPrompt = '';
    if (campaign.template_id) {
      const templateResult = await query('SELECT system_prompt FROM prompt_templates WHERE id = $1', [campaign.template_id]);
      if (templateResult.rows.length > 0) {
        systemPrompt = templateResult.rows[0].system_prompt;
      }
    }

    // Default System Prompt if none is configured
    if (!systemPrompt) {
      systemPrompt = `You are helping a customer write a natural, honest Google review draft for a business in the first person ("I").
Write in a realistic, conversational human voice.
Do not exaggerate, make up details, use overly hyped marketing language, or fabricate names.
Write strictly in the requested language (defaults to English).
You MUST generate 3 distinct suggested variations in different styles (Friendly, Professional, and Detailed) and return them in a JSON object with this exact structure, with no markdown code blocks:
{
  "suggestion": "a default medium length review draft",
  "variants": [
    { "label": "Friendly", "text": "a warm, friendly, casual draft" },
    { "label": "Professional", "text": "a polite, formal, objective draft" },
    { "label": "Detailed", "text": "a highly descriptive, specific draft highlighting concrete elements of their experience" }
  ]
}`;
    } else {
      // Append JSON formatting enforcement to custom template prompts
      systemPrompt += `\n\nYou MUST generate 3 distinct suggested variations in different styles (Friendly, Professional, and Detailed) and return them in a JSON object with this exact structure, with no markdown code blocks:
{
  "suggestion": "a default medium length review draft",
  "variants": [
    { "label": "Friendly", "text": "a warm, friendly, casual draft" },
    { "label": "Professional", "text": "a polite, formal, objective draft" },
    { "label": "Detailed", "text": "a highly descriptive, specific draft highlighting concrete elements of their experience" }
  ]
}`;
    }

    // Build details
    const locationParts = [campaign.city, campaign.state, campaign.country].filter(Boolean);
    const locationStr = locationParts.join(', ');
    const style = campaign.review_style || 'friendly';
    const length = campaign.review_length || 'medium';

    // Length directives
    let lengthDirective = 'around 3-4 sentences';
    if (length === 'short') lengthDirective = '1-2 short, concise sentences';
    else if (length === 'long') lengthDirective = '5 or more detailed sentences';

    // Sentiment directive
    let sentimentDirective = '';
    if (starRating >= 4) {
      sentimentDirective = 'Write a positive, appreciative review highlighting outstanding service or quality.';
    } else if (starRating === 3) {
      sentimentDirective = 'Write a balanced, constructive review mentioning both positive aspects and areas of minor improvement.';
    } else {
      sentimentDirective = 'Write a polite but disappointed review focusing on the wowed issues without being aggressive or insulting.';
    }

    let userPrompt = `Business Name: ${campaign.business_name}
Business Category: ${campaign.business_category}
${locationStr ? `Location: ${locationStr}\n` : ''}Selected Rating: ${starRating} out of 5 stars
Style / Tone: ${style}
Target Review Length: ${lengthDirective}
${sentimentDirective}
`;

    if (liked_aspects && liked_aspects.trim()) {
      userPrompt += `\nThe customer noted these specific memorable aspects of their experience:\n"${liked_aspects.trim()}"\n`;
    }

    // Handle modification prompts
    if (modifier && previous_suggestion) {
      userPrompt += `\n---
We have already drafted this review:
"${previous_suggestion}"

Please modify the draft above according to the following edit instruction:
`;
      if (modifier === 'rewrite' || modifier === 'make_rewrite') {
        userPrompt += 'Rephrase and rewrite the draft review to give it a fresh, natural variation while keeping the same sentiment and rating.';
      } else if (modifier === 'make_shorter') {
        userPrompt += 'Make it significantly shorter and more concise (1-2 sentences).';
      } else if (modifier === 'make_longer') {
        userPrompt += 'Expand and add more elaborate detail (5+ sentences).';
      } else if (modifier === 'more_professional') {
        userPrompt += 'Rewrite it to sound more formal, polite, and professional.';
      } else if (modifier === 'more_friendly') {
        userPrompt += 'Rewrite it to sound warmer, enthusiastic, and friendly.';
      } else if (modifier === 'simpler_language') {
        userPrompt += 'Use simpler, everyday language, and remove complex vocabulary.';
      } else {
        userPrompt += `Regenerate it with: ${modifier}`;
      }

    }

    // Call Groq
    let insightsJSON;
    try {
      insightsJSON = await callGroqDirect(systemPrompt, userPrompt);
    } catch (err) {
      console.error('Groq public review suggestion failed:', err);
      return NextResponse.json({ error: 'service_error', message: 'Failed to communicate with AI writer' }, { status: 502 });
    }

    return NextResponse.json(insightsJSON, { status: 200 });
  } catch (error) {
    console.error('Generate review suggestion error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to generate review suggestion' }, { status: 500 });
  }
}
