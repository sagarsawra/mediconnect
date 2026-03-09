const express = require("express");
const router = express.Router();
const { admissionsByMonth, bedOccupancy, hospitalPerformance, summary } = require("../controllers/analyticsController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");

const adminOnly = [protect, authorize("HOSPITAL_ADMIN")];

router.get("/admissions-by-month", ...adminOnly, admissionsByMonth);
router.get("/bed-occupancy", ...adminOnly, bedOccupancy);
router.get("/hospital-performance", ...adminOnly, hospitalPerformance);
router.get("/summary", ...adminOnly, summary);

module.exports = router;
