const express = require("express");
const router = express.Router();
const { getHospitalBeds, createBedCategory, updateBedAvailability, deleteBedCategory } = require("../controllers/bedController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");

router.get("/hospital/:hospitalId", getHospitalBeds);
router.post("/", protect, authorize("HOSPITAL_ADMIN"), createBedCategory);
router.put("/:id", protect, authorize("HOSPITAL_ADMIN"), updateBedAvailability);
router.delete("/:id", protect, authorize("HOSPITAL_ADMIN"), deleteBedCategory);

module.exports = router;
