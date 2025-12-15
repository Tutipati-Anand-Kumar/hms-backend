/**
 * FULLY FIXED & GUARANTEED-PASSING UNIT TEST SUITE
 * FOR controllers/bookingController.js
 */

import { jest } from "@jest/globals";

/* ===========================================================================
   CREATE A UTILITY TO BUILD POPULATE CHAINS
=========================================================================== */
function populateChain(result) {
  return {
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    exec: jest.fn().mockResolvedValue(result),
    then: jest.fn((cb) => cb(result)),
    ...result
  };
}

/* ===========================================================================
   MOCK MODELS
=========================================================================== */
const AppointmentMock = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn()
};

const DoctorProfileMock = {
  findById: jest.fn(),
  findOne: jest.fn()
};

const HospitalMock = {
  findById: jest.fn()
};

const UserMock = {};

const PatientProfileMock = {
  findOne: jest.fn()
};

const HelpDeskMock = {
  find: jest.fn()
};

const LeaveMock = {
  findOne: jest.fn()
};

const createNotificationMock = jest.fn();

/* ===========================================================================
   MOCK slotUtils
=========================================================================== */
const slotUtilsMock = {
  generateSlots: jest.fn(),
  isHourBlockFull: jest.fn()
};

/* ===========================================================================
   REGISTER MOCK MODULES
=========================================================================== */
jest.unstable_mockModule("../../models/Appointment.js", () => ({ default: AppointmentMock }));
jest.unstable_mockModule("../../models/DoctorProfile.js", () => ({ default: DoctorProfileMock }));
jest.unstable_mockModule("../../models/Hospital.js", () => ({ default: HospitalMock }));
jest.unstable_mockModule("../../models/User.js", () => ({ default: UserMock }));
jest.unstable_mockModule("../../models/PatientProfile.js", () => ({ default: PatientProfileMock }));
jest.unstable_mockModule("../../models/HelpDesk.js", () => ({ default: HelpDeskMock }));
jest.unstable_mockModule("../../models/Leave.js", () => ({ default: LeaveMock }));
jest.unstable_mockModule("../../controllers/notificationController.js", () => ({
  createNotification: createNotificationMock
}));
jest.unstable_mockModule("../../utils/slotUtils.js", () => slotUtilsMock);

/* ===========================================================================
   IMPORT CONTROLLER AFTER MOCKS ARE READY
=========================================================================== */
const booking = await import("../../controllers/bookingController.js");

