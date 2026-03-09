const express = require("express");
const router = express.Router();
const { getHospitalDoctors, createDoctor, updateDoctor, deleteDoctor } = require("../controllers/doctorController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");

router.get("/hospital/:hospitalId", getHospitalDoctors);
router.post("/", protect, authorize("HOSPITAL_ADMIN"), createDoctor);
router.put("/:id", protect, authorize("HOSPITAL_ADMIN"), updateDoctor);
router.delete("/:id", protect, authorize("HOSPITAL_ADMIN"), deleteDoctor);

module.exports = router;
