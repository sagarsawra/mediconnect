const mongoose = require("mongoose");

const bedCategorySchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      // e.g., "General Ward", "ICU", "NICU", "Private", "Semi-Private", "Emergency", "Post-Op"
    },
    ward: { type: String, required: true, trim: true },
    total: { type: Number, required: true, min: 0 },
    available: { type: Number, required: true, min: 0 },
    occupied: { type: Number, required: true, min: 0 },
    dailyRate: { type: Number, default: 0 }, // Cost per day in INR
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/**
 * Validate that available + occupied = total before saving
 */
bedCategorySchema.pre("save", function (next) {
  if (this.available + this.occupied !== this.total) {
    return next(new Error(`Bed counts mismatch: available(${this.available}) + occupied(${this.occupied}) ≠ total(${this.total})`));
  }
  next();
});

bedCategorySchema.index({ hospitalId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model("BedCategory", bedCategorySchema);