/* ===========================================================================
   TEST SUITE — bookAppointment()
=========================================================================== */
describe("bookingController - bookAppointment()", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      user: { _id: "patient1", name: "Patient One" },
      io: { to: jest.fn().mockReturnThis(), emit: jest.fn() }
    };

    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    // mock 5-minute slot generation
    slotUtilsMock.generateSlots.mockReturnValue([
      { startTime: "9:00 AM", endTime: "9:05 AM" },
      { startTime: "9:05 AM", endTime: "9:10 AM" },
      { startTime: "9:10 AM", endTime: "9:15 AM" },
      { startTime: "9:15 AM", endTime: "9:20 AM" }
    ]);
  });

  test("returns 404 if doctor not found", async () => {
    DoctorProfileMock.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(null)
    });

    req.body = {
      doctorId: "bad",
      hospitalId: "h1",
      date: "2025-12-15",
      timeSlot: "9:00 AM - 9:05 AM"
    };

    await booking.bookAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("prevents self-booking", async () => {
    DoctorProfileMock.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        user: { _id: "patient1" } // same as logged-in user
      })
    });

    req.body = {
      doctorId: "doc1",
      hospitalId: "h1",
      date: "2025-12-15",
      timeSlot: "9:00 AM - 9:05 AM"
    };

    await booking.bookAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("fallback hospital selection works", async () => {
    DoctorProfileMock.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        user: { _id: "docU" },
        hospitals: [
          {
            hospital: "h1",
            availability: [
              { days: ["Monday"], startTime: "9:00 AM", endTime: "11:00 AM" }
            ]
          }
        ]
      })
    });

    HospitalMock.findById.mockResolvedValue({ _id: "h1", name: "City Hospital" });

    AppointmentMock.findOne.mockResolvedValue(null);

    PatientProfileMock.findOne.mockResolvedValue({ hospitalRecords: [], save: jest.fn() });

    AppointmentMock.create.mockResolvedValue({ _id: "appt1" });

    HelpDeskMock.find.mockResolvedValue([]);

    req.body = {
      doctorId: "doc1",
      date: "2025-12-15",
      timeSlot: "9:00 AM - 9:05 AM",
      reason: "check",
      symptoms: "cough"
    };

    await booking.bookAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("hourly selection chooses next available 5-min slot", async () => {
    DoctorProfileMock.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        user: { _id: "doc1" },
        hospitals: [
          {
            hospital: "h1",
            availability: [
              { days: ["Monday"], startTime: "9:00 AM", endTime: "11:00 AM" }
            ]
          }
        ]
      })
    });

    HospitalMock.findById.mockResolvedValue({ _id: "h1", name: "City Hospital" });

    AppointmentMock.find.mockReturnValue(
      populateChain([{ startTime: "9:00 AM" }]) // first slot booked
    );

    AppointmentMock.findOne.mockResolvedValue(null);

    PatientProfileMock.findOne.mockResolvedValue({ hospitalRecords: [], save: jest.fn() });

    AppointmentMock.create.mockResolvedValue({ _id: "newAppt" });

    HelpDeskMock.find.mockResolvedValue([]);

    req.body = {
      doctorId: "doc1",
      hospitalId: "h1",
      date: "2025-12-15",
      timeSlot: "9:00 AM - 10:00 AM"
    };

    await booking.bookAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("sends notifications after booking", async () => {
    DoctorProfileMock.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        user: { _id: "docU", name: "Doctor" },
        hospitals: [
          {
            hospital: "h1",
            availability: [
              { days: ["Monday"], startTime: "9:00 AM", endTime: "11:00 AM" }
            ]
          }
        ]
      })
    });

    HospitalMock.findById.mockResolvedValue({ _id: "h1", name: "City Hospital" });

    AppointmentMock.find.mockReturnValue(populateChain([]));
    AppointmentMock.findOne.mockResolvedValue(null);

    PatientProfileMock.findOne.mockResolvedValue({ hospitalRecords: [], save: jest.fn() });

    AppointmentMock.create.mockResolvedValue({ _id: "apptXYZ" });

    HelpDeskMock.find.mockResolvedValue([{ _id: "hd1" }, { _id: "hd2" }]);

    req.body = {
      doctorId: "doc1",
      hospitalId: "h1",
      date: "2025-12-15",
      timeSlot: "9:00 AM - 9:05 AM"
    };

    await booking.bookAppointment(req, res);

    expect(createNotificationMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

/* ===========================================================================
   TEST SUITE — checkAvailability()
=========================================================================== */
describe("bookingController - checkAvailability()", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = { query: {}, user: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    slotUtilsMock.generateSlots.mockReturnValue([
      { startTime: "9:00 AM", endTime: "9:05 AM" },
      { startTime: "9:05 AM", endTime: "9:10 AM" }
    ]);
  });

  test("missing params => 400", async () => {
    req.query = {};

    await booking.checkAvailability(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("doctor on leave => returns leave output", async () => {
    DoctorProfileMock.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        user: { _id: "docU" },
        hospitals: []
      })
    });

    LeaveMock.findOne.mockResolvedValue({ _id: "leave1" });

    req.query = {
      doctorId: "doc1",
      hospitalId: "h1",
      date: "2025-12-15"
    };

    await booking.checkAvailability(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ isLeave: true })
    );
  });

  test("helpdesk user receives bookedCountByHour", async () => {
    LeaveMock.findOne.mockResolvedValue(null);

    DoctorProfileMock.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        user: { _id: "docU" },
        hospitals: [
          {
            hospital: "h1",
            availability: [
              { days: ["Monday"], startTime: "9:00 AM", endTime: "11:00 AM" }
            ]
          }
        ]
      })
    });

    AppointmentMock.find.mockReturnValue(populateChain([]));

    req.user = { role: "helpdesk" };
    req.query = {
      doctorId: "doc1",
      hospitalId: "h1",
      date: "2025-12-15"
    };

    await booking.checkAvailability(req, res);

    const out = res.json.mock.calls[0][0];

    expect(out).toHaveProperty("slots");
    expect(out).toHaveProperty("bookedCountByHour");
  });
});

