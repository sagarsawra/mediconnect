require("dotenv").config({ path: "../../.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");

const User = require("../models/User");
const Hospital = require("../models/Hospital");
const Doctor = require("../models/Doctor");
const BedCategory = require("../models/BedCategory");
const Admission = require("../models/Admission");

const seedData = async () => {
  await connectDB();
  console.log("🌱 Starting seed...");

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Hospital.deleteMany({}),
    Doctor.deleteMany({}),
    BedCategory.deleteMany({}),
    Admission.deleteMany({}),
  ]);
  console.log("🗑️  Cleared existing data");

  // ── Hospitals ──────────────────────────────────────────────────────────────
  const hospitals = await Hospital.insertMany([
    {
      name: "Apollo Hospitals Nagpur",
      address: "Plot No. 14, Wardha Road",
      city: "Nagpur",
      state: "Maharashtra",
      phone: "+91-712-2222222",
      email: "nagpur@apollohospitals.com",
      rating: 4.8,
      reviewCount: 2840,
      totalBeds: 350,
      availableBeds: 42,
      icuBeds: 40,
      availableIcuBeds: 8,
      emergencyBeds: 20,
      availableEmergencyBeds: 5,
      specializations: ["Cardiology", "Oncology", "Neurology", "Orthopedics", "Nephrology"],
      facilities: ["24/7 Emergency", "MRI", "CT Scan", "Blood Bank", "Pharmacy", "ICU", "NICU"],
      accreditations: ["NABH", "JCI", "ISO 9001"],
      established: 2005,
      description: "Apollo Hospitals Nagpur is a premier multi-specialty hospital offering world-class medical care.",
      isVerified: true,
      tier: "Super Specialty",
      doctorCount: 150,
      nurseCount: 420,
    },
    {
      name: "Wockhardt Hospital Nagpur",
      address: "North Ambazari Road",
      city: "Nagpur",
      state: "Maharashtra",
      phone: "+91-712-3333333",
      email: "nagpur@wockhardt.com",
      rating: 4.5,
      reviewCount: 1920,
      totalBeds: 250,
      availableBeds: 35,
      icuBeds: 30,
      availableIcuBeds: 6,
      emergencyBeds: 15,
      availableEmergencyBeds: 3,
      specializations: ["Cardiology", "Neurosurgery", "Pediatrics", "Gynecology"],
      facilities: ["24/7 Emergency", "MRI", "CT Scan", "Blood Bank", "ICU", "PICU"],
      accreditations: ["NABH", "ISO 9001"],
      established: 2010,
      description: "Wockhardt Hospital brings together the best in medical expertise and technology.",
      isVerified: true,
      tier: "Advanced",
      doctorCount: 95,
      nurseCount: 280,
    },
    {
      name: "Care Hospital Nagpur",
      address: "Square Mill Road, Dharampeth",
      city: "Nagpur",
      state: "Maharashtra",
      phone: "+91-712-4444444",
      email: "nagpur@carehospitals.com",
      rating: 4.3,
      reviewCount: 1150,
      totalBeds: 180,
      availableBeds: 28,
      icuBeds: 20,
      availableIcuBeds: 4,
      emergencyBeds: 10,
      availableEmergencyBeds: 2,
      specializations: ["Gastroenterology", "Pulmonology", "Endocrinology"],
      facilities: ["24/7 Emergency", "CT Scan", "Blood Bank", "Pharmacy", "ICU"],
      accreditations: ["NABH"],
      established: 2015,
      description: "Care Hospital is a trusted name in healthcare, dedicated to quality medical services.",
      isVerified: true,
      tier: "Advanced",
      doctorCount: 72,
      nurseCount: 190,
    },
  ]);

  console.log(`✅ Seeded ${hospitals.length} hospitals`);

  // ── Admin Users ────────────────────────────────────────────────────────────
  const adminUsers = await User.insertMany([
    {
      name: "Dr. Priya Mehta",
      email: "admin@apollo.com",
      password: await bcrypt.hash("admin123456", 12),
      role: "HOSPITAL_ADMIN",
      hospitalId: hospitals[0]._id,
    },
    {
      name: "Dr. Rohan Sharma",
      email: "admin@wockhardt.com",
      password: await bcrypt.hash("admin123456", 12),
      role: "HOSPITAL_ADMIN",
      hospitalId: hospitals[1]._id,
    },
  ]);

  // Link adminId to hospitals
  await Hospital.findByIdAndUpdate(hospitals[0]._id, { adminId: adminUsers[0]._id });
  await Hospital.findByIdAndUpdate(hospitals[1]._id, { adminId: adminUsers[1]._id });

  console.log(`✅ Seeded ${adminUsers.length} admin users`);

  // ── Patient Users ──────────────────────────────────────────────────────────
  const patientUsers = await User.insertMany([
    {
      name: "Arjun Sharma",
      email: "patient@demo.com",
      password: await bcrypt.hash("patient123456", 12),
      role: "PATIENT",
    },
    {
      name: "Neha Patel",
      email: "neha@demo.com",
      password: await bcrypt.hash("patient123456", 12),
      role: "PATIENT",
    },
  ]);

  console.log(`✅ Seeded ${patientUsers.length} patient users`);

  // ── Doctors ────────────────────────────────────────────────────────────────
  const doctors = await Doctor.insertMany([
    { hospitalId: hospitals[0]._id, name: "Dr. Rajesh Kumar", specialization: "Cardiology", experience: 18, available: true },
    { hospitalId: hospitals[0]._id, name: "Dr. Sneha Patil", specialization: "Neurology", experience: 12, available: true },
    { hospitalId: hospitals[0]._id, name: "Dr. Amit Verma", specialization: "Oncology", experience: 20, available: false },
    { hospitalId: hospitals[0]._id, name: "Dr. Pooja Singh", specialization: "Orthopedics", experience: 15, available: true },
    { hospitalId: hospitals[0]._id, name: "Dr. Karan Shah", specialization: "Nephrology", experience: 10, available: true },
    { hospitalId: hospitals[1]._id, name: "Dr. Suresh Nair", specialization: "Cardiology", experience: 14, available: true },
    { hospitalId: hospitals[1]._id, name: "Dr. Divya Rao", specialization: "Neurosurgery", experience: 16, available: true },
    { hospitalId: hospitals[2]._id, name: "Dr. Manoj Gupta", specialization: "Gastroenterology", experience: 11, available: true },
  ]);

  console.log(`✅ Seeded ${doctors.length} doctors`);

  // ── Bed Categories ─────────────────────────────────────────────────────────
  const bedCategories = await BedCategory.insertMany([
    { hospitalId: hospitals[0]._id, category: "General Ward", ward: "A", total: 120, available: 18, occupied: 102 },
    { hospitalId: hospitals[0]._id, category: "Semi-Private", ward: "B", total: 80, available: 12, occupied: 68 },
    { hospitalId: hospitals[0]._id, category: "Private", ward: "C", total: 60, available: 7, occupied: 53 },
    { hospitalId: hospitals[0]._id, category: "ICU", ward: "ICU", total: 40, available: 8, occupied: 32 },
    { hospitalId: hospitals[0]._id, category: "NICU", ward: "NICU", total: 20, available: 3, occupied: 17 },
    { hospitalId: hospitals[0]._id, category: "Emergency", ward: "ER", total: 20, available: 5, occupied: 15 },
    { hospitalId: hospitals[1]._id, category: "General Ward", ward: "A", total: 100, available: 20, occupied: 80 },
    { hospitalId: hospitals[1]._id, category: "ICU", ward: "ICU", total: 30, available: 6, occupied: 24 },
    { hospitalId: hospitals[1]._id, category: "Emergency", ward: "ER", total: 15, available: 3, occupied: 12 },
    { hospitalId: hospitals[2]._id, category: "General Ward", ward: "A", total: 80, available: 15, occupied: 65 },
    { hospitalId: hospitals[2]._id, category: "ICU", ward: "ICU", total: 20, available: 4, occupied: 16 },
  ]);

  console.log(`✅ Seeded ${bedCategories.length} bed categories`);

  // ── Sample Admissions ──────────────────────────────────────────────────────
  await Admission.insertMany([
    {
      patientId: patientUsers[0]._id,
      patientName: "Arjun Sharma",
      patientAge: 34,
      patientGender: "Male",
      hospitalId: hospitals[0]._id,
      hospitalName: hospitals[0].name,
      disease: "Acute Chest Pain",
      symptoms: ["Chest Pain", "Shortness of Breath", "Dizziness"],
      urgency: "High",
      status: "UNDER_REVIEW",
      requestDate: new Date("2026-03-05T10:30:00Z"),
      reviewDate: new Date("2026-03-05T14:00:00Z"),
      timeline: [
        {
          status: "PENDING",
          timestamp: new Date("2026-03-05T10:30:00Z"),
          message: "Admission request submitted by patient.",
          performedBy: "Arjun Sharma",
          performedById: patientUsers[0]._id,
        },
        {
          status: "UNDER_REVIEW",
          timestamp: new Date("2026-03-05T14:00:00Z"),
          message: "Request is currently under review by hospital administration.",
          performedBy: "Dr. Priya Mehta",
          performedById: adminUsers[0]._id,
        },
      ],
    },
    {
      patientId: patientUsers[0]._id,
      patientName: "Arjun Sharma",
      patientAge: 34,
      patientGender: "Male",
      hospitalId: hospitals[1]._id,
      hospitalName: hospitals[1].name,
      disease: "Knee Replacement Surgery",
      symptoms: ["Knee Pain", "Swelling", "Limited Mobility"],
      urgency: "Low",
      status: "APPROVED",
      requestDate: new Date("2026-02-20T09:00:00Z"),
      reviewDate: new Date("2026-02-21T11:00:00Z"),
      admitDate: new Date("2026-03-10T08:00:00Z"),
      assignedDoctor: "Dr. Suresh Nair",
      assignedWard: "Orthopedic Ward B",
      adminNotes: "Surgery scheduled for March 12. Pre-op checkup on March 10.",
      timeline: [
        {
          status: "PENDING",
          timestamp: new Date("2026-02-20T09:00:00Z"),
          message: "Admission request submitted by patient.",
          performedBy: "Arjun Sharma",
          performedById: patientUsers[0]._id,
        },
        {
          status: "UNDER_REVIEW",
          timestamp: new Date("2026-02-20T15:30:00Z"),
          message: "Request is currently under review by hospital administration.",
          performedBy: "Dr. Rohan Sharma",
          performedById: adminUsers[1]._id,
        },
        {
          status: "APPROVED",
          timestamp: new Date("2026-02-21T11:00:00Z"),
          message: "Admission approved. Surgery scheduled for March 12.",
          performedBy: "Dr. Rohan Sharma",
          performedById: adminUsers[1]._id,
        },
      ],
    },
  ]);

  console.log("✅ Seeded sample admissions");

  console.log("\n🎉 Seed completed successfully!\n");
  console.log("──────────────────────────────────────");
  console.log("Demo Credentials:");
  console.log("  Patient :  patient@demo.com  / patient123456");
  console.log("  Admin 1 :  admin@apollo.com  / admin123456");
  console.log("  Admin 2 :  admin@wockhardt.com / admin123456");
  console.log("──────────────────────────────────────\n");

  await mongoose.connection.close();
  process.exit(0);
};

seedData().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
