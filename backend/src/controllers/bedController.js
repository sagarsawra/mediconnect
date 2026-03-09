const BedCategory = require("../models/BedCategory");
const Hospital = require("../models/Hospital");

/**
 * @desc   Get beds for a specific hospital
 * @route  GET /api/beds/hospital/:hospitalId
 * @access Public
 */
const getHospitalBeds = async (req, res) => {
  const beds = await BedCategory.find({ hospitalId: req.params.hospitalId });
  res.status(200).json({ success: true, data: { beds } });
};

/**
 * @desc   Create a new bed category (Admin)
 * @route  POST /api/beds
 * @access Private (HOSPITAL_ADMIN)
 */
const createBedCategory = async (req, res) => {
  const { category, ward, total, available, dailyRate } = req.body;

  const occupied = total - available;
  if (occupied < 0) {
    return res.status(400).json({ success: false, message: "Available beds cannot exceed total beds." });
  }

  const bed = await BedCategory.create({
    hospitalId: req.user.hospitalId,
    category,
    ward,
    total,
    available,
    occupied,
    dailyRate: dailyRate || 0,
  });

  // Update hospital's aggregate bed counts
  await syncHospitalBedCounts(req.user.hospitalId);

  res.status(201).json({ success: true, message: "Bed category created.", data: { bed } });
};

/**
 * @desc   Update bed availability (Admin)
 * @route  PUT /api/beds/:id
 * @access Private (HOSPITAL_ADMIN)
 */
const updateBedAvailability = async (req, res) => {
  const { available, total } = req.body;

  const bed = await BedCategory.findById(req.params.id);

  if (!bed) {
    return res.status(404).json({ success: false, message: "Bed category not found." });
  }

  // Verify ownership
  if (bed.hospitalId.toString() !== req.user.hospitalId?.toString()) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  const newTotal = total !== undefined ? total : bed.total;
  const newAvailable = available !== undefined ? available : bed.available;
  const newOccupied = newTotal - newAvailable;

  if (newOccupied < 0) {
    return res.status(400).json({ success: false, message: "Available beds cannot exceed total beds." });
  }

  bed.total = newTotal;
  bed.available = newAvailable;
  bed.occupied = newOccupied;
  await bed.save();

  // Sync aggregate counts on Hospital document
  await syncHospitalBedCounts(req.user.hospitalId);

  res.status(200).json({
    success: true,
    message: "Bed availability updated.",
    data: { bed },
  });
};

/**
 * @desc   Delete a bed category (Admin)
 * @route  DELETE /api/beds/:id
 * @access Private (HOSPITAL_ADMIN)
 */
const deleteBedCategory = async (req, res) => {
  const bed = await BedCategory.findById(req.params.id);

  if (!bed) {
    return res.status(404).json({ success: false, message: "Bed category not found." });
  }

  if (bed.hospitalId.toString() !== req.user.hospitalId?.toString()) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  await bed.deleteOne();
  await syncHospitalBedCounts(req.user.hospitalId);

  res.status(200).json({ success: true, message: "Bed category deleted." });
};

/**
 * Utility: Sync aggregate bed counts on Hospital document
 * Called after any bed update to keep hospital.availableBeds in sync
 */
const syncHospitalBedCounts = async (hospitalId) => {
  const beds = await BedCategory.find({ hospitalId });

  const totalBeds = beds.reduce((s, b) => s + b.total, 0);
  const availableBeds = beds.reduce((s, b) => s + b.available, 0);

  // Find ICU and Emergency specific beds
  const icuBeds = beds.filter((b) => b.category.toLowerCase().includes("icu"));
  const emergencyBeds = beds.filter((b) => b.category.toLowerCase().includes("emergency"));

  await Hospital.findByIdAndUpdate(hospitalId, {
    totalBeds,
    availableBeds,
    icuBeds: icuBeds.reduce((s, b) => s + b.total, 0),
    availableIcuBeds: icuBeds.reduce((s, b) => s + b.available, 0),
    emergencyBeds: emergencyBeds.reduce((s, b) => s + b.total, 0),
    availableEmergencyBeds: emergencyBeds.reduce((s, b) => s + b.available, 0),
  });
};

module.exports = { getHospitalBeds, createBedCategory, updateBedAvailability, deleteBedCategory };
