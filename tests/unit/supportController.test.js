import { jest } from "@jest/globals";

// 1. Mock Mongoose Helper
const mockQuery = (result) => ({
    then: (resolve, reject) => {
        if (result instanceof Error) reject(result);
        else resolve(result);
    },
    exec: jest.fn().mockResolvedValue(result),
});

// 2. Mock Modules
jest.unstable_mockModule("mongoose", () => ({
    default: {
        Schema: class { },
        model: jest.fn(),
        Types: { ObjectId: jest.fn() }
    },
}));

// Mock SupportRequest Model Class
const SupportRequestMock = {
    // static methods if any
};
class MockSupportRequestClass {
    constructor(data) { Object.assign(this, data); }
    save() { return Promise.resolve(this); }
}
Object.assign(MockSupportRequestClass, SupportRequestMock);
jest.unstable_mockModule("../../models/SupportRequest.js", () => ({ default: MockSupportRequestClass }));


// 3. Import Controller
const supportController = await import("../../controllers/supportController.js");

describe("Support Controller Unit Tests", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            user: { _id: "u1", name: "Test User", email: "test@example.com", role: "patient" },
            files: []
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe("createSupportRequest", () => {
        test("should create support request successfully", async () => {
            req.body = { subject: "Issue", message: "Help me", type: "technical" };
            const saveSpy = jest.spyOn(MockSupportRequestClass.prototype, 'save');

            await supportController.createSupportRequest(req, res);

            expect(saveSpy).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: "Support request submitted successfully."
            }));
        });

        test("should handle server error", async () => {
            req.body = { subject: "Issue", message: "Help" };
            jest.spyOn(MockSupportRequestClass.prototype, 'save').mockRejectedValue(new Error("DB Err"));

            await supportController.createSupportRequest(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Server Error" }));
        });
    });
});
