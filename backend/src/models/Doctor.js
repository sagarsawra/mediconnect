const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    specialization: { type: String, required: true, trim: true },
    experience: { type: Number, required: true, min: 0 }, // years
    available: { type: Boolean, default: true },
    avatar: { type: String, default: null },
    qualifications: [{ type: String }],
    phone: { type: String, default: null },
    email: { type: String, default: null, lowercase: true },
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

doctorSchema.index({ hospitalId: 1, specialization: 1 });
doctorSchema.index({ hospitalId: 1, available: 1 });

module.exports = mongoose.model("Doctor", doctorSchema);
