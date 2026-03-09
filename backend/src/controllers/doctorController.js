const Doctor = require("../models/Doctor");
const Hospital = require("../models/Hospital");

/**
 * @desc   Get doctors for a hospital
 * @route  GET /api/doctors/hospital/:hospitalId
 * @access Public
 */
const getHospitalDoctors = async (req, res) => {
  const { specialization, available } = req.query;
  const query = { hospitalId: req.params.hospitalId, isActive: true };

  if (specialization) query.specialization = new RegExp(specialization, "i");
  if (available !== undefined) query.available = available === "true";

  const doctors = await Doctor.find(query).sort({ name: 1 });

  res.status(200).json({ success: true, data: { doctors } });
};

/**
 * @desc   Add a doctor to hospital (Admin)
 * @route  POST /api/doctors
 * @access Private (HOSPITAL_ADMIN)
 */
const createDoctor = async (req, res) => {
  const { name, specialization, experience, available, qualifications, phone, email } = req.body;

  const doctor = await Doctor.create({
    hospitalId: req.user.hospitalId,
    name,
    specialization,
    experience,
    available: available !== undefined ? available : true,
    qualifications: qualifications || [],
    phone: phone || null,
    email: email || null,
  });

  // Increment hospital doctorCount
  await Hospital.findByIdAndUpdate(req.user.hospitalId, { $inc: { doctorCount: 1 } });

  res.status(201).json({ success: true, message: "Doctor added successfully.", data: { doctor } });
};

/**
 * @desc   Update doctor info (Admin)
 * @route  PUT /api/doctors/:id
 * @access Private (HOSPITAL_ADMIN)
 */
const updateDoctor = async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);

  if (!doctor) {
    return res.status(404).json({ success: false, message: "Doctor not found." });
  }

  if (doctor.hospitalId.toString() !== req.user.hospitalId?.toString()) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  const allowedUpdates = ["name", "specialization", "experience", "available", "avatar", "qualifications", "phone", "email"];
  const updates = {};
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const updatedDoctor = await Doctor.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, message: "Doctor updated.", data: { doctor: updatedDoctor } });
};

/**
 * @desc   Delete (deactivate) a doctor (Admin)
 * @route  DELETE /api/doctors/:id
 * @access Private (HOSPITAL_ADMIN)
 */
const deleteDoctor = async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);

  if (!doctor) {
    return res.status(404).json({ success: false, message: "Doctor not found." });
  }

  if (doctor.hospitalId.toString() !== req.user.hospitalId?.toString()) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  // Soft delete
  doctor.isActive = false;
  await doctor.save();

  await Hospital.findByIdAndUpdate(req.user.hospitalId, { $inc: { doctorCount: -1 } });

  res.status(200).json({ success: true, message: "Doctor removed from hospital." });
};

module.exports = { getHospitalDoctors, createDoctor, updateDoctor, deleteDoctor };
