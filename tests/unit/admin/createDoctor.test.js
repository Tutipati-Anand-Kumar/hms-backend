import "./_setupMocks.js";
import { User, DoctorProfile, Hospital, mongoose, sessionMock } from "./_setupMocks.js";
const admin = await import("../../../controllers/adminController.js");
import { jest } from "@jest/globals";

describe("createDoctor", () => {
    let req, res;

    beforeEach(() => {
        req = { body: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });

    test("creates doctor successfully", async () => {
        req.body = {
            name: "Doc",
            email: "e",
            mobile: "m",
            password: "p",
            assignHospitals: []
        };

        User.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
        User.create.mockResolvedValue([{ _id: "u_new" }]);
        DoctorProfile.create.mockResolvedValue([{ _id: "dp_new", hospitals: [], save: jest.fn() }]);

        DoctorProfile.findById.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue({})
            })
        });

        await admin.createDoctor(req, res);
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test("assigns doctor to hospital", async () => {
        req.body = {
            name: "D",
            email: "e",
            mobile: "m",
            password: "p",
            assignHospitals: [{ hospitalId: "h1", specialties: ["ortho"] }]
        };

        User.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
        User.create.mockResolvedValue([{ _id: "u1" }]);
        DoctorProfile.create.mockResolvedValue([{ _id: "dp1", hospitals: [], save: jest.fn() }]);

        mongoose.Types.ObjectId.isValid.mockReturnValue(true);

        Hospital.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                _id: "h1",
                doctors: [],
                save: jest.fn()
            })
        });

        DoctorProfile.findById.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue({})
            })
        });

        await admin.createDoctor(req, res);
        expect(sessionMock.commitTransaction).toHaveBeenCalled();
    });

    test("skip invalid hospitalId gracefully", async () => {
        req.body = {
            name: "D",
            email: "e",
            mobile: "m",
            password: "p",
            assignHospitals: [{ hospitalId: "INVALID" }]
        };

        User.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
        User.create.mockResolvedValue([{ _id: "u1" }]);
        DoctorProfile.create.mockResolvedValue([{ _id: "dp1", hospitals: [], save: jest.fn() }]);

        mongoose.Types.ObjectId.isValid.mockReturnValue(false);
        Hospital.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });

        DoctorProfile.findById.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue({})
            })
        });

        await admin.createDoctor(req, res);
        expect(sessionMock.commitTransaction).toHaveBeenCalled();
    });

    test("rollback when create fails", async () => {
        User.findOne.mockImplementation(() => { throw new Error("ERR"); });

        await admin.createDoctor(req, res);
        expect(sessionMock.abortTransaction).toHaveBeenCalled();
    });

    test("400 when email exists", async () => {
        User.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(true) });

        await admin.createDoctor(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
});
