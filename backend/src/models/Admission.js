const mongoose = require("mongoose");

/**
 * Embedded Timeline Event sub-schema
 * Stored inside each Admission document for fast timeline retrieval
 */
const timelineEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "ADMITTED", "DISCHARGED"],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    message: { type: String, required: true },
    performedBy: { type: String, required: true }, // display name
    performedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true }
);

const admissionSchema = new mongoose.Schema(
  {
    // Patient info
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    patientName: { type: String, required: true },
    patientAge: { type: Number, required: true, min: 0, max: 150 },
    patientGender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true,
    },
    patientPhone: { type: String, default: null },

    // Hospital info
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    hospitalName: { type: String, required: true },

    // Medical info
    disease: { type: String, required: true, trim: true },
    symptoms: [{ type: String, trim: true }],
    urgency: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },

    // Status lifecycle
    status: {
      type: String,
      enum: ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "ADMITTED", "DISCHARGED"],
      default: "PENDING",
      index: true,
    },

    // Dates
    requestDate: { type: Date, default: Date.now },
    reviewDate: { type: Date, default: null },
    admitDate: { type: Date, default: null },
    dischargeDate: { type: Date, default: null },

    // Assignment info (set by admin on approval)
    assignedDoctor: { type: String, default: null },
    assignedDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },

    // Notes
    adminNotes: { type: String, default: null },
    patientNotes: { type: String, default: null },

    // Embedded timeline — max ~20 events per admission lifecycle
    timeline: [timelineEventSchema],

    // References to uploaded reports
    reports: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MedicalReport",
      },
    ],

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

// Compound indexes for common query patterns
admissionSchema.index({ hospitalId: 1, status: 1 });
admissionSchema.index({ patientId: 1, createdAt: -1 });
admissionSchema.index({ hospitalId: 1, createdAt: -1 });
admissionSchema.index({ urgency: 1, status: 1 });

module.exports = mongoose.model("Admission", admissionSchema);