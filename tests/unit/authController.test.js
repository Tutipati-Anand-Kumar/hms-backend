/**
 * AUTH CONTROLLER — FINAL FULL WORKING UNIT TEST (ESM SAFE)
 */
import { jest } from "@jest/globals";

/* ============================================================
   MOCK fs
============================================================ */
const fsMock = {
  readFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true)
};
jest.unstable_mockModule("fs", () => ({
  default: fsMock
}));

/* ============================================================
   MOCK path (FULL FIX: export default + named)
============================================================ */
const pathMock = {
  join: jest.fn(() => "/mock/template.html"),
  dirname: jest.fn(() => "/mock"),
  resolve: jest.fn(() => "/mock/path")
};

jest.unstable_mockModule("path", () => ({
  default: {
    join: pathMock.join,
    dirname: pathMock.dirname,
    resolve: pathMock.resolve
  },
  join: pathMock.join,
  dirname: pathMock.dirname,
  resolve: pathMock.resolve
}));

/* ============================================================
   MOCK bcrypt
============================================================ */
const bcryptMock = {
  hash: jest.fn().mockResolvedValue("hashed_pwd"),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue("salt")
};
jest.unstable_mockModule("bcrypt", () => ({
  default: bcryptMock
}));

/* ============================================================
   MOCK crypto
============================================================ */
const cryptoMock = {
  randomBytes: jest.fn(() => Buffer.from("abcdabcdabcdabcd")),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => "hashed_value")
  }))
};
jest.unstable_mockModule("crypto", () => ({
  default: cryptoMock
}));

/* ============================================================
   MOCK jsonwebtoken
============================================================ */
const jwtMock = {
  sign: jest.fn(() => "signed_jwt")
};
jest.unstable_mockModule("jsonwebtoken", () => ({
  default: jwtMock
}));

/* ============================================================
   MOCK sendEmail
============================================================ */
const sendEmailMock = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule("../../utils/sendEmail.js", () => ({
  default: sendEmailMock
}));

/* ============================================================
   MOCK MODELS
============================================================ */
const UserMock = {
  findOne: jest.fn(),
  create: jest.fn()
};

const HelpDeskMock = {
  findOne: jest.fn()
};

const OTPMock = {
  findOne: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn()
};

const PatientProfileMock = {
  create: jest.fn()
};

jest.unstable_mockModule("../../models/User.js", () => ({ default: UserMock }));
jest.unstable_mockModule("../../models/HelpDesk.js", () => ({ default: HelpDeskMock }));
jest.unstable_mockModule("../../models/OTP.js", () => ({ default: OTPMock }));
jest.unstable_mockModule("../../models/PatientProfile.js", () => ({ default: PatientProfileMock }));

/* ============================================================
   IMPORT CONTROLLER AFTER MOCKING EVERYTHING
============================================================ */
const auth = await import("../../controllers/authController.js");
const fs = await import("fs");

/* ============================================================
   TEST SUITES
============================================================ */

/* ---------------------- SEND OTP ------------------------- */
describe("sendOtp()", () => {
  let req, res;

  beforeEach(() => {
    req = { body: { mobile: "9999", email: "a@b.com" } };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    jest.clearAllMocks();
  });

  test("400 if missing fields", async () => {
    req.body = {};
    await auth.sendOtp(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("sends OTP email", async () => {
    fs.default.readFileSync.mockReturnValue("<html>{{OTP}}</html>");
    OTPMock.create.mockResolvedValue({});

    await auth.sendOtp(req, res);

    expect(sendEmailMock).toHaveBeenCalled();
  });
});

/* ---------------------- VERIFY OTP ------------------------- */
describe("verifyOtp()", () => {
  let req, res;

  beforeEach(() => {
    req = { body: { mobile: "9999", otp: "123456" } };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    jest.clearAllMocks();
  });

  test("400 missing fields", async () => {
    req.body = {};
    await auth.verifyOtp(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("OTP verified", async () => {
    OTPMock.findOne.mockResolvedValue({ _id: "otp1" });
    await auth.verifyOtp(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "OTP verified" });
  });

  test("invalid OTP", async () => {
    OTPMock.findOne.mockResolvedValue(null);
    await auth.verifyOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ---------------------- REGISTER ---------------------------- */
describe("register()", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        name: "A",
        mobile: "9999",
        email: "a@b.com",
        password: "pwd",
        otp: "1234",
        consentGiven: true
      }
    };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    jest.clearAllMocks();
  });

  test("400 missing fields", async () => {
    req.body = {};
    await auth.register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("successful registration", async () => {
    UserMock.findOne.mockResolvedValue(null);
    OTPMock.findOne.mockResolvedValue({ _id: "otp1" });

    UserMock.create.mockResolvedValue({
      _id: "u1",
      refreshTokens: [],
      save: jest.fn()
    });

    await auth.register(req, res);
    expect(PatientProfileMock.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

/* ---------------------- LOGIN ------------------------------- */
describe("login()", () => {
  let req, res;

  beforeEach(() => {
    req = { body: { identifier: "9999", password: "pwd" } };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    jest.clearAllMocks();
  });

  test("400 missing fields", async () => {
    req.body = {};
    await auth.login(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("invalid credentials", async () => {
    UserMock.findOne.mockResolvedValue(null);
    await auth.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("login success", async () => {
    UserMock.findOne.mockResolvedValue({
      _id: "u1",
      password: "hashpwd",
      role: "patient",
      refreshTokens: [],
      save: jest.fn()
    });

    bcryptMock.compare.mockResolvedValue(true);

    await auth.login(req, res);
    expect(res.json).toHaveBeenCalled();
  });
});

/* ---------------------- FORGOT PASSWORD --------------------- */
describe("forgotPassword()", () => {
  let req, res;

  beforeEach(() => {
    req = { body: { email: "a@b.com" }, headers: { origin: "http://localhost:3000" } };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    jest.clearAllMocks();
    process.env.FRONTEND_URL = "http://localhost:3000";
  });

  test("400 missing email", async () => {
    req.body = {};
    await auth.forgotPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("email not registered", async () => {
    UserMock.findOne.mockResolvedValue(null);
    HelpDeskMock.findOne.mockResolvedValue(null);

    await auth.forgotPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("reset link sent", async () => {
    UserMock.findOne.mockResolvedValue({
      email: "a@b.com",
      save: jest.fn()
    });

    fs.default.existsSync.mockReturnValue(true);
    fs.default.readFileSync.mockReturnValue("<html>{{resetURL}}</html>");

    await auth.forgotPassword(req, res);
    expect(sendEmailMock).toHaveBeenCalled();
  });
});

/* ---------------------- RESET PASSWORD ---------------------- */
describe("resetPassword()", () => {
  let req, res;

  beforeEach(() => {
    req = { body: { token: "t1", newPwd: "newpass" } };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    jest.clearAllMocks();
  });

  test("400 missing fields", async () => {
    req.body = {};
    await auth.resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("reset ok", async () => {
    UserMock.findOne.mockResolvedValue({
      save: jest.fn()
    });

    await auth.resetPassword(req, res);
    expect(res.json).toHaveBeenCalled();
  });
});

/* ---------------------- LOGOUT ------------------------------ */
describe("logout()", () => {
  let req, res;

  beforeEach(() => {
    req = { body: { refreshToken: "aaa" } };
    res = {
      send: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    jest.clearAllMocks();
  });

  test("400 missing refreshToken", async () => {
    req.body = {};
    await auth.logout(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
