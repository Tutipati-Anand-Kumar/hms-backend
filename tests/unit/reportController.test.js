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

// Mock Report Model
const ReportMock = {
    find: jest.fn(),
    findById: jest.fn(),
    deleteOne: jest.fn(),
};
class MockReportClass {
    constructor(data) { Object.assign(this, data); }
    save() { return Promise.resolve(this); }
    deleteOne() { return Promise.resolve(this); }
}
Object.assign(MockReportClass, ReportMock);
jest.unstable_mockModule("../../models/Report.js", () => ({ default: MockReportClass }));

// Mock Appointment Model
const AppointmentMock = {
    findByIdAndUpdate: jest.fn(),
};
jest.unstable_mockModule("../../models/Appointment.js", () => ({ default: AppointmentMock }));

// Mock Axios (for proxyPDF)
const AxiosMock = {
    get: jest.fn()
};
jest.unstable_mockModule("axios", () => ({ default: AxiosMock }));

// Mock Cloudinary (for proxyPDF)
// Mock Cloudinary
const CloudinaryMock = {
    url: jest.fn(),
    api: {
        resource: jest.fn()
    },
    uploader: {
        upload_stream: jest.fn((options, callback) => {
            // Return a mock stream with .end() that invokes callback
            if (callback) callback(null, { secure_url: "http://url", public_id: "pid123" });
            return {
                end: jest.fn()
            };
        })
    }
};
jest.unstable_mockModule("../../config/cloudinary.js", () => ({ default: CloudinaryMock }));


// 3. Import Controller
const reportController = await import("../../controllers/reportController.js");

