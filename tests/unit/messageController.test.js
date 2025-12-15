import { jest } from "@jest/globals";

// 1. Mock Mongoose Helper
const mockQuery = (result) => ({
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
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
        Types: { ObjectId: jest.fn() },
        startSession: jest.fn().mockResolvedValue({
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            abortTransaction: jest.fn(),
            endSession: jest.fn()
        })
    },
}));

// Models
const MessageMock = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
};
jest.unstable_mockModule("../../models/Message.js", () => ({ default: MessageMock }));

const UserMock = {
    find: jest.fn(),
};
jest.unstable_mockModule("../../models/User.js", () => ({ default: UserMock }));

const HelpDeskMock = {
    find: jest.fn(),
};
jest.unstable_mockModule("../../models/HelpDesk.js", () => ({ default: HelpDeskMock }));

// Dynamic models mocking
const AppointmentMock = {
    findOne: jest.fn(),
};
jest.unstable_mockModule("../../models/Appointment.js", () => ({ default: AppointmentMock }));

const DoctorProfileMock = {
    findOne: jest.fn(),
    find: jest.fn(),
};
jest.unstable_mockModule("../../models/DoctorProfile.js", () => ({ default: DoctorProfileMock }));


// 3. Import Controller
const messageController = await import("../../controllers/messageController.js");

describe("Message Controller Unit Tests", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            user: { _id: "u1", role: "doctor", name: "User 1" },
            io: { to: jest.fn().mockReturnThis(), emit: jest.fn() }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();

        // Default mocks
        MessageMock.find.mockReturnValue(mockQuery([]));
        UserMock.find.mockReturnValue(mockQuery([]));
        HelpDeskMock.find.mockReturnValue(mockQuery([]));
        DoctorProfileMock.find.mockReturnValue(mockQuery([]));
        DoctorProfileMock.findOne.mockReturnValue(mockQuery(null));
        AppointmentMock.findOne.mockReturnValue(mockQuery(null));
    });

    describe("sendMessage", () => {
        test("should create and return message", async () => {
            req.body = { receiverId: "u2", content: "Hello", hospitalId: "h1" };

            // Setup expected messages for populateMessages
            const createdMsg = {
                _id: "m1", sender: "u1", receiver: "u2", content: "Hello",
                toObject: () => ({ _id: "m1", sender: "u1", receiver: "u2", content: "Hello" }),
                sender: "u1" // needed because controller accesses msg.sender
            };
            MessageMock.create.mockResolvedValue(createdMsg);

            // mocks for populate
            UserMock.find.mockReturnValue(mockQuery([{ _id: "u1", name: "User 1" }, { _id: "u2", name: "User 2" }]));

            await messageController.sendMessage(req, res);

            expect(MessageMock.create).toHaveBeenCalledWith(expect.objectContaining({
                sender: "u1", receiver: "u2", content: "Hello"
            }));
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test("should auto-complete appointment if doctor says 'completed'", async () => {
            req.body = { receiverId: "u2", content: "Treatment Completed", hospitalId: "h1" };
            req.user.role = "doctor";

            const createdMsg = {
                _id: "m1", sender: "u1", receiver: "u2", content: "Completed",
                toObject: () => ({ _id: "m1", sender: "u1", receiver: "u2" }),
                sender: "u1"
            };
            MessageMock.create.mockResolvedValue(createdMsg);

            // Mock DoctorProfile found matching sender
            DoctorProfileMock.findOne.mockReturnValue(mockQuery({ _id: "dp1" }));

            // Mock Appointment found active
            const activeAppt = { _id: "appt1", status: "confirmed", save: jest.fn() };
            AppointmentMock.findOne.mockReturnValue(mockQuery(activeAppt));

            await messageController.sendMessage(req, res);

            expect(activeAppt.status).toBe("completed");
            expect(activeAppt.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe("deleteMessage", () => {
        test("should return 404 if message not found", async () => {
            req.params.messageId = "m99";
            MessageMock.findById.mockResolvedValue(null);
            await messageController.deleteMessage(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        // The controller logic:
        // if deleteForEveryone && sender==me -> soft delete (tombstone)
        // else -> add to hiddenFor (delete for me)
        // It does NOT return 403. It allows "delete for me" even if not owner (technically anyone can hide a message from their view if they are part of it, logic in controller assumes participation but doesn't strictly check 403 if ID not in participants? Actually controller just pushes to hiddenFor without checking if user is participant. Valid for unit test to just check successful hiddenFor push)

        test("should delete (soft delete/hide) if owner", async () => {
            req.params.messageId = "m1";
            const messageObj = {
                _id: "m1",
                sender: "u1",
                receiver: "u2",
                hiddenFor: [],
                save: jest.fn(),
                toString: () => "m1"
            };
            MessageMock.findById.mockResolvedValue(messageObj);

            await messageController.deleteMessage(req, res);

            // Should add to hiddenFor
            expect(messageObj.hiddenFor).toContain("u1");
            expect(messageObj.save).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Message deleted for you" }));
        });
    });
});

