import { jest } from "@jest/globals";

// 1. Mock Mongoose Helper
const mockQuery = (result) => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
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

const NotificationMock = {
    create: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    findOneAndDelete: jest.fn(),
    deleteMany: jest.fn(),
};
jest.unstable_mockModule("../../models/Notification.js", () => ({ default: NotificationMock }));

// Dynamic Import Mock for DoctorProfile
const DoctorProfileMock = {
    find: jest.fn()
};
jest.unstable_mockModule("../../models/DoctorProfile.js", () => ({ default: DoctorProfileMock }));

// 3. Import Controller
const notificationController = await import("../../controllers/notificationController.js");

describe("Notification Controller Unit Tests", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            user: { _id: "u1", name: "Admin" },
            io: { to: jest.fn().mockReturnThis(), emit: jest.fn() }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe("createNotification (Helper)", () => {
        test("should create notification in DB", async () => {
            const data = { recipient: "u2", sender: "u1", type: "info", message: "Hi" };
            NotificationMock.create.mockResolvedValue(data);

            await notificationController.createNotification(req, data);

            expect(NotificationMock.create).toHaveBeenCalledWith(expect.objectContaining(data));
        });
    });

    describe("getNotifications", () => {
        test("should fetch user notifications", async () => {
            NotificationMock.find.mockReturnValue(mockQuery([]));
            await notificationController.getNotifications(req, res);
            expect(NotificationMock.find).toHaveBeenCalledWith({ recipient: "u1" });
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe("markAsRead", () => {
        test("should update notification", async () => {
            req.params.id = "n1";
            NotificationMock.findByIdAndUpdate.mockResolvedValue({ _id: "n1", isRead: true });

            await notificationController.markAsRead(req, res);

            expect(NotificationMock.findByIdAndUpdate).toHaveBeenCalledWith(
                "n1",
                expect.objectContaining({ isRead: true }),
                { new: true }
            );
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe("markAllAsRead", () => {
        test("should update all unread notifications", async () => {
            await notificationController.markAllAsRead(req, res);
            expect(NotificationMock.updateMany).toHaveBeenCalledWith(
                { recipient: "u1", isRead: false },
                expect.objectContaining({
                    $set: expect.objectContaining({ isRead: true }) // Accept any other fields like readAt
                })
            );
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe("deleteNotification", () => {
        test("should return 404 if not found or not owned", async () => {
            req.params.id = "n1";
            NotificationMock.findOneAndDelete.mockResolvedValue(null);
            await notificationController.deleteNotification(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test("should delete notification", async () => {
            req.params.id = "n1";
            NotificationMock.findOneAndDelete.mockResolvedValue({ _id: "n1" });
            await notificationController.deleteNotification(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Notification deleted" }));
        });
    });

    describe("deleteEmergencyAlerts", () => {
        test("should delete all emergency alerts for user", async () => {
            await notificationController.deleteEmergencyAlerts(req, res);
            expect(NotificationMock.deleteMany).toHaveBeenCalledWith({
                recipient: "u1",
                type: "emergency_alert"
            });
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe("sendEmergencyAlert", () => {
        test("should return 400 if missing data", async () => {
            req.body = { hospitalId: "h1" }; // missing message
            await notificationController.sendEmergencyAlert(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should send alerts to all doctors in hospital", async () => {
            req.body = { hospitalId: "h1", message: "Fire!" };

            // Mock doctors found
            const doctors = [
                { user: { _id: "doc1" } },
                { user: { _id: "doc2" } }
            ];
            DoctorProfileMock.find.mockReturnValue(mockQuery(doctors));
            NotificationMock.create.mockResolvedValue({}); // for createNotification helper call

            await notificationController.sendEmergencyAlert(req, res);

            expect(DoctorProfileMock.find).toHaveBeenCalledWith({ "hospitals.hospital": "h1" });
            // Should call createNotification (and thus Notification.create) twice
            expect(NotificationMock.create).toHaveBeenCalledTimes(2);
            expect(req.io.emit).toHaveBeenCalledTimes(2); // loops twice

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining("sent to 2 doctors")
            }));
        });
    });
});
