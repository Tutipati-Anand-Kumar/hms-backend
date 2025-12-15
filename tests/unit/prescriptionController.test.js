import { jest } from "@jest/globals";

// 1. Mock Mongoose Helper
const mockQuery = (result) => ({
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
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

const PrescriptionMock = {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    deleteMany: jest.fn(),
};
// Since Prescription is a class in controller (new Prescription(...)), we need to mock the default export as a class
class MockPrescriptionClass {
    constructor(data) { Object.assign(this, data); }
    save() { return Promise.resolve(this); }
}
// Assign static methods to the class
Object.assign(MockPrescriptionClass, PrescriptionMock);

jest.unstable_mockModule("../../models/Prescription.js", () => ({ default: MockPrescriptionClass }));

// Dynamic Imports Mocks
const AppointmentMock = {
    findByIdAndUpdate: jest.fn(),
};
jest.unstable_mockModule("../../models/Appointment.js", () => ({ default: AppointmentMock }));

const DoctorProfileMock = {
    findOne: jest.fn(),
};
jest.unstable_mockModule("../../models/DoctorProfile.js", () => ({ default: DoctorProfileMock }));

const HospitalMock = {
    // used implicitly
};
jest.unstable_mockModule("../../models/Hospital.js", () => ({ default: HospitalMock }));


// 3. Import Controller
const prescriptionController = await import("../../controllers/prescriptionController.js");

describe("Prescription Controller Unit Tests", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            user: { _id: "d1", role: "doctor", name: "Dr. Test" }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe("createPrescription", () => {
        test("should create prescription and update appointment", async () => {
            req.body = {
                appointment: { _id: "a1" },
                patient: "p1",
                medicines: []
            };
            const saveSpy = jest.spyOn(MockPrescriptionClass.prototype, 'save');

            await prescriptionController.createPrescription(req, res);

            expect(saveSpy).toHaveBeenCalled();
            expect(AppointmentMock.findByIdAndUpdate).toHaveBeenCalledWith("a1", { status: "completed" });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Prescription saved successfully" }));
        });

        test("should handle server error", async () => {
            jest.spyOn(MockPrescriptionClass.prototype, 'save').mockRejectedValue(new Error("Save failed"));
            await prescriptionController.createPrescription(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("getPrescriptions", () => {
        test("should fetch prescriptions for doctor", async () => {
            req.user = { role: "doctor", id: "d1" };

            const presList = [
                { _id: "pr1", doctor: { _id: "d1" }, appointment: { hospital: { name: "H1" } } }
            ];
            PrescriptionMock.find.mockReturnValue(mockQuery(presList));

            await prescriptionController.getPrescriptions(req, res);

            expect(PrescriptionMock.find).toHaveBeenCalledWith({ doctor: "d1" });
            expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ _id: "pr1" })]));
        });

        test("should apply fallback logic for hospital if missing", async () => {
            req.user = { role: "patient", id: "p1" };

            // Prescription without hospital info
            const presList = [
                { _id: "pr2", doctor: { _id: "d1" }, appointment: null }
            ];
            PrescriptionMock.find.mockReturnValue(mockQuery(presList));

            // Fallback DoctorProfile
            DoctorProfileMock.findOne.mockReturnValue(mockQuery({
                specialties: ["Cardio"],
                hospitals: [{ hospital: { name: "Fallback Hospital", address: "Loc" } }]
            }));

            await prescriptionController.getPrescriptions(req, res);

            expect(DoctorProfileMock.findOne).toHaveBeenCalledWith({ user: "d1" });

            // Verify fallback data was attached to response
            const jsonResponse = res.json.mock.calls[0][0];
            expect(jsonResponse[0].doctor.specialization).toBe("Cardio");
            expect(jsonResponse[0].appointment.hospital.name).toBe("Fallback Hospital");
        });
    });

    describe("getPrescriptionById", () => {
        test("should return 404 if not found", async () => {
            req.params.id = "bad_id";
            PrescriptionMock.findById.mockReturnValue(mockQuery(null));
            await prescriptionController.getPrescriptionById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test("should return prescription with fallback logic", async () => {
            req.params.id = "pr1";
            const presData = { _id: "pr1", doctor: { _id: "d1" }, appointment: null }; // Missing hospital
            PrescriptionMock.findById.mockReturnValue(mockQuery(presData));

            DoctorProfileMock.findOne.mockReturnValue(mockQuery({
                specialties: ["General"],
                hospitals: [{ hospital: { name: "Fallback" } }]
            }));

            await prescriptionController.getPrescriptionById(req, res);

            const jsonResponse = res.json.mock.calls[0][0];
            expect(jsonResponse.doctor.specialization).toBe("General");
            expect(jsonResponse.appointment.hospital.name).toBe("Fallback");
        });
    });

    describe("deletePrescription", () => {
        test("should delete prescription", async () => {
            req.params.id = "pr1";
            PrescriptionMock.findById.mockResolvedValue({ _id: "pr1" });

            await prescriptionController.deletePrescription(req, res);

            expect(PrescriptionMock.findByIdAndDelete).toHaveBeenCalledWith("pr1");
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Prescription deleted successfully" }));
        });

        test("should return 404 if not found", async () => {
            req.params.id = "pr1";
            PrescriptionMock.findById.mockResolvedValue(null);

            await prescriptionController.deletePrescription(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe("deletePrescriptions (Bulk)", () => {
        test("should delete multiple prescriptions", async () => {
            req.body.ids = ["p1", "p2"];
            PrescriptionMock.deleteMany.mockResolvedValue({ deletedCount: 2 });

            await prescriptionController.deletePrescriptions(req, res);

            expect(PrescriptionMock.deleteMany).toHaveBeenCalledWith({ _id: { $in: ["p1", "p2"] } });
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "2 prescriptions deleted successfully" }));
        });

        test("should return 400 for invalid input", async () => {
            req.body.ids = [];
            await prescriptionController.deletePrescriptions(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 404 if none deleted", async () => {
            req.body.ids = ["p1"];
            PrescriptionMock.deleteMany.mockResolvedValue({ deletedCount: 0 });
            await prescriptionController.deletePrescriptions(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });
    });
});