describe("Report Controller Unit Tests", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            query: {},
            file: null,
            user: { id: "u1", role: "patient" }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            set: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            redirect: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("uploadFile", () => {
        test("should return 400 if no file uploaded", async () => {
            reportController.uploadFile(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "No file uploaded" }));
        });

        test("should return success if file uploaded", async () => {
            req.file = { buffer: Buffer.from("fake data"), originalname: "test.pdf" };
            await reportController.uploadFile(req, res); // Ensure await

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: "File uploaded successfully",
                url: "http://url",
                public_id: "pid123"
            }));
        });
    });

    describe("saveReport", () => {
        test("should save report and update appointment", async () => {
            req.body = {
                patientId: "p1",
                name: "Rpt1",
                url: "http://url",
                type: "Lab Report",
                date: "2023-01-01",
                appointmentId: "appt1"
            };
            const saveSpy = jest.spyOn(MockReportClass.prototype, 'save');

            await reportController.saveReport(req, res);

            expect(saveSpy).toHaveBeenCalled();
            expect(AppointmentMock.findByIdAndUpdate).toHaveBeenCalledWith(
                "appt1",
                { $push: { reports: "http://url" } }
            );
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test("should handle validation error (DB Save Fail)", async () => {
            req.body = {
                patientId: "p1", name: "Rpt1", url: "http://url", type: "Lab", date: "2023-01-01"
            };
            jest.spyOn(MockReportClass.prototype, 'save').mockRejectedValue(new Error("Err"));
            await reportController.saveReport(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("getPatientReports", () => {
        test("should fetch reports sorted by date", async () => {
            req.params.patientId = "p1";
            ReportMock.find.mockReturnValue(mockQuery([]));

            await reportController.getPatientReports(req, res);

            expect(ReportMock.find).toHaveBeenCalledWith({ patient: "p1" });
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe("deleteReport", () => {
        test("should delete report found by ID", async () => {
            req.params.id = "r1";
            const reportInstance = new MockReportClass({ _id: "r1" });
            const deleteSpy = jest.spyOn(reportInstance, 'deleteOne');

            ReportMock.findById.mockResolvedValue(reportInstance);

            await reportController.deleteReport(req, res);

            expect(deleteSpy).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Report deleted" }));
        });

        test("should return 404 if not found", async () => {
            ReportMock.findById.mockResolvedValue(null);
            await reportController.deleteReport(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe("proxyPDF", () => {
        test("should return 404 if report not found", async () => {
            req.params.reportId = "r1";
            ReportMock.findById.mockResolvedValue(null);
            await reportController.proxyPDF(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test("should return 403 if unauthorized", async () => {
            req.params.reportId = "r1";
            req.user = { id: "u2", role: "patient" }; // Not owner, not admin
            ReportMock.findById.mockResolvedValue({
                patient: { toString: () => "u1" }
            });

            await reportController.proxyPDF(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        test("should fetch via Public URL (Attempt 1)", async () => {
            req.params.reportId = "r1";
            req.user = { id: "u1", role: "patient" }; // Owner
            const report = {
                patient: { toString: () => "u1" },
                url: "http://public-url",
                name: "test.pdf"
            };
            ReportMock.findById.mockResolvedValue(report);

            AxiosMock.get.mockResolvedValueOnce({ data: Buffer.from("PDF DATA") });

            await reportController.proxyPDF(req, res);

            expect(AxiosMock.get).toHaveBeenCalledWith("http://public-url", expect.any(Object));
            expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'application/pdf' }));
            expect(res.send).toHaveBeenCalled();
        });

        test("should fallback to Signed URL (Attempt 2) if Public fails", async () => {
            req.params.reportId = "r1";
            req.user = { id: "u1", role: "patient" };
            const report = {
                patient: { toString: () => "u1" },
                url: "http://cloudinary/raw/upload/v1/file.pdf",
                public_id: "file.pdf",
                name: "test.pdf"
            };
            ReportMock.findById.mockResolvedValue(report);

            // First call fails, Second call succeeds
            AxiosMock.get
                .mockRejectedValueOnce(new Error("Public Fail")) // Attempt 1
                .mockResolvedValueOnce({ data: Buffer.from("SIGNED PDF") }); // Attempt 2

            CloudinaryMock.url.mockReturnValue("http://signed-url");

            await reportController.proxyPDF(req, res);

            expect(CloudinaryMock.url).toHaveBeenCalled(); // Should check logic for signed url gen
            expect(AxiosMock.get).toHaveBeenCalledTimes(2);
            expect(AxiosMock.get).toHaveBeenLastCalledWith("http://signed-url", expect.any(Object));
            expect(res.send).toHaveBeenCalled();
        });

        test("should fallback to Admin API (Attempt 3) if Signed fails", async () => {
            req.params.reportId = "r1";
            req.user = { id: "u1", role: "patient" };
            const report = {
                patient: { toString: () => "u1" },
                url: "http://cloudinary/raw/upload/v1/file.pdf",
                public_id: "file.pdf",
                name: "test.pdf"
            };
            ReportMock.findById.mockResolvedValue(report);

            // 1. Public fails
            // 2. Signed fails
            // 3. Admin API Verified URL succeeds
            AxiosMock.get
                .mockRejectedValueOnce(new Error("Public Fail"))
                .mockRejectedValueOnce(new Error("Signed Fail"))
                .mockResolvedValueOnce({ data: Buffer.from("ADMIN PDF") });

            CloudinaryMock.url.mockReturnValueOnce("http://signed-url");
            // Admin API returns valid resource
            CloudinaryMock.api.resource.mockResolvedValueOnce({
                public_id: "file.pdf",
                resource_type: "raw",
                type: "upload",
                format: "pdf"
            });
            CloudinaryMock.url.mockReturnValueOnce("http://verified-url");

            await reportController.proxyPDF(req, res);

            expect(CloudinaryMock.api.resource).toHaveBeenCalled();
            expect(res.send).toHaveBeenCalled();
        });

        test("should redirect if all attempts fail", async () => {
            req.params.reportId = "r1";
            req.user = { id: "u1", role: "patient" };
            const report = {
                patient: { toString: () => "u1" },
                url: "http://final-redirect",
                public_id: "file.pdf"
            };
            ReportMock.findById.mockResolvedValue(report);

            // All Axios calls fail
            // We simulate failures such that it reaches fallback
            AxiosMock.get.mockRejectedValue(new Error("Fail"));
            // Admin API fails to find resource or fails call
            CloudinaryMock.api.resource.mockRejectedValue(new Error("Admin API Fail"));

            await reportController.proxyPDF(req, res);

            expect(res.redirect).toHaveBeenCalledWith("http://final-redirect");
        });
    });
});
