const express = require("express");
const router = express.Router();
const {
  getHospitals,
  getHospitalById,
  getHospitalBeds,
  getHospitalDoctors,
  updateHospital,
  getHospitalStats,
} = require("../controllers/hospitalController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize, verifyHospitalOwnership } = require("../middlewares/roleMiddleware");

router.get("/", getHospitals);
router.get("/:id", getHospitalById);
router.get("/:id/beds", getHospitalBeds);
router.get("/:id/doctors", getHospitalDoctors);
router.put("/:id", protect, authorize("HOSPITAL_ADMIN"), verifyHospitalOwnership("id"), updateHospital);
router.get("/:id/stats", protect, authorize("HOSPITAL_ADMIN"), verifyHospitalOwnership("id"), getHospitalStats);

module.exports = router;