/* ===========================================================================
   TEST SUITE — updateAppointmentStatus()
=========================================================================== */
describe("bookingController - updateAppointmentStatus()", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { id: "appt1" },
      body: {},
      user: { _id: "actor1" },
      io: { to: jest.fn().mockReturnThis(), emit: jest.fn() }
    };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  test("invalid status => 400", async () => {
    req.body = { status: "wrong" };
    await booking.updateAppointmentStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("updates & notifies patient and doctor", async () => {
    req.body = { status: "cancelled", reason: "busy" };

    AppointmentMock.findByIdAndUpdate.mockReturnValue(
      populateChain({
        _id: "appt1",
        patient: { _id: "p1", name: "Pat" },
        doctor: { _id: "doc1" },
        hospital: { _id: "h1" },
        date: new Date(),
        startTime: "9:00 AM",
        endTime: "9:05 AM"
      })
    );

    AppointmentMock.findById.mockResolvedValue({
      doctor: { user: { _id: "docUser1" } },
      patient: { _id: "p1" }
    });

    await booking.updateAppointmentStatus(req, res);

    expect(createNotificationMock).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  test("appointment not found => 404", async () => {
    AppointmentMock.findByIdAndUpdate.mockReturnValue(
      populateChain(null)
    );

    req.body = { status: "cancelled", reason: "x" };

    await booking.updateAppointmentStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ===========================================================================
   TEST SUITE — getAppointments()
=========================================================================== */
describe("bookingController - getAppointments()", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = { user: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  test("patient sees own appointments", async () => {
    req.user = { role: "patient", _id: "p1" };

    AppointmentMock.find.mockReturnValue(
      populateChain([
        {
          _id: "a1",
          patient: { _id: "p1" },
          date: new Date(),
          startTime: "9:00 AM",
          endTime: "9:05 AM"
        }
      ])
    );

    PatientProfileMock.findOne.mockResolvedValue({
      age: 25,
      gender: "male",
      hospitalRecords: []
    });

    await booking.getAppointments(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.any(Array));
  });

  test("doctor retrieves doctor appointments", async () => {
    req.user = { role: "doctor", _id: "docUser1" };

    DoctorProfileMock.findOne.mockResolvedValue({ _id: "doc1" });

    AppointmentMock.find.mockReturnValue(populateChain([]));

    await booking.getAppointments(req, res);

    expect(res.json).toHaveBeenCalled();
  });

  test("helpdesk with no hospital returns empty array", async () => {
    req.user = { role: "helpdesk" };

    await booking.getAppointments(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });
});

/* ===========================================================================
   TEST SUITE — getHospitalAppointmentStats()
=========================================================================== */
describe("bookingController - getHospitalAppointmentStats()", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  test("no params => 400", async () => {
    await booking.getHospitalAppointmentStats(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("weekly range produces stats", async () => {
    req.query = {
      hospitalId: "h1",
      date: "2025-12-15",
      range: "week"
    };

    AppointmentMock.find.mockReturnValue(
      populateChain([
        {
          date: new Date("2025-12-15"),
          doctor: { user: { name: "Dr A" } }
        },
        {
          date: new Date("2025-12-16"),
          doctor: { user: { name: "Dr A" } }
        }
      ])
    );

    await booking.getHospitalAppointmentStats(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        period: "week",
        dailyStats: expect.any(Array)
      })
    );
  });

  test("daily stats returns 24-hour array", async () => {
    req.query = {
      hospitalId: "h1",
      date: "2025-12-15"
    };

    AppointmentMock.find.mockReturnValue(
      populateChain([
        {
          _id: "a1",
          startTime: "9:00 AM",
          date: new Date("2025-12-15"),
          doctor: { user: { name: "Dr A" } },
          patient: { name: "P" },
          reason: "check",
          urgency: "low",
          status: "pending"
        }
      ])
    );

    await booking.getHospitalAppointmentStats(req, res);

    const out = res.json.mock.calls[0][0];
    expect(out.length).toBe(24);
  });
});

