const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hospital name is required"],
      trim: true,
      index: true,
    },
    address: { type: String, required: true },
    city: { type: String, required: true, index: true },
    state: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    website: { type: String, default: null },
    logo: { type: String, default: null },
    coverImage: { type: String, default: null },

    // Rating system
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },

    // Bed inventory — live counters
    totalBeds: { type: Number, default: 0, min: 0 },
    availableBeds: { type: Number, default: 0, min: 0 },
    icuBeds: { type: Number, default: 0, min: 0 },
    availableIcuBeds: { type: Number, default: 0, min: 0 },
    emergencyBeds: { type: Number, default: 0, min: 0 },
    availableEmergencyBeds: { type: Number, default: 0, min: 0 },

    // Medical capabilities
    specializations: [{ type: String, trim: true }],
    facilities: [{ type: String, trim: true }],
    accreditations: [{ type: String, trim: true }],

    // Metadata
    established: { type: Number },
    description: { type: String, maxlength: 2000 },
    isVerified: { type: Boolean, default: false },
    tier: {
      type: String,
      enum: ["Basic", "Advanced", "Super Specialty"],
      default: "Basic",
    },

    // Staff counts (denormalized for fast listing)
    doctorCount: { type: Number, default: 0 },
    nurseCount: { type: Number, default: 0 },

    // Location for geo queries (optional future upgrade)
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },

    // Admin user who manages this hospital
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

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

// Compound text index for full-text search
hospitalSchema.index({ name: "text", description: "text", specializations: "text" });
hospitalSchema.index({ city: 1, rating: -1 });
hospitalSchema.index({ tier: 1 });
hospitalSchema.index({ location: "2dsphere" }); // for geo queries

module.exports = mongoose.model("Hospital", hospitalSchema);
