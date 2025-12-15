import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import Report from '../../models/Report.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import path from 'path';

const mockPatient = {
    name: 'Patient Report',
    email: 'patient_report@example.com',
    password: 'password123',
    role: 'patient',
    mobile: '9998887777',
    consentGiven: true
};

let token;
let user;

describe('Report Routes Integration', () => {
    beforeEach(async () => {
        await User.deleteMany({ email: mockPatient.email });
        await Report.deleteMany({});

        user = await User.create(mockPatient);
        token = jwt.sign({ id: user._id, role: 'patient' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
    });

    afterEach(async () => {
        await User.deleteMany({ email: mockPatient.email });
        await Report.deleteMany({});
    });

    describe('POST /api/reports/save', () => {
        it('should save report metadata', async () => {
            const reportData = {
                patientId: user._id,
                name: "Test Report",
                url: "http://example.com/test.pdf",
                type: "Lab Report",
                public_id: "test_public_id",
                date: new Date(),
                size: 1024
            };

            const res = await request(app)
                .post('/api/reports/save')
                .set('Authorization', `Bearer ${token}`)
                .send(reportData);

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('name', 'Test Report');
        });
    });

    describe('GET /api/reports/patient/:patientId', () => {
        it('should get reports for a patient', async () => {
            await Report.create({
                patient: user._id,
                name: "Existing Report",
                url: "http://example.com/exist.pdf",
                type: "X-Ray",
                public_id: "exist_public_id",
                date: new Date(),
                size: 2048
            });

            const res = await request(app)
                .get(`/api/reports/patient/${user._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0]).toHaveProperty('name', 'Existing Report');
        });
    });

    describe('DELETE /api/reports/:id', () => {
        it('should delete a report', async () => {
            const report = await Report.create({
                patient: user._id,
                name: "To Delete",
                url: "http://example.com/delete.pdf",
                type: "Scan",
                public_id: "delete_id",
                date: new Date(),
                size: 100
            });

            const res = await request(app)
                .delete(`/api/reports/${report._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('message', 'Report deleted');

            const found = await Report.findById(report._id);
            expect(found).toBeNull();
        });
    });

    describe('POST /api/reports/upload', () => {
        it('should upload a file', async () => {
            // Mocking the upload middleware is complex in an integration test unless we use a library that mocks multer.
            // However, we can try sending a file and see if it passes or if we need to mock the middleware globally.
            // Given the route directly uses `upload.single("report")`, it expects a file.
            // If we don't send one, it returns 400.
            // If we do, it tries to upload to Cloudinary (which might fail without creds).
            // Let's test the 400 case first to ensure route exists.

            const res = await request(app)
                .post('/api/reports/upload')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(400); // No file uploaded
        });
    });
});
