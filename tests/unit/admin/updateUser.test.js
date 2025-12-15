import "./_setupMocks.js";
import { User } from "./_setupMocks.js";
import { jest } from "@jest/globals";
const admin = await import("../../../controllers/adminController.js");

describe("updateUser", () => {
    let req, res;

    beforeEach(() => {
        req = { params: {}, body: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });

    test("updates user", async () => {
        req.params.id = "u1";
        req.body = { name: "New" };

        User.findByIdAndUpdate.mockResolvedValue({ _id: "u1", name: "New" });

        await admin.updateUser(req, res);
        expect(res.json).toHaveBeenCalled();
    });

    test("returns 404", async () => {
        req.params.id = "u1";
        User.findByIdAndUpdate.mockResolvedValue(null);

        await admin.updateUser(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("handles error", async () => {
        User.findByIdAndUpdate.mockImplementation(() => { throw new Error("ERR"); });

        await admin.updateUser(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
