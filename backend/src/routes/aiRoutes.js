const express = require("express");
const router = express.Router();
const { chat, recommendHospitals, compareHospitals } = require("../controllers/aiController");
const { protect } = require("../middlewares/authMiddleware");

router.post("/chat", protect, chat);
router.post("/recommend-hospitals", protect, recommendHospitals);
router.post("/compare-hospitals", protect, compareHospitals);

module.exports = router;
