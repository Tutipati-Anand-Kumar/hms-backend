// tests/unit/doctorController.test.js
import { jest } from "@jest/globals";

/*************************************************
 * FIXED CHAIN MOCK — behaves like real Mongoose
 *************************************************/
function makeChain(result) {
  const chain = {};

  chain.__data = result;

  chain.populate = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);

  chain.lean = jest.fn().mockResolvedValue(result);
  chain.exec = jest.fn().mockResolvedValue(result);

  chain.then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject);

  return chain;
}

/*************************************************
 * MOCK Mongoose Types
 *************************************************/
const mongooseMock = {
  Types: {
    ObjectId: {
      isValid: jest.fn()
    }
  }
};

jest.unstable_mockModule("mongoose", () => ({ default: mongooseMock }));

/*************************************************
 * MOCK MODELS (NO CLASS FIELDS!)
 *************************************************/

// DoctorProfile
class DoctorProfileMock {
  constructor(data = {}) {
    Object.assign(this, data);
    this.quickNotes = this.quickNotes || [];
    this.hospitals = this.hospitals || [];
    this._id = this._id || "dp-mock";
  }

  save() {
    return Promise.resolve(this);
  }
}

// ❌ REMOVE CLASS FIELDS — Jest cannot parse them.
// ✔ Attach static methods AFTER class definition.
DoctorProfileMock.findOne = jest.fn();
DoctorProfileMock.find = jest.fn();
DoctorProfileMock.findById = jest.fn();
DoctorProfileMock.findOneAndUpdate = jest.fn();

DoctorProfileMock.prototype.save = jest.fn().mockImplementation(function () {
  return Promise.resolve(this);
});

jest.unstable_mockModule("../../models/DoctorProfile.js", () => ({
  default: DoctorProfileMock
}));

// User
const UserMock = {
  findByIdAndUpdate: jest.fn(),
  findOne: jest.fn()
};

jest.unstable_mockModule("../../models/User.js", () => ({
  default: UserMock
}));

// PatientProfile
const PatientProfileMock = {
  findOne: jest.fn(),
  find: jest.fn()
};

jest.unstable_mockModule("../../models/PatientProfile.js", () => ({
  default: PatientProfileMock
}));

// Appointment
const AppointmentMock = {
  updateMany: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOne: jest.fn(),
  aggregate: jest.fn(),
  find: jest.fn()
};

jest.unstable_mockModule("../../models/Appointment.js", () => ({
  default: AppointmentMock
}));

// Prescription
const PrescriptionMock = { find: jest.fn() };
jest.unstable_mockModule("../../models/Prescription.js", () => ({
  default: PrescriptionMock
}));

// Report
const ReportMock = { find: jest.fn() };
jest.unstable_mockModule("../../models/Report.js", () => ({
  default: ReportMock
}));

// Leave
const LeaveMock = { find: jest.fn() };
jest.unstable_mockModule("../../models/Leave.js", () => ({
  default: LeaveMock
}));

/*************************************************
 * IMPORT CONTROLLER AFTER ALL MOCKS
 *************************************************/
const doctorCtrl = await import("../../controllers/doctorController.js");

const DoctorProfile = (await import("../../models/DoctorProfile.js")).default;
const User = (await import("../../models/User.js")).default;
const PatientProfile =
  (await import("../../models/PatientProfile.js")).default;
const Appointment = (await import("../../models/Appointment.js")).default;
const Prescription =
  (await import("../../models/Prescription.js")).default;
const Report = (await import("../../models/Report.js")).default;
const Leave = (await import("../../models/Leave.js")).default;
const mongoose = (await import("mongoose")).default;

/*************************************************
 * TEST SUITE
 *************************************************/
