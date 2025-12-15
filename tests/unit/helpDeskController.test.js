import { jest } from "@jest/globals";

// 1. Mock Mongoose Helper to allow "await Query"
const mockQuery = (result) => {
  const q = {
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: (resolve, reject) => {
      if (result instanceof Error) reject(result);
      else resolve(result);
    },
    exec: jest.fn().mockResolvedValue(result),
  };
  return q;
};


// 2. Mock Modules using unstable_mockModule
jest.unstable_mockModule("mongoose", () => ({
  default: {
    Schema: class {
      constructor(def) { this.obj = def; }
      static Types = { ObjectId: jest.fn() };
    },
    model: jest.fn(),
    startSession: jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    }),
    Types: { ObjectId: { isValid: jest.fn().mockReturnValue(true) } }
  },
}));

jest.unstable_mockModule("../../utils/ApiError.js", () => ({
  default: class ApiError extends Error {
    constructor(statusCode, message) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

// Setup asyncHandler Mock - Mocking errorMiddleware.js because that's where the controller imports it from!
const mockAsyncHandlerVal = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    const status = error.statusCode || 500;
    if (res && res.status) {
      res.status(status).json({ message: error.message });
    }
  }
};

jest.unstable_mockModule("../../middleware/errorMiddleware.js", () => ({
  default: mockAsyncHandlerVal,
  notFound: jest.fn(),
  errorHandler: jest.fn(),
}));

const HelpDeskMock = {
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

jest.unstable_mockModule("../../models/HelpDesk.js", () => ({
  default: HelpDeskMock,
}));

jest.unstable_mockModule("../../models/User.js", () => ({ default: {} }));
jest.unstable_mockModule("../../models/Hospital.js", () => ({ default: {} }));
jest.unstable_mockModule("../../models/DoctorProfile.js", () => ({ default: {} }));

jest.unstable_mockModule("bcrypt", () => ({
  default: {
    compare: jest.fn(),
    hash: jest.fn().mockResolvedValue("hashed_secret"),
  },
}));

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    sign: jest.fn().mockReturnValue("mock_token"),
    verify: jest.fn().mockReturnValue({ id: "user_id" }),
  },
}));

jest.unstable_mockModule("crypto", () => ({
  default: {
    createHash: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue("hashed_token")
    }),
    randomBytes: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue("random_token")
    })
  }
}));


// 3. Dynamic Import of Controller (After Mocks)
const helpDeskController = await import("../../controllers/helpDeskController.js");
const bcrypt = (await import("bcrypt")).default;

describe("HelpDesk Controller Unit Tests", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      headers: {},
      helpDesk: null // Simulating authenticated user
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // --- Login ---
  describe("helpdeskLogin", () => {
    test("should return 400 if mobile or password missing", async () => {
      req.body = { mobile: "1234567890" }; // Missing password
      // Await the controller call.
      await helpDeskController.helpdeskLogin(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "mobile and password required" }));
    });

    test("should return 401 if user not found", async () => {
      req.body = { mobile: "9999", password: "pass" };
      HelpDeskMock.findOne.mockReturnValue(mockQuery(null));
      await helpDeskController.helpdeskLogin(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("should return 401 if password invalid", async () => {
      req.body = { mobile: "123", password: "wrong" };
      const mockHD = { password: "hashed" };
      HelpDeskMock.findOne.mockReturnValue(mockQuery(mockHD));
      bcrypt.compare.mockResolvedValue(false);

      await helpDeskController.helpdeskLogin(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("should login successfully", async () => {
      req.body = { mobile: "123", password: "right" };
      const mockHD = {
        _id: "hd123",
        password: "hashed",
        refreshTokens: [],
        save: jest.fn().mockResolvedValue(true)
      };
      HelpDeskMock.findOne.mockReturnValue(mockQuery(mockHD));
      bcrypt.compare.mockResolvedValue(true);

      await helpDeskController.helpdeskLogin(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        tokens: expect.any(Object),
        user: expect.objectContaining({ id: "hd123" })
      }));
    });
  });

  // --- Refresh Token ---
  describe("helpdeskRefresh", () => {
    test("should return 400 if no token provided", async () => {
      await helpDeskController.helpdeskRefresh(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("should return 401 if invalid refresh token (user not found)", async () => {
      req.body = { refreshToken: "bad_token" };
      HelpDeskMock.findOne.mockReturnValue(mockQuery(null));
      await helpDeskController.helpdeskRefresh(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // --- Get Me ---
  describe("helpdeskMe", () => {
    test("should return helpdesk profile", async () => {
      req.helpDesk = { _id: "hd1" };
      const mockProfile = { _id: "hd1", name: "Test HelpDesk", email: "test@hd.com" };
      HelpDeskMock.findById.mockReturnValue(mockQuery(mockProfile));

      await helpDeskController.helpdeskMe(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: "Test HelpDesk" }));
    });

    test("should return 401 if not authenticated", async () => {
      // req.helpDesk is null
      await helpDeskController.helpdeskMe(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // --- Get By ID ---
  describe("getHelpDeskById", () => {
    test("should return 404 if not found", async () => {
      req.params.id = "invalid_id";
      HelpDeskMock.findById.mockReturnValue(mockQuery(null));
      await helpDeskController.getHelpDeskById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // --- Update Profile ---
  describe("updateHelpdeskProfile", () => {
    test("should return 401 if not authenticated", async () => {
      await helpDeskController.updateHelpdeskProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

});
