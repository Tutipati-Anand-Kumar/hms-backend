import { jest } from "@jest/globals";

// =====================================================================
// ========================= MOCK FS (ESM SAFE) =========================
// =====================================================================
const fsMock = {
    readFileSync: jest.fn()
};

jest.unstable_mockModule("fs", () => ({
    default: fsMock,
    readFileSync: fsMock.readFileSync
}));

// =====================================================================
// ========================= MOCK PATH (ESM SAFE) =======================
// =====================================================================
jest.unstable_mockModule("path", () => ({
    join: jest.fn(() => "/mock/medicine.json"),
    dirname: jest.fn(() => "/mock"),
    resolve: jest.fn(() => "/mock/medicine.json")
}));

// =====================================================================
// ====================== MOCK DoctorProfile MODEL ======================
// =====================================================================
const DoctorProfileMock = { find: jest.fn() };

jest.unstable_mockModule("../../models/DoctorProfile.js", () => ({
    default: DoctorProfileMock
}));

// =====================================================================
// ====================== IMPORT CONTROLLER AFTER MOCKS =================
// =====================================================================
const ai = await import("../../controllers/aiController.js");
const fs = await import("fs");

// =====================================================================
// ========================= checkSymptoms() TESTS ======================
// =====================================================================
describe("checkSymptoms()", () => {
    let req, res;

    beforeEach(() => {
        req = { body: {} };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
    });

    test("should return 400 if symptoms are missing", async () => {
        req.body = { symptoms: [] };
        await ai.checkSymptoms(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("should block male selecting female-only symptoms", async () => {
        req.body = { gender: "male", symptoms: ["pregnancy"] };
        await ai.checkSymptoms(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("should classify as emergency for chest pain", async () => {
        req.body = { symptoms: ["chest pain"] };

        DoctorProfileMock.find.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            })
        });

        await ai.checkSymptoms(req, res);
        expect(res.json.mock.calls[0][0].urgency).toContain("Emergency");
    });

    test("should classify as Consult Soon for long duration", async () => {
        req.body = { symptoms: ["cough"], duration: "3 weeks" };

        DoctorProfileMock.find.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            })
        });

        await ai.checkSymptoms(req, res);
        expect(res.json.mock.calls[0][0].urgency).toBe("Consult Doctor Soon");
    });

    test("should add Pediatrics for children under 18", async () => {
        req.body = { symptoms: ["fever"], age: 14 };

        DoctorProfileMock.find.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            })
        });

        await ai.checkSymptoms(req, res);
        expect(Array.isArray(res.json.mock.calls[0][0].doctors)).toBe(true);
    });

    test("should not add Pediatrics for adults", async () => {
        req.body = { symptoms: ["fever"], age: 25 };

        DoctorProfileMock.find.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            })
        });

        await ai.checkSymptoms(req, res);
        expect(Array.isArray(res.json.mock.calls[0][0].doctors)).toBe(true);
    });

    test("should fallback to General Medicine for unknown symptoms", async () => {
        req.body = { symptoms: ["weird-symptom-xyz"] };

        DoctorProfileMock.find.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            })
        });

        await ai.checkSymptoms(req, res);

        const call = DoctorProfileMock.find.mock.calls[0][0];
        expect(call.specialties.$in).toContain("General Medicine");
    });

    test("should format doctor results correctly", async () => {
        req.body = { symptoms: ["cough"] };

        DoctorProfileMock.find.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue([
                    {
                        _id: "d1",
                        user: { name: "Dr A", avatar: "photo.png" },
                        specialties: ["Pulmonology"],
                        hospitals: [
                            {
                                hospital: {
                                    _id: "h1",
                                    name: "City Hospital",
                                    address: "Main Street",
                                    location: { lat: 1, lng: 2 },
                                    phone: "99999"
                                }
                            }
                        ]
                    }
                ])
            })
        });

        await ai.checkSymptoms(req, res);

        const result = res.json.mock.calls[0][0];

        expect(result.doctors.length).toBe(1);
        expect(result.doctors[0].name).toBe("Dr A");
        expect(result.doctors[0].hospitals[0].name).toBe("City Hospital");
    });

    test("should handle DB error gracefully", async () => {
        req.body = { symptoms: ["cough"] };

        DoctorProfileMock.find.mockImplementation(() => {
            throw new Error("DB issue");
        });

        await ai.checkSymptoms(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// =====================================================================
// ====================== generatePrescription() TESTS ==================
// =====================================================================
describe("generatePrescription()", () => {
    let req, res;

    beforeEach(() => {
        req = { body: {} };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
    });

    test("should return 400 if symptoms missing", async () => {
        await ai.generatePrescription(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("should return default advice when no match found", async () => {
        req.body = { symptoms: "xyz" };

        fs.default.readFileSync.mockReturnValue(
            JSON.stringify({ symptoms_data: [] })
        );

        await ai.generatePrescription(req, res);

        const out = res.json.mock.calls[0][0];
        expect(out.medicines[0]).toContain("Consult");
    });

    test("should combine medicine advice when match found", async () => {
        req.body = { symptoms: "fever" };

        fs.default.readFileSync.mockReturnValue(
            JSON.stringify({
                symptoms_data: [
                    {
                        symptom: "fever",
                        medicine: ["Paracetamol"],
                        diet_advice: ["Rest"],
                        suggested_tests: ["Blood Test"],
                        follow_up: "2 days",
                        avoid: ["Cold drinks"]
                    }
                ]
            })
        );

        await ai.generatePrescription(req, res);

        const out = res.json.mock.calls[0][0];
        expect(out.medicines).toContain("Paracetamol");
        expect(out.diet_advice).toContain("Rest");
        expect(out.suggested_tests).toContain("Blood Test");
        expect(out.avoid).toContain("Cold drinks");
        expect(out.follow_up).toContain("2 days");
    });

    test("should handle file read error gracefully", async () => {
        req.body = { symptoms: "fever" };

        fs.default.readFileSync.mockImplementation(() => {
            throw new Error("File error");
        });

        await ai.generatePrescription(req, res);

        expect(res.json).toHaveBeenCalled();
    });
});
