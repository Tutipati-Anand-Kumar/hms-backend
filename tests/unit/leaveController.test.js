import { jest } from "@jest/globals";

// 1. Mock Mongoose Helper
const mockQuery = (result) => ({
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
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

// Mock Models
const LeaveMock = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
};
jest.unstable_mockModule("../../models/Leave.js", () => ({ default: LeaveMock }));

const DoctorProfileMock = {
    findOne: jest.fn(),
};
jest.unstable_mockModule("../../models/DoctorProfile.js", () => ({ default: DoctorProfileMock }));

const HelpDeskMock = {
    findOne: jest.fn(),
};
jest.unstable_mockModule("../../models/HelpDesk.js", () => ({ default: HelpDeskMock }));

// Mock Notification Controller
const NotificationMock = {
    createNotification: jest.fn(),
};
jest.unstable_mockModule("../../controllers/notificationController.js", () => NotificationMock);


// 3. Import Controller
const leaveController = await import("../../controllers/leaveController.js");

describe("Leave Controller Unit Tests", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            user: { _id: "user1", role: "doctor", name: "Doc" },
            io: { to: jest.fn().mockReturnThis(), emit: jest.fn() }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe("requestLeave", () => {
        test("should return 403 if not a doctor", async () => {
            req.user.role = "patient";
            await leaveController.requestLeave(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Only doctors can request leave" }));
        });

        test("should return 400 if start date > end date", async () => {
            req.body = { startDate: "2025-12-10", endDate: "2025-12-09" };
            await leaveController.requestLeave(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "End date must be after or equal to start date" }));
        });

        test("should return 404 if doctor profile not found", async () => {
            req.body = { startDate: "2025-12-10", endDate: "2025-12-11" };
            DoctorProfileMock.findOne.mockResolvedValue(null);
            await leaveController.requestLeave(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test("should apply logic for assigned helpdesk and create leave", async () => {
            req.body = { startDate: "2025-12-10", endDate: "2025-12-11", reason: "Sick" };
            DoctorProfileMock.findOne.mockResolvedValue({ assignedHelpdesk: "hd1" });
            LeaveMock.create.mockResolvedValue({ _id: "leave1", assignedHelpdesk: "hd1" });

            await leaveController.requestLeave(req, res);

            expect(LeaveMock.create).toHaveBeenCalledWith(expect.objectContaining({
                doctorId: "user1",
                assignedHelpdesk: "hd1"
            }));
            expect(NotificationMock.createNotification).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test("should fallback to hospital helpdesk if no assigned helpdesk", async () => {
            req.body = { startDate: "2025-12-10", endDate: "2025-12-11" };
            DoctorProfileMock.findOne.mockResolvedValue({
                assignedHelpdesk: null,
                hospitals: [{ hospital: "hosp1" }]
            });
            HelpDeskMock.findOne.mockResolvedValue({ _id: "hd_fallback" });
            LeaveMock.create.mockResolvedValue({ _id: "leave2", assignedHelpdesk: "hd_fallback" });

            await leaveController.requestLeave(req, res);

            expect(HelpDeskMock.findOne).toHaveBeenCalledWith({ hospital: "hosp1" });
            expect(LeaveMock.create).toHaveBeenCalledWith(expect.objectContaining({ assignedHelpdesk: "hd_fallback" }));
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe("getLeaves", () => {
        test("should filter by doctorId if user is doctor", async () => {
            req.user = { _id: "doc1", role: "doctor" };
            LeaveMock.find.mockReturnValue(mockQuery([{ _id: "l1" }]));

            await leaveController.getLeaves(req, res);

            expect(LeaveMock.find).toHaveBeenCalledWith({ doctorId: "doc1" });
            expect(res.json).toHaveBeenCalled();
        });

        test("should filter by assignedHelpdesk if user is helpdesk", async () => {
            req.user = { _id: "hd1", role: "helpdesk" };
            LeaveMock.find.mockReturnValue(mockQuery([{ _id: "l1" }]));

            await leaveController.getLeaves(req, res);

            expect(LeaveMock.find).toHaveBeenCalledWith({ assignedHelpdesk: "hd1" });
        });
    });

    describe("updateLeaveStatus", () => {
        test("should return 400 for invalid status", async () => {
            req.params.id = "l1";
            req.body.status = "invalid";
            await leaveController.updateLeaveStatus(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 404 if leave not found", async () => {
            req.params.id = "l1";
            req.body.status = "approved";
            LeaveMock.findById.mockResolvedValue(null);
            await leaveController.updateLeaveStatus(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test("should return 403 if helpdesk not authorized", async () => {
            req.params.id = "l1";
            req.body.status = "approved";
            req.user = { _id: "hd1", role: "helpdesk" };

            LeaveMock.findById.mockResolvedValue({
                assignedHelpdesk: "hd2", // Different helpdesk
                save: jest.fn()
            });

            await leaveController.updateLeaveStatus(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Not authorized to manage this leave request" }));
        });

        test("should update status and notify doctor", async () => {
            req.params.id = "l1";
            req.body.status = "approved";
            req.user = { _id: "hd1", role: "helpdesk" };

            const leaveObj = {
                _id: "l1",
                doctorId: "doc1",
                assignedHelpdesk: "hd1",
                save: jest.fn().mockResolvedValue(true)
            };
            LeaveMock.findById.mockResolvedValue(leaveObj);

            await leaveController.updateLeaveStatus(req, res);

            expect(leaveObj.status).toBe("approved");
            expect(leaveObj.save).toHaveBeenCalled();
            expect(NotificationMock.createNotification).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalled();
        });
    });
});
