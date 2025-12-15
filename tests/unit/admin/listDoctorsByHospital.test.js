import { jest } from "@jest/globals";
import "./_setupMocks.js";
import { Hospital } from "./_setupMocks.js";

const admin = await import("../../../controllers/adminController.js");

describe("listDoctorsByHospital", () => {
  let req, res;

  beforeEach(() => {
    req = { params: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  test("successfully lists doctors", async () => {
    req.params.id = "h1";

    Hospital.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        doctors: [
          { doctor: { name: "John" }, specialties: ["ortho"] }
        ]
      }),
    });

    await admin.listDoctorsByHospital(req, res);

    expect(res.json).toHaveBeenCalled();
  });

  test("returns 404 when hospital not found", async () => {
    req.params.id = "h1";

    Hospital.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });

    await admin.listDoctorsByHospital(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("handles DB error", async () => {
    req.params.id = "h1";

    Hospital.findById.mockImplementation(() => {
      throw new Error("ERR DB");
    });

    await admin.listDoctorsByHospital(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
