const Notification = require("../models/Notification");

/**
 * Create a single notification for a user
 */
const createNotification = async ({ userId, title, message, type = "info", link = null, relatedAdmissionId = null }) => {
  try {
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      link,
      relatedAdmissionId,
    });
    return notification;
  } catch (error) {
    // Notifications should never crash the main flow
    console.error("[NotificationService] Failed to create notification:", error.message);
    return null;
  }
};

/**
 * Notify patient that their admission request was received
 */
const notifyAdmissionSubmitted = async ({ userId, hospitalName, admissionId }) => {
  return createNotification({
    userId,
    title: "Admission Request Submitted",
    message: `Your admission request at ${hospitalName} has been submitted and is awaiting review.`,
    type: "info",
    link: `/patient/admissions/${admissionId}`,
    relatedAdmissionId: admissionId,
  });
};

/**
 * Notify patient when admission is approved
 */
const notifyAdmissionApproved = async ({ userId, hospitalName, admissionId, adminNotes }) => {
  return createNotification({
    userId,
    title: "Admission Approved ✅",
    message: `Great news! Your admission request at ${hospitalName} has been approved.${adminNotes ? ` Note: ${adminNotes}` : ""}`,
    type: "success",
    link: `/patient/admissions/${admissionId}`,
    relatedAdmissionId: admissionId,
  });
};

/**
 * Notify patient when admission is rejected
 */
const notifyAdmissionRejected = async ({ userId, hospitalName, admissionId, adminNotes }) => {
  return createNotification({
    userId,
    title: "Admission Request Rejected",
    message: `Your admission request at ${hospitalName} has been rejected.${adminNotes ? ` Reason: ${adminNotes}` : ""}`,
    type: "error",
    link: `/patient/admissions/${admissionId}`,
    relatedAdmissionId: admissionId,
  });
};

/**
 * Notify patient that report was uploaded successfully
 */
const notifyReportUploaded = async ({ userId, fileName, admissionId }) => {
  return createNotification({
    userId,
    title: "Report Uploaded",
    message: `Your medical report "${fileName}" has been uploaded successfully.`,
    type: "success",
    link: `/patient/admissions/${admissionId}`,
    relatedAdmissionId: admissionId,
  });
};

/**
 * Notify admin when a new admission request arrives for their hospital
 */
const notifyAdminNewAdmission = async ({ adminUserId, patientName, disease, admissionId, urgency }) => {
  return createNotification({
    userId: adminUserId,
    title: "New Admission Request",
    message: `${patientName} submitted an admission request for "${disease}" (Urgency: ${urgency}).`,
    type: urgency === "Critical" || urgency === "High" ? "warning" : "info",
    link: `/admin/admissions/${admissionId}`,
    relatedAdmissionId: admissionId,
  });
};

/**
 * Notify patient when they are admitted
 */
const notifyAdmitted = async ({ userId, hospitalName, ward, admissionId }) => {
  return createNotification({
    userId,
    title: "Patient Admitted",
    message: `You have been admitted to ${hospitalName}.${ward ? ` Ward: ${ward}` : ""}`,
    type: "success",
    link: `/patient/admissions/${admissionId}`,
    relatedAdmissionId: admissionId,
  });
};

/**
 * Notify patient when discharged
 */
const notifyDischarged = async ({ userId, hospitalName, admissionId }) => {
  return createNotification({
    userId,
    title: "Patient Discharged",
    message: `You have been discharged from ${hospitalName}. We wish you a speedy recovery!`,
    type: "info",
    link: `/patient/admissions/${admissionId}`,
    relatedAdmissionId: admissionId,
  });
};

module.exports = {
  createNotification,
  notifyAdmissionSubmitted,
  notifyAdmissionApproved,
  notifyAdmissionRejected,
  notifyReportUploaded,
  notifyAdminNewAdmission,
  notifyAdmitted,
  notifyDischarged,
};
