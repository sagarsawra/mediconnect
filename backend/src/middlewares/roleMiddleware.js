/**
 * Restrict access to specific roles
 * Usage: authorize("HOSPITAL_ADMIN") or authorize("PATIENT", "HOSPITAL_ADMIN")
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}. Your role: ${req.user.role}.`,
      });
    }

    next();
  };
};

/**
 * Verify that a HOSPITAL_ADMIN belongs to the requested hospital
 */
const verifyHospitalOwnership = (hospitalIdParam = "hospitalId") => {
  return (req, res, next) => {
    if (req.user.role !== "HOSPITAL_ADMIN") return next();

    const requestedHospitalId = req.params[hospitalIdParam] || req.body[hospitalIdParam];

    if (!requestedHospitalId) return next();

    if (req.user.hospitalId?.toString() !== requestedHospitalId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only manage your own hospital.",
      });
    }

    next();
  };
};

module.exports = { authorize, verifyHospitalOwnership };
