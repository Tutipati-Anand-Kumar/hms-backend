import { jest } from "@jest/globals";
import "./_setupMocks.js";

const admin = await import("../../../controllers/adminController.js");

describe("adminBulkHospitals", () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  test("returns taskId as 202 accepted", async () => {
    await admin.adminBulkHospitals(req, res);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: expect.any(String),
      })
    );
  });
});
