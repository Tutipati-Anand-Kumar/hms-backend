import { jest } from "@jest/globals";
import "./_setupMocks.js";
import { User } from "./_setupMocks.js";

const admin = await import("../../../controllers/adminController.js");

describe("getAdminProfile", () => {
  let req, res;

  beforeEach(() => {
    req = { user: { _id: "a1" } };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  test("returns admin profile", async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ name: "Admin", _id: "a1" }),
    });

    await admin.getAdminProfile(req, res);

    expect(res.json).toHaveBeenCalledWith({
      name: "Admin",
      _id: "a1",
    });
  });

  test("returns 404 when admin not found", async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await admin.getAdminProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("handles DB error", async () => {
    User.findById.mockImplementation(() => {
      throw new Error("ERR");
    });

    await admin.getAdminProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
