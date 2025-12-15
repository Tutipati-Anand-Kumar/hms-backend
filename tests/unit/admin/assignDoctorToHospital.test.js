import { jest } from "@jest/globals";
import "./_setupMocks.js";
import {
    User,
    Hospital,
    DoctorProfile,
    mongoose,
    sessionMock,
} from "./_setupMocks.js";

const admin = await import("../../../controllers/adminController.js");

describe("assignDoctorToHospital", () => {
    let req, res;

    beforeEach(() => {
        req = { body: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });

    test("successfully assigns doctor to hospital", async () => {
        req.body = {
            doctorProfileId: "dp1",
            hospitalId: "h1",
            specialties: ["ortho"],
            consultationFee: 500,
        };

        mongoose.Types.ObjectId.isValid.mockReturnValue(true);

        Hospital.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                _id: "h1",
                doctors: [],
                save: jest.fn(),
            }),
        });

        DoctorProfile.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                _id: "dp1",
                hospitals: [],
                save: jest.fn(),
            }),
        });

        Hospital.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                _id: "h1",
                doctors: [],
                save: jest.fn(),
            }),
            populate: jest.fn().mockReturnValue({
                populate: jest
                    .fn()
                    .mockResolvedValue({ doctors: [{ doctor: { name: "D" } }] }),
            }),
        });

        await admin.assignDoctorToHospital(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
    });

    test("returns 404 when hospital not found", async () => {
        req.body = { doctorProfileId: "dp1", hospitalId: "h1" };

        mongoose.Types.ObjectId.isValid.mockReturnValue(true);

        Hospital.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(null),
        });

        await admin.assignDoctorToHospital(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 404 when doctorProfile not found", async () => {
        req.body = { doctorProfileId: "dp1", hospitalId: "h1" };

        mongoose.Types.ObjectId.isValid.mockReturnValue(true);

        Hospital.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({}),
        });

        DoctorProfile.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(null),
        });

        await admin.assignDoctorToHospital(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("doctor already assigned to hospital", async () => {
        req.body = { doctorProfileId: "dp1", hospitalId: "h1" };

        mongoose.Types.ObjectId.isValid.mockReturnValue(true);

        Hospital.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                doctors: [{ doctor: "dp1" }],
            }),
        });

        DoctorProfile.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({ _id: "dp1" }),
        });

        await admin.assignDoctorToHospital(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("handles invalid ObjectId gracefully", async () => {
        mongoose.Types.ObjectId.isValid.mockImplementation(() => {
            throw new Error("Invalid ID");
        });

        await admin.assignDoctorToHospital(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