describe("doctorController (unit tests) – FINAL FIXED", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = { user: { _id: "user1" }, params: {}, query: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mongoose.Types.ObjectId.isValid.mockImplementation(
      (v) => typeof v === "string" && v.length > 0
    );
  });

  /*******************************************
   * getDoctorProfile
   *******************************************/
  test("getDoctorProfile - unauthorized", async () => {
    req.user = null;

    await doctorCtrl.getDoctorProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("getDoctorProfile - 404 if no profile", async () => {
    DoctorProfile.findOne.mockReturnValue(makeChain(null));

    await doctorCtrl.getDoctorProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("getDoctorProfile - success", async () => {
    const profile = { _id: "dp1", user: { name: "Dr X" } };

    DoctorProfile.findOne.mockReturnValue(makeChain(profile));

    await doctorCtrl.getDoctorProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(profile);
  });

  /*******************************************
   * updateDoctorProfile
   *******************************************/
  test("updateDoctorProfile - upsert new profile", async () => {
    DoctorProfile.findOne.mockResolvedValue(null);

    const savedProfile = new DoctorProfile({
      _id: "newProf",
      hospitals: []
    });

    DoctorProfile.prototype.save.mockResolvedValue(savedProfile);

    DoctorProfile.findById.mockReturnValue(makeChain(savedProfile));

    User.findByIdAndUpdate.mockResolvedValue({});

    req.body = {
      bio: "hello",
      specialties: ["Card"],
      name: "Doc Updated",
      profilePic: "pic.png"
    };

    req.user = { _id: "user-doctor" };

    await doctorCtrl.updateDoctorProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(savedProfile);
  });

  /*******************************************
   * searchDoctors
   *******************************************/
  test("searchDoctors - returns list", async () => {
    const doctors = [{ _id: "d1" }];

    DoctorProfile.find.mockReturnValue(makeChain(doctors));

    req.query = { speciality: "Cardiology" };

    await doctorCtrl.searchDoctors(req, res);

    expect(res.json).toHaveBeenCalledWith(doctors);
  });

  /*******************************************
   * getDoctorById
   *******************************************/
  test("getDoctorById - me but no auth", async () => {
    req.params = { id: "me" };
    req.user = null;

    await doctorCtrl.getDoctorById(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("getDoctorById - profile found", async () => {
    const prof = { _id: "p1" };

    DoctorProfile.findOne.mockReturnValue(makeChain(prof));

    req.params = { id: "valid" };

    await doctorCtrl.getDoctorById(req, res);

    expect(res.json).toHaveBeenCalledWith(prof);
  });

  /*******************************************
   * getPatientDetails
   *******************************************/
  test("getPatientDetails - 404 if no profile", async () => {
    PatientProfile.findOne.mockReturnValue(makeChain(null));

    req.params = { patientId: "p1" };

    await doctorCtrl.getPatientDetails(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("getPatientDetails - returns merged details", async () => {
    req.params = { patientId: "p1" };

    const patient = {
      user: { _id: "p1", name: "Pat", email: "p@e", mobile: "999" },
      dob: "2000-01-01",
      conditions: "c"
    };

    PatientProfile.findOne.mockReturnValue(makeChain(patient));

    Appointment.find.mockReturnValue(makeChain([{ _id: "a1" }]));
    Prescription.find.mockReturnValue(makeChain([{ _id: "pr1" }]));
    Report.find.mockReturnValue(makeChain([{ _id: "r1" }]));

    await doctorCtrl.getPatientDetails(req, res);

    const output = res.json.mock.calls[0][0];
    expect(output.personal.name).toBe("Pat");
  });

  /*******************************************
   * uploadPhoto
   *******************************************/
  test("uploadPhoto - no file", async () => {
    req.file = null;

    await doctorCtrl.uploadPhoto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  /*******************************************
   * startNextAppointment
   *******************************************/
  test("startNextAppointment - 404 if no profile", async () => {
    DoctorProfile.findOne.mockResolvedValue(null);

    await doctorCtrl.startNextAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  /*******************************************
   * getDoctorPatients
   *******************************************/
  test("getDoctorPatients - return [] when no doctor profile", async () => {
    DoctorProfile.findOne.mockResolvedValue(null);

    await doctorCtrl.getDoctorPatients(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("getDoctorPatients - builds list", async () => {
    DoctorProfile.findOne.mockResolvedValue({ _id: "dp1", user: "user1" });

    const appointments = [
      { patient: "p1", hospital: "h1", reason: "r1", date: new Date() }
    ];

    Appointment.find.mockReturnValue(makeChain(appointments));

    const profiles = [
      {
        user: { _id: "p1", name: "A", email: "e", mobile: "m" },
        hospitalRecords: [{ hospital: "h1", mrn: "MRN1" }]
      }
    ];

    PatientProfile.find.mockReturnValue(makeChain(profiles));

    await doctorCtrl.getDoctorPatients(req, res);

    const out = res.json.mock.calls[0][0];
    expect(out[0].mrn).toBe("MRN1");
  });

  /*******************************************
   * getDoctorAppointmentsByDate
   *******************************************/
  test("getDoctorAppointmentsByDate - returns list", async () => {
    req.query = { date: "2025-01-01" };

    DoctorProfile.findOne.mockResolvedValue({ _id: "dp1" });

    const appts = [{ _id: "a1" }];
    Appointment.find.mockReturnValue(makeChain(appts));

    await doctorCtrl.getDoctorAppointmentsByDate(req, res);

    expect(res.json).toHaveBeenCalledWith(appts);
  });
});
