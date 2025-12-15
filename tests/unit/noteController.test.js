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

const NoteMock = {
    find: jest.fn(),
    create: jest.fn(),
    findByIdAndDelete: jest.fn(),
    deleteMany: jest.fn(),
};
jest.unstable_mockModule("../../models/Note.js", () => ({ default: NoteMock }));

// 3. Import Controller
const noteController = await import("../../controllers/noteController.js");

describe("Note Controller Unit Tests", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            user: { _id: "u1" }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe("getDoctorNotes", () => {
        test("should fetch notes for a doctor sorted by date", async () => {
            req.params.doctorId = "d1";
            NoteMock.find.mockReturnValue(mockQuery([{ text: "Note 1" }]));

            await noteController.getDoctorNotes(req, res);

            expect(NoteMock.find).toHaveBeenCalledWith({ doctor: "d1" });
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe("createNote", () => {
        test("should return 400 if missing fields", async () => {
            req.body = { doctorId: "d1" }; // missing text
            await noteController.createNote(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Doctor ID and text are required" }));
        });

        test("should create and return new note", async () => {
            req.body = { doctorId: "d1", text: "New Note" };
            NoteMock.create.mockResolvedValue({ _id: "n1", text: "New Note" });

            await noteController.createNote(req, res);

            expect(NoteMock.create).toHaveBeenCalledWith({ doctor: "d1", text: "New Note" });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ text: "New Note" }));
        });
    });

    describe("deleteNote", () => {
        test("should return 404 if note not found", async () => {
            req.params.id = "n1";
            NoteMock.findByIdAndDelete.mockResolvedValue(null);

            await noteController.deleteNote(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Note not found" }));
        });

        test("should delete note", async () => {
            req.params.id = "n1";
            NoteMock.findByIdAndDelete.mockResolvedValue({ _id: "n1" });

            await noteController.deleteNote(req, res);

            expect(NoteMock.findByIdAndDelete).toHaveBeenCalledWith("n1");
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Note deleted" }));
        });
    });

    describe("deleteAllNotes", () => {
        test("should return 400 if doctorId missing", async () => {
            req.params = {};
            await noteController.deleteAllNotes(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should delete all notes for doctor", async () => {
            req.params.doctorId = "d1";
            NoteMock.deleteMany.mockResolvedValue({ deletedCount: 5 });

            await noteController.deleteAllNotes(req, res);

            expect(NoteMock.deleteMany).toHaveBeenCalledWith({ doctor: "d1" });
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "All notes deleted successfully" }));
        });
    });
});
