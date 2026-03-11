const mongoose = require("mongoose");

const medicalReportSchema = new mongoose.Schema(
  {
    admissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admission",
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true },        // original filename
    type: { type: String, required: true },        // MIME type
    url: { type: String, required: true },         // Cloudinary CDN URL
    cloudinaryPublicId: { type: String, required: true }, // for deletion
    size: { type: Number, required: true },        // bytes
    uploadedAt: { type: Date, default: Date.now },
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

// Compound index for admission+patient lookup (single-field indexes already created via inline index:true)
medicalReportSchema.index({ admissionId: 1, patientId: 1 });

module.exports = mongoose.model("MedicalReport", medicalReportSchema);
