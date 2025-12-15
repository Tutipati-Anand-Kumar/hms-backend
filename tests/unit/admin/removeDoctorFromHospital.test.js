import { jest } from "@jest/globals";
import "./_setupMocks.js";
import {
    Hospital,
    DoctorProfile,
    sessionMock,
} from "./_setupMocks.js";

const admin = await import("../../../controllers/adminController.js");

describe("removeDoctorFromHospital", () => {
    let req, res;

    beforeEach(() => {
        req = { params: {}, body: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });

    test("success - removes doctor from hospital", async () => {
        req.params.hospitalId = "h1";
        req.body.doctorProfileId = "dp1";

        Hospital.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                doctors: [{ doctor: "dp1" }],
                save: jest.fn(),
            }),
        });

        DoctorProfile.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({
                hospitals: [{ hospital: "h1" }],
                save: jest.fn(),
            }),
        });

        await admin.removeDoctorFromHospital(req, res);

        expect(res.json).toHaveBeenCalled();
        expect(sessionMock.commitTransaction).toHaveBeenCalled();
    });

    test("404 if hospital not found", async () => {
        req.params.hospitalId = "h1";
        req.body.doctorProfileId = "dp1";

        Hospital.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(null),
        });

        DoctorProfile.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({}),
        });

        await admin.removeDoctorFromHospital(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("rollback on DB error", async () => {
        req.params.hospitalId = "h1";
        req.body.doctorProfileId = "dp1";

        Hospital.findById.mockImplementation(() => {
            throw new Error("DB Error");
        });

        await admin.removeDoctorFromHospital(req, res);

        expect(sessionMock.abortTransaction).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
