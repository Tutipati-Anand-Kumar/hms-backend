import { jest } from "@jest/globals";
import "./_setupMocks.js";
import { User } from "./_setupMocks.js";

const admin = await import("../../../controllers/adminController.js");

describe("updateAdminProfile", () => {
  let req, res, mockAdmin;

  beforeEach(() => {
    mockAdmin = {
      name: "Old",
      email: "e@e.com",
      mobile: "999",
      save: jest.fn().mockResolvedValue(true),
    };

    req = {
      user: { _id: "a1" },
      body: { name: "New Name", email: "new@test.com", mobile: "888" },
    };

    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  test("successfully updates admin", async () => {
    User.findById.mockResolvedValue(mockAdmin);

    await admin.updateAdminProfile(req, res);

    expect(mockAdmin.name).toBe("New Name");
    expect(mockAdmin.email).toBe("new@test.com");
    expect(mockAdmin.mobile).toBe("888");
    expect(res.json).toHaveBeenCalled();
  });

  test("returns 404 when admin not found", async () => {
    User.findById.mockResolvedValue(null);

    await admin.updateAdminProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("handles error on save()", async () => {
    User.findById.mockResolvedValue(mockAdmin);
    mockAdmin.save.mockRejectedValue(new Error("SAVE ERR"));

    await admin.updateAdminProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
