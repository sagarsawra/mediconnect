/**
 * Build a timeline event object to be pushed to admission.timeline[]
 */
const buildTimelineEvent = ({ status, message, performedBy, performedById }) => {
  return {
    status,
    timestamp: new Date(),
    message,
    performedBy,
    performedById: performedById || null,
  };
};

/**
 * Status-to-message mapping for standard transitions
 */
const STATUS_MESSAGES = {
  PENDING: "Admission request submitted by patient.",
  UNDER_REVIEW: "Request is currently under review by hospital administration.",
  APPROVED: "Admission request has been approved. Please report to the hospital.",
  REJECTED: "Admission request has been rejected.",
  ADMITTED: "Patient has been successfully admitted.",
  DISCHARGED: "Patient has been discharged from the hospital.",
};

/**
 * Get default message for a given status
 */
const getDefaultMessage = (status) => STATUS_MESSAGES[status] || `Status changed to ${status}`;

module.exports = { buildTimelineEvent, getDefaultMessage };
