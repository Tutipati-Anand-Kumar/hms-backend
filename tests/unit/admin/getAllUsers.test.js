import { jest } from "@jest/globals";
import "./_setupMocks.js";
import { User, HelpDesk, DoctorProfile, mongoose } from "./_setupMocks.js";
const admin = await import("../../../controllers/adminController.js");

describe("getAllUsers", () => {
    let req, res;

    beforeEach(() => {
        req = { query: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });

    test("returns doctor list", async () => {
        req.query.role = "doctor";

        DoctorProfile.find.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue([
                    {
                        user: { toObject: () => ({ name: "Doc1", _id: "u1" }) },
                        specialties: ["cardio"],
                        qualifications: ["MBBS"],
                        experienceStart: "2012",
                        bio: "",
                        availability: [],
                        hospitals: [],
                        _id: "dp1"
                    }
                ])
            })
        });

        await admin.getAllUsers(req, res);
        expect(res.json).toHaveBeenCalled();
    });

    test("filters out doctor profiles with null user", async () => {
        req.query.role = "doctor";

        DoctorProfile.find.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue([
                    { user: null },
                    { user: { toObject: () => ({ name: "Valid" }) }, specialties: [] }
                ])
            })
        });

        await admin.getAllUsers(req, res);
        const result = res.json.mock.calls[0][0];
        expect(result.length).toBe(1);
        expect(result[0].name).toBe("Valid");
    });

    test("returns helpdesk list", async () => {
        req.query.role = "helpdesk";

        HelpDesk.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue([
                    {
                        toObject: () => ({ name: "HD" }),
                        hospital: { name: "HospitalA", _id: "h1" }
                    }
                ])
            })
        });

        await admin.getAllUsers(req, res);
        expect(res.json).toHaveBeenCalled();
    });

    test("returns patient list", async () => {
        req.query.role = "patient";

        User.find.mockReturnValue({
            select: jest.fn().mockResolvedValue([{ _id: "p1", toObject: () => ({ name: "Pat" }) }])
        });

        mongoose.model.mockReturnValue({
            find: jest.fn().mockResolvedValue([
                { user: "p1", toObject: () => ({ age: 25 }), _id: "pf1" }
            ])
        });

        await admin.getAllUsers(req, res);
        expect(res.json).toHaveBeenCalled();
    });

    test("handles DB errors", async () => {
        req.query.role = "doctor";
        DoctorProfile.find.mockImplementation(() => { throw new Error("DB FAIL"); });

        await admin.getAllUsers(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
