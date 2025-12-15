// tests/unit/hospitalController.test.js
import { jest } from "@jest/globals";

/************************************
 * 1. FULL MONGOOSE MOCK
 ************************************/
const makeSessionMock = () => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(),
  abortTransaction: jest.fn().mockResolvedValue(),
  endSession: jest.fn()
});

const mongooseMock = {
  Schema: class {
    constructor(def) { this.obj = def; }
    static Types = { ObjectId: jest.fn() };
  },
  startSession: jest.fn().mockResolvedValue(makeSessionMock())
};

jest.unstable_mockModule("mongoose", () => ({ default: mongooseMock }));

/************************************
 * 2. MOCK MODELS WITH .session()
 ************************************/
function chainableReturn(obj) {
  return {
    session: () => Promise.resolve(obj)  // <— KEY FIX
  };
}

const HospitalMock = {
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  findByIdAndDelete: jest.fn()
};

jest.unstable_mockModule("../../models/Hospital.js", () => ({
  default: HospitalMock
}));

const DoctorProfileMock = {
  updateMany: jest.fn()
};

jest.unstable_mockModule("../../models/DoctorProfile.js", () => ({
  default: DoctorProfileMock
}));

/************************************
 * 3. IMPORT CONTROLLER AFTER MOCKS
 ************************************/
const hospitalCtrl = await import("../../controllers/hospitalController.js");

/************************************
 * 4. RESPONSE MOCK
 ************************************/
function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn()
  };
}

/************************************
 * 5. TEST SUITE
 ************************************/
describe("hospitalController – logic tests (FINAL FIXED)", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, params: {}, query: {} };
    res = mockRes();
  });

  /*******************************
   * createHospital
   *******************************/
  test("createHospital — success", async () => {
    HospitalMock.countDocuments.mockResolvedValue(3);
    HospitalMock.create.mockResolvedValue({ hospitalId: "HOSP0004" });

    req.body = { name: "Test Hospital" };

    await hospitalCtrl.createHospital(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  /*******************************
   * listHospitals
   *******************************/
  test("listHospitals — simple list", async () => {
    HospitalMock.find.mockReturnValue({
      limit: jest.fn().mockResolvedValue([{ name: "H1" }])
    });

    await hospitalCtrl.listHospitals(req, res);
    expect(res.json).toHaveBeenCalledWith([{ name: "H1" }]);
  });

  /*******************************
   * getHospital
   *******************************/
  test("getHospital — 404", async () => {
    HospitalMock.findById.mockResolvedValue(null);
    req.params.id = "x";

    await hospitalCtrl.getHospital(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("getHospital — success", async () => {
    HospitalMock.findById.mockResolvedValue({ _id: "h1" });
    req.params.id = "h1";

    await hospitalCtrl.getHospital(req, res);
    expect(res.json).toHaveBeenCalledWith({ _id: "h1" });
  });

  /*******************************
   * patchHospital
   *******************************/
  test("patchHospital — success", async () => {
    HospitalMock.findByIdAndUpdate.mockResolvedValue({ _id: "h1", name: "New" });

    req.params.id = "h1";
    req.body = { name: "New" };

    await hospitalCtrl.patchHospital(req, res);
    expect(res.json).toHaveBeenCalledWith({ _id: "h1", name: "New" });
  });

  /*******************************
   * addBranch
   *******************************/
  test("addBranch — hospital not found", async () => {
    HospitalMock.findById.mockResolvedValue(null);
    req.params.id = "h1";

    await hospitalCtrl.addBranch(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("addBranch — success", async () => {
    const hospitalObj = {
      branches: [],
      save: jest.fn().mockResolvedValue(true)
    };

    HospitalMock.findById.mockResolvedValue(hospitalObj);
    req.params.id = "h1";
    req.body = { name: "B1", address: "Addr" };

    await hospitalCtrl.addBranch(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  /*******************************
   * listBranches
   *******************************/
  test("listBranches — 404", async () => {
    HospitalMock.findById.mockResolvedValue(null);
    req.params.id = "h1";

    await hospitalCtrl.listBranches(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("listBranches — success", async () => {
    HospitalMock.findById.mockResolvedValue({ branches: [{ name: "B1" }] });
    req.params.id = "h1";

    await hospitalCtrl.listBranches(req, res);
    expect(res.json).toHaveBeenCalledWith([{ name: "B1" }]);
  });

  /*******************************
   * deleteHospital
   *******************************/
  test("deleteHospital — not found", async () => {
    const session = makeSessionMock();
    mongooseMock.startSession.mockResolvedValue(session);

    HospitalMock.findById.mockReturnValue(chainableReturn(null));

    req.params.id = "h1";
    await hospitalCtrl.deleteHospital(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("deleteHospital — success", async () => {
    const session = makeSessionMock();
    mongooseMock.startSession.mockResolvedValue(session);

    HospitalMock.findById.mockReturnValue(chainableReturn({ _id: "h1" }));
    DoctorProfileMock.updateMany.mockResolvedValue({});
    HospitalMock.findByIdAndDelete.mockReturnValue(chainableReturn({}));

    req.params.id = "h1";

    await hospitalCtrl.deleteHospital(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Hospital deleted successfully" })
    );
  });
});
