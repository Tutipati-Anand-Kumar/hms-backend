import { jest } from "@jest/globals";
import "./_setupMocks.js";
import { HelpDesk, Hospital } from "./_setupMocks.js";

const admin = await import("../../../controllers/adminController.js");

describe("assignHelpdeskToHospital", () => {
    let req, res;

    beforeEach(() => {
        req = { body: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });

    test("successfully assigns helpdesk to hospital", async () => {
        req.body = { helpdeskId: "hd1", hospitalId: "h1" };

        HelpDesk.findById.mockResolvedValue({ save: jest.fn() });
        Hospital.findById.mockResolvedValue({ _id: "h1" });

        await admin.assignHelpdeskToHospital(req, res);

        expect(res.json).toHaveBeenCalled();
    });

    test("returns 404 if helpdesk not found", async () => {
        req.body = { helpdeskId: "hd1", hospitalId: "h1" };

        HelpDesk.findById.mockResolvedValue(null);

        await admin.assignHelpdeskToHospital(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 404 if hospital not found", async () => {
        req.body = { helpdeskId: "hd1", hospitalId: "h1" };

        HelpDesk.findById.mockResolvedValue({});
        Hospital.findById.mockResolvedValue(null);

        await admin.assignHelpdeskToHospital(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
