const mongoose = require("mongoose");

/**
 * Doctor Schema
 *
 * Represents a doctor that belongs to a hospital.
 * Doctors can be assigned to patient admissions via Admission.assignedDoctorId.
 *
 * Fields align with the Admission model's `assignedDoctorId` (ObjectId → Doctor)
 * and `assignedDoctor` (String display name) references.
 */
const doctorSchema = new mongoose.Schema(
  {
    // Core identification
    name: {
      type: String,
      required: [true, "Doctor name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    specialization: {
      type: String,
      required: [true, "Specialization is required"],
      trim: true,
      index: true,
    },

    // Foreign key — which hospital this doctor belongs to
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: [true, "Hospital ID is required"],
      index: true,
    },

    // Professional details
    experience: {
      type: Number,
      min: [0, "Experience cannot be negative"],
      default: 0,
    },

    qualifications: [{ type: String, trim: true }],

    // Contact info
    contactNumber: { type: String, default: null },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },

    // Availability flag (operational scheduling)
    available: { type: Boolean, default: true },

    // Profile image
    avatar: { type: String, default: null },

    // Soft-delete flag
    isActive: { type: Boolean, default: true },
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

// ─── Indexes ─────────────────────────────────────────────────────────────────
// Primary lookup patterns
doctorSchema.index({ hospitalId: 1, specialization: 1 });
doctorSchema.index({ hospitalId: 1, available: 1 });
doctorSchema.index({ hospitalId: 1, isActive: 1 });

module.exports = mongoose.model("Doctor", doctorSchema);
