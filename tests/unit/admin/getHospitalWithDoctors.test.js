import { jest } from "@jest/globals";
import "./_setupMocks.js";
import { Hospital } from "./_setupMocks.js";

const admin = await import("../../../controllers/adminController.js");

describe("getHospitalWithDoctors", () => {
  let req, res;

  beforeEach(() => {
    req = { params: {} };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  test("returns hospital with doctors", async () => {
    req.params.id = "h1";

    Hospital.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: "h1",
        name: "City Hospital",
        doctors: [],
      }),
    });

    await admin.getHospitalWithDoctors(req, res);

    expect(res.json).toHaveBeenCalled();
  });

  test("404 if hospital missing", async () => {
    req.params.id = "h1";

    Hospital.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });

    await admin.getHospitalWithDoctors(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("handles DB errors", async () => {
    req.params.id = "h1";

    Hospital.findById.mockImplementation(() => {
      throw new Error("DB ERR");
    });

    await admin.getHospitalWithDoctors(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
