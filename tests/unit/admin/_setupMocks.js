import { jest } from "@jest/globals";

// Silence console logs
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => { });
  jest.spyOn(console, "warn").mockImplementation(() => { });
});

// Model Mock
export const modelMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  updateMany: jest.fn(),
  deleteOne: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
  populate: jest.fn(),
  save: jest.fn(),
  aggregate: jest.fn(),
});

// Session Mock
export const sessionMock = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
  inTransaction: jest.fn().mockReturnValue(true),
};

// Mock Modules
jest.unstable_mockModule("../../../models/User.js", () => ({
  default: modelMock()
}));
jest.unstable_mockModule("../../../models/Hospital.js", () => ({
  default: modelMock()
}));
jest.unstable_mockModule("../../../models/HelpDesk.js", () => ({
  default: modelMock()
}));
jest.unstable_mockModule("../../../models/DoctorProfile.js", () => ({
  default: modelMock()
}));

jest.unstable_mockModule("bcrypt", () => ({
  default: { hash: jest.fn().mockResolvedValue("hashed_pw") }
}));

jest.unstable_mockModule("mongoose", () => ({
  default: {
    startSession: jest.fn().mockResolvedValue(sessionMock),
    Types: { ObjectId: { isValid: jest.fn() } },
    model: jest.fn()
  }
}));

export const User = (await import("../../../models/User.js")).default;
export const HelpDesk = (await import("../../../models/HelpDesk.js")).default;
export const Hospital = (await import("../../../models/Hospital.js")).default;
export const DoctorProfile = (await import("../../../models/DoctorProfile.js")).default;
export const mongoose = (await import("mongoose")).default;
export const bcrypt = (await import("bcrypt")).default;
