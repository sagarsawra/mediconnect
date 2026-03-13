const OpenAI = require("openai");

let openaiClient = null;

/**
 * Lazily initialize OpenAI client
 */
const getClient = () => {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set in environment variables.");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

/**
 * System prompt for MediConnect medical assistant
 */
const SYSTEM_PROMPT = `You are MediConnect AI, a professional medical assistant for a multi-hospital healthcare platform in India.

Your responsibilities:
1. Help patients understand their symptoms (do NOT provide definitive diagnoses)
2. Recommend appropriate hospital specializations based on symptoms
3. Guide patients through the admission process
4. Provide emergency guidance when needed

Rules:
- Always recommend consulting a qualified doctor for diagnosis
- For emergencies (chest pain, stroke, severe bleeding), always advise calling 102 (Indian emergency)
- Keep responses concise and empathetic
- Do NOT prescribe medications
- Always mention that your advice is general and not a substitute for professional medical care`;

/**
 * Chat with AI medical assistant
 * @param {string} userMessage - Patient's message
 * @param {Array} conversationHistory - Previous messages [{role, content}]
 */
const chatWithAssistant = async (userMessage, conversationHistory = []) => {
  const client = getClient();

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    { role: "user", content: userMessage },
  ];

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 500,
    temperature: 0.3, // Lower temperature for consistent medical advice
  });

  return response.choices[0].message.content;
};

/**
 * Get AI hospital recommendations based on symptoms and patient data
 * @param {string[]} symptoms - Patient symptoms
 * @param {string} disease - Primary complaint
 * @param {Object[]} hospitals - Available hospitals data
 */
const getHospitalRecommendations = async (symptoms, disease, hospitals) => {
  const client = getClient();

  const hospitalSummary = hospitals
    .map(
      (h) =>
      `- ${h.name} (${h.city}): Rating ${h.rating}, Specializations: ${h.specializations.slice(0, 5).join(", ")}, Tier: ${h.tier}`
    )
    .join("\n");

  const prompt = `
A patient reports the following:
Disease/Condition: ${disease}
Symptoms: ${symptoms.join(", ")}

Available hospitals:
${hospitalSummary}

Based on the patient's condition, which 3 hospitals would you recommend and why? 
Consider: specialization match, bed availability, rating, and tier.
Respond in JSON format: { "recommendations": [{ "hospitalName": string, "reason": string, "priority": number }] }
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400,
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
};

/**
 * AI-powered comparison analysis for selected hospitals
 * @param {Object[]} hospitals - Hospitals to compare
 */
const compareHospitals = async (hospitals) => {
  const client = getClient();

  const hospitalDetails = hospitals
    .map(
      (h) =>
        `${h.name}: Rating ${h.rating}/5, Tier: ${h.tier}, Specializations: ${h.specializations.join(", ")}, Accreditations: ${h.accreditations.join(", ")}`
    )
    .join("\n");

  const prompt = `
Compare these hospitals for a patient choosing where to be admitted:
${hospitalDetails}

Provide a brief, objective comparison covering:
1. Best overall rating
2. Best specializations for your condition
3. Recommended choice and why

Keep response under 200 words and be direct.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.2,
  });

  return response.choices[0].message.content;
};

module.exports = { chatWithAssistant, getHospitalRecommendations, compareHospitals };
