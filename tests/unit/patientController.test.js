import { jest } from "@jest/globals";

// 1. Mock Mongoose Helper
const mockQuery = (result) => ({
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    then: (resolve, reject) => {
        if (result instanceof Error) reject(result);
        else resolve(result);
    },
    exec: jest.fn().mockResolvedValue(result),
});

// 2. Mock Modules
jest.unstable_mockModule("mongoose", () => ({
    default: {
        Schema: class { },
        model: jest.fn(),
        Types: { ObjectId: jest.fn() }
    },
}));

const PatientProfileMock = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
};
jest.unstable_mockModule("../../models/PatientProfile.js", () => ({ default: PatientProfileMock }));

const UserMock = {
    findByIdAndUpdate: jest.fn(),
};
jest.unstable_mockModule("../../models/User.js", () => ({ default: UserMock }));

// 3. Import Controller
const patientController = await import("../../controllers/patientController.js");

describe("Patient Controller Unit Tests", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            user: { _id: "u1" }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe("getProfile", () => {
        test("should return 404 if profile not found", async () => {
            PatientProfileMock.findOne.mockReturnValue(mockQuery(null));
            await patientController.getProfile(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Profile not found" }));
        });

        test("should return profile if found", async () => {
            const profile = { _id: "p1", user: { name: "Test" } };
            PatientProfileMock.findOne.mockReturnValue(mockQuery(profile));

            await patientController.getProfile(req, res);

            expect(PatientProfileMock.findOne).toHaveBeenCalledWith({ user: "u1" });
            expect(res.json).toHaveBeenCalledWith(profile);
        });

        test("should handle server error", async () => {
            const error = new Error("DB Error");
            PatientProfileMock.findOne.mockReturnValue(mockQuery(error));

            await patientController.getProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Server error" }));
        });
    });

    describe("updateProfile", () => {
        test("should update user and profile successfully", async () => {
            req.body = { name: "New Name", email: "new@test.com", mobile: "123", bloodGroup: "A+" };

            const updatedProfile = { _id: "p1", bloodGroup: "A+" };
            PatientProfileMock.findOneAndUpdate.mockReturnValue(mockQuery(updatedProfile));
            UserMock.findByIdAndUpdate.mockResolvedValue(true);

            await patientController.updateProfile(req, res);

            expect(UserMock.findByIdAndUpdate).toHaveBeenCalledWith("u1", expect.objectContaining({
                $set: { name: "New Name", email: "new@test.com", mobile: "123" }
            }));
            expect(PatientProfileMock.findOneAndUpdate).toHaveBeenCalledWith(
                { user: "u1" },
                { $set: { bloodGroup: "A+", mobile: "123" } },
                { new: true, upsert: true }
            );
            expect(res.json).toHaveBeenCalledWith(updatedProfile);
        });

        test("should only update profile if no user fields provided", async () => {
            req.body = { bloodGroup: "B+" }; // No name/email/mobile

            PatientProfileMock.findOneAndUpdate.mockReturnValue(mockQuery({}));

            await patientController.updateProfile(req, res);

            expect(UserMock.findByIdAndUpdate).not.toHaveBeenCalled();
            expect(PatientProfileMock.findOneAndUpdate).toHaveBeenCalledWith(
                { user: "u1" },
                { $set: { bloodGroup: "B+" } }, // no name/email in body
                expect.any(Object)
            );
        });

        test("should handle duplicate mobile error (11000)", async () => {
            const err = new Error("Duplicate");
            err.code = 11000;
            err.keyPattern = { mobile: 1 };

            UserMock.findByIdAndUpdate.mockRejectedValue(err);
            req.body = { mobile: "duplicate" };

            await patientController.updateProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("phone number is already registered") }));
        });

        test("should handle generic duplicate error (11000)", async () => {
            const err = new Error("Duplicate");
            err.code = 11000;
            // No keyPattern or different one
            UserMock.findByIdAndUpdate.mockRejectedValue(err);
            req.body = { email: "duplicate" };

            await patientController.updateProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Duplicate field value entered" }));
        });
    });
});
