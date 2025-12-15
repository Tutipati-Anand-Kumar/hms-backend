import "./_setupMocks.js";
import { User, DoctorProfile, Hospital, sessionMock } from "./_setupMocks.js";
const admin = await import("../../../controllers/adminController.js");
import { jest } from "@jest/globals";

describe("deleteUser", () => {
    let req, res;

    beforeEach(() => {
        req = { params: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });

    test("deletes normal user", async () => {
        req.params.id = "u1";

        User.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({ _id: "u1", role: "patient" })
        });

        User.findByIdAndDelete.mockReturnValue({
            session: jest.fn().mockResolvedValue({})
        });

        await admin.deleteUser(req, res);

        expect(sessionMock.commitTransaction).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ message: "User deleted" });
    });

    test("deletes doctor with profile", async () => {
        req.params.id = "u1";

        User.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue({ _id: "u1", role: "doctor" })
        });

        DoctorProfile.findOne.mockReturnValue({
            session: jest.fn().mockResolvedValue({ _id: "dp1" })
        });

        Hospital.updateMany.mockReturnValue({
            session: jest.fn().mockResolvedValue({})
        });

        DoctorProfile.deleteOne.mockReturnValue({
            session: jest.fn().mockResolvedValue({})
        });

        User.findByIdAndDelete.mockReturnValue({
            session: jest.fn().mockResolvedValue({})
        });

        await admin.deleteUser(req, res);
        expect(Hospital.updateMany).toHaveBeenCalled();
    });

    test("returns 404 when user not found", async () => {
        req.params.id = "x";

        User.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(null)
        });

        await admin.deleteUser(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("rollback on DB error", async () => {
        User.findById.mockImplementation(() => { throw new Error("ERR"); });

        await admin.deleteUser(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(sessionMock.abortTransaction).toHaveBeenCalled();
    });
});
