import { jest } from "@jest/globals";
import "./_setupMocks.js";

const admin = await import("../../../controllers/adminController.js");

describe("adminBroadcast", () => {
  let req, res;

  beforeEach(() => {
    req = { body: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  test("success with title + body", async () => {
    req.body = { title: "Alert", body: "System update" };

    await admin.adminBroadcast(req, res);
    expect(res.json).toHaveBeenCalled();
  });

  test("missing fields => 400", async () => {
    req.body = { title: "Alert" };

    await admin.adminBroadcast(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
