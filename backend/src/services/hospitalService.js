const Hospital = require("../models/Hospital");

/**
 * Build a Mongoose query object for hospital search.
 * Supports partial, case-insensitive matches on name, city, and specialization.
 *
 * @param {Object} params - Destructured query params
 * @returns {Object} Mongoose query
 */
const buildHospitalSearchQuery = ({ name, city, specialization }) => {
  const query = { isActive: true };

  if (name) query.name = { $regex: name, $options: "i" };
  if (city) query.city = { $regex: city, $options: "i" };
  if (specialization) {
    query.specializations = { $elemMatch: { $regex: specialization, $options: "i" } };
  }

  return query;
};

/**
 * Search hospitals with pagination.
 *
 * @param {Object} params - Search + pagination params
 * @returns {{ hospitals, total, page, totalPages }}
 */
const searchHospitals = async ({ name, city, specialization, page = 1, limit = 10 }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const query = buildHospitalSearchQuery({ name, city, specialization });

  const [hospitals, total] = await Promise.all([
    Hospital.find(query)
      .sort({ rating: -1, name: 1 })
      .skip(skip)
      .limit(limitNum)
      .select("-adminId -location -__v")
      .lean(),
    Hospital.countDocuments(query),
  ]);

  return {
    hospitals,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

module.exports = {
  searchHospitals,
  buildHospitalSearchQuery,
};
