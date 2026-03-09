const express = require("express");
const router = express.Router();
const { uploadReport, getAdmissionReports, deleteReport } = require("../controllers/reportController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const { uploadReport: multerUpload } = require("../config/cloudinary");

router.post("/upload/:admissionId", protect, authorize("PATIENT"), multerUpload.single("report"), uploadReport);
router.get("/admission/:admissionId", protect, getAdmissionReports);
router.delete("/:id", protect, authorize("PATIENT"), deleteReport);

module.exports = router;
