const aiService = require("../services/aiService");
const Hospital = require("../models/Hospital");

/**
 * @desc   Chat with AI medical assistant
 * @route  POST /api/ai/chat
 * @access Private
 */
const chat = async (req, res) => {
  const { message, conversationHistory = [] } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: "Message is required." });
  }

  // Mock response if OpenAI key not set (development mode)
  if (!process.env.OPENAI_API_KEY) {
    const mockResponses = {
      default: "I'm MediConnect AI. I can help you find hospitals and understand symptoms. Please configure OPENAI_API_KEY for full AI capability.",
      fever: "For fever above 39°C persisting more than 3 days, please seek medical attention immediately.",
      emergency: "🚨 Please call 102 immediately for emergencies.",
    };
    const lower = message.toLowerCase();
    const reply = lower.includes("fever") ? mockResponses.fever
      : lower.includes("emergency") ? mockResponses.emergency
      : mockResponses.default;
    return res.status(200).json({ success: true, data: { reply } });
  }

  const reply = await aiService.chatWithAssistant(message, conversationHistory);

  res.status(200).json({ success: true, data: { reply } });
};

/**
 * @desc   Get AI hospital recommendations based on symptoms
 * @route  POST /api/ai/recommend-hospitals
 * @access Private
 */
const recommendHospitals = async (req, res) => {
  const { symptoms = [], disease = "", city } = req.body;

  // Fetch available hospitals
  const query = { isActive: true, availableBeds: { $gt: 0 } };
  if (city) query.city = new RegExp(city, "i");

  const hospitals = await Hospital.find(query)
    .select("name city rating availableBeds totalBeds specializations tier")
    .sort({ rating: -1 })
    .limit(10);

  if (hospitals.length === 0) {
    return res.status(200).json({
      success: true,
      data: { recommendations: [], message: "No hospitals with available beds found in your area." },
    });
  }

  // Mock if no OpenAI key
  if (!process.env.OPENAI_API_KEY) {
    const topHospitals = hospitals.slice(0, 3).map((h, i) => ({
      hospitalName: h.name,
      reason: `Rated ${h.rating}/5 with ${h.availableBeds} available beds.`,
      priority: i + 1,
    }));
    return res.status(200).json({ success: true, data: { recommendations: topHospitals, hospitals: hospitals.slice(0, 3) } });
  }

  const aiResult = await aiService.getHospitalRecommendations(symptoms, disease, hospitals);

  // Enrich recommendations with full hospital data
  const enriched = (aiResult.recommendations || []).map((rec) => {
    const hospital = hospitals.find((h) => h.name === rec.hospitalName);
    return { ...rec, hospital: hospital || null };
  });

  res.status(200).json({ success: true, data: { recommendations: enriched } });
};

/**
 * @desc   AI comparison analysis for selected hospitals
 * @route  POST /api/ai/compare-hospitals
 * @access Private
 */
const compareHospitals = async (req, res) => {
  const { hospitalIds } = req.body;

  if (!hospitalIds || hospitalIds.length < 2) {
    return res.status(400).json({ success: false, message: "Provide at least 2 hospital IDs to compare." });
  }

  const hospitals = await Hospital.find({ _id: { $in: hospitalIds } });

  if (hospitals.length === 0) {
    return res.status(404).json({ success: false, message: "Hospitals not found." });
  }

  if (!process.env.OPENAI_API_KEY) {
    const analysis = `Comparison of ${hospitals.map((h) => h.name).join(" vs ")}: ${hospitals[0].name} leads with ${hospitals[0].rating}★ rating. OPENAI_API_KEY not configured for full AI analysis.`;
    return res.status(200).json({ success: true, data: { analysis, hospitals } });
  }

  const analysis = await aiService.compareHospitals(hospitals);

  res.status(200).json({ success: true, data: { analysis, hospitals } });
};

module.exports = { chat, recommendHospitals, compareHospitals };
