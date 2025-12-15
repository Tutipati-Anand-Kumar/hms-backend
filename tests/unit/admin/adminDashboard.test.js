import { jest } from "@jest/globals";
import "./_setupMocks.js";
import { User, HelpDesk, Hospital } from "./_setupMocks.js";

const admin = await import("../../../controllers/adminController.js");

describe("adminDashboard", () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  test("returns all dashboard stats", async () => {
    User.countDocuments
      .mockResolvedValueOnce(5) // doctors
      .mockResolvedValueOnce(20) // patients
      .mockResolvedValueOnce(2) // admins
      .mockResolvedValueOnce(27); // total users

    HelpDesk.countDocuments.mockResolvedValue(3);
    Hospital.countDocuments.mockResolvedValue(7);
    User.aggregate.mockResolvedValue([]); // Mock activity stats
    User.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([])
    });

    await admin.adminDashboard(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      totalUsers: 27 + 3,
      totalDoctors: 5,
      totalPatients: 20,
      totalHospitals: 7,
      totalAdmins: 2,
      totalHelpDesks: 3,
    }));
  });

  test("handles DB error", async () => {
    User.countDocuments.mockRejectedValue(new Error("DB ERR"));

    await admin.adminDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
