const MedicalReport = require("../models/MedicalReport");
const Admission = require("../models/Admission");
const notificationService = require("../services/notificationService");

/**
 * @desc   Upload medical report for an admission
 * @route  POST /api/reports/upload/:admissionId
 * @access Private (PATIENT)
 */
const uploadReport = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded." });
  }

  const admission = await Admission.findById(req.params.admissionId);

  if (!admission) {
    return res.status(404).json({ success: false, message: "Admission not found." });
  }

  // Only the patient who submitted can upload reports
  if (admission.patientId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  const report = await MedicalReport.create({
    admissionId: admission._id,
    patientId: req.user._id,
    name: req.file.originalname,
    type: req.file.mimetype,
    url: req.file.path,                   // Cloudinary secure URL
    cloudinaryPublicId: req.file.filename, // for future deletion
    size: req.file.size,
  });

  // Push report reference into admission
  await Admission.findByIdAndUpdate(admission._id, { $push: { reports: report._id } });

  // Notify patient
  await notificationService.notifyReportUploaded({
    userId: req.user._id,
    fileName: req.file.originalname,
    admissionId: admission._id,
  });

  res.status(201).json({
    success: true,
    message: "Report uploaded successfully.",
    data: { report },
  });
};

/**
 * @desc   Get all reports for an admission
 * @route  GET /api/reports/admission/:admissionId
 * @access Private (PATIENT or HOSPITAL_ADMIN)
 */
const getAdmissionReports = async (req, res) => {
  const admission = await Admission.findById(req.params.admissionId);

  if (!admission) {
    return res.status(404).json({ success: false, message: "Admission not found." });
  }

  // Authorization
  const isOwner = admission.patientId.toString() === req.user._id.toString();
  const isAdmin =
    req.user.role === "HOSPITAL_ADMIN" &&
    req.user.hospitalId?.toString() === admission.hospitalId.toString();

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  const reports = await MedicalReport.find({ admissionId: req.params.admissionId }).sort({ uploadedAt: -1 });

  res.status(200).json({ success: true, data: { reports } });
};

/**
 * @desc   Delete a report
 * @route  DELETE /api/reports/:id
 * @access Private (PATIENT)
 */
const deleteReport = async (req, res) => {
  const { cloudinary } = require("../config/cloudinary");

  const report = await MedicalReport.findById(req.params.id);

  if (!report) {
    return res.status(404).json({ success: false, message: "Report not found." });
  }

  if (report.patientId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  // Delete from Cloudinary
  try {
    await cloudinary.uploader.destroy(report.cloudinaryPublicId, { resource_type: "auto" });
  } catch (err) {
    console.warn("[ReportController] Cloudinary delete failed:", err.message);
  }

  // Remove from DB and admission reference
  await Admission.findByIdAndUpdate(report.admissionId, { $pull: { reports: report._id } });
  await report.deleteOne();

  res.status(200).json({ success: true, message: "Report deleted successfully." });
};

module.exports = { uploadReport, getAdmissionReports, deleteReport };
