import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import HelpDesk from '../../models/HelpDesk.js';
import Hospital from '../../models/Hospital.js';
import DoctorProfile from '../../models/DoctorProfile.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockHelpDesk = {
    name: 'HelpDesk User',
    email: 'helpdesk@example.com',
    password: 'password123',
    mobile: '8888888888',
    hospital: null
};

let helpDeskToken;
let helpDeskUser;
let hospital;

describe('HelpDesk Routes Integration', () => {
    beforeEach(async () => {
        await HelpDesk.deleteMany({ email: mockHelpDesk.email });
        await Hospital.deleteMany({});
        await User.deleteMany({});
        await DoctorProfile.deleteMany({});

        hospital = await Hospital.create({
            name: 'Test Hospital',
            address: 'Test Address',
            city: 'Test City',
            contactNumber: '9876543210'
        });

        // Hashing password for login test
        const bcrypt = (await import('bcrypt')).default;
        const hashedPassword = await bcrypt.hash(mockHelpDesk.password, 10);

        mockHelpDesk.hospital = hospital._id;
        helpDeskUser = await HelpDesk.create({ ...mockHelpDesk, password: hashedPassword });

        helpDeskToken = jwt.sign({ id: helpDeskUser._id, role: 'helpdesk' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
    });

    afterEach(async () => {
        await HelpDesk.deleteMany({ email: mockHelpDesk.email });
        await Hospital.deleteMany({});
        await User.deleteMany({});
        await DoctorProfile.deleteMany({});
    });

    describe('POST /api/helpdesk/login', () => {
        it('should login successfully', async () => {
            const res = await request(app)
                .post('/api/helpdesk/login')
                .send({ mobile: mockHelpDesk.mobile, password: mockHelpDesk.password });

            expect(res.statusCode).toBe(200);
            expect(res.body.tokens).toHaveProperty('accessToken');
        });
    });

    describe('GET /api/helpdesk/me', () => {
        it('should return helpdesk profile', async () => {
            const res = await request(app)
                .get('/api/helpdesk/me')
                .set('Authorization', `Bearer ${helpDeskToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('name', mockHelpDesk.name);
            expect(res.body).toHaveProperty('hospital');
        });
    });

    describe('GET /api/helpdesk/profile/me', () => {
        it('should return helpdesk profile (alias)', async () => {
            const res = await request(app)
                .get('/api/helpdesk/profile/me')
                .set('Authorization', `Bearer ${helpDeskToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.id).toBe(helpDeskUser._id.toString());
        });
    });

    describe('PUT /api/helpdesk/me', () => {
        it('should update profile', async () => {
            const res = await request(app)
                .put('/api/helpdesk/me')
                .set('Authorization', `Bearer ${helpDeskToken}`)
                .send({ name: 'Updated Name' });

            expect(res.statusCode).toBe(200);
            expect(res.body.name).toBe('Updated Name');
        });
    });

    describe('GET /api/helpdesk/dashboard', () => {
        it('should retrieve dashboard stats', async () => {
            const res = await request(app)
                .get('/api/helpdesk/dashboard')
                .set('Authorization', `Bearer ${helpDeskToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('totalDoctors');
            expect(res.body).toHaveProperty('totalPatients');
        });
    });

    describe('GET /api/helpdesk/hospital/:hospitalId', () => {
        it('should get helpdesk by hospital ID', async () => {
            const res = await request(app)
                .get(`/api/helpdesk/hospital/${hospital._id}`)
                .set('Authorization', `Bearer ${helpDeskToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body._id).toBe(helpDeskUser._id.toString());
        });
    });

    describe('GET /api/helpdesk/:id', () => {
        it('should get helpdesk by ID', async () => {
            const res = await request(app)
                .get(`/api/helpdesk/${helpDeskUser._id}`)
                .set('Authorization', `Bearer ${helpDeskToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.email).toBe(mockHelpDesk.email);
        });
    });

    describe('POST /api/helpdesk/doctor', () => {
        it('should create a doctor and assign to hospital', async () => {
            const newDoc = {
                name: "New Doc",
                email: "newdoc@test.com",
                mobile: "9999999999",
                password: "password123",
                specialties: ["General"],
                consultationFee: 500,
                availability: []
            };

            const res = await request(app)
                .post('/api/helpdesk/doctor')
                .set('Authorization', `Bearer ${helpDeskToken}`)
                .send(newDoc);

            if (res.statusCode !== 201) console.log("Create Doctor Fail:", res.body);

            expect(res.statusCode).toBe(201);
            expect(res.body.doctor).toHaveProperty('specialties');

            // Verify Hospital Updated
            const updatedHospital = await Hospital.findById(hospital._id);
            expect(updatedHospital.numberOfDoctors).toBeGreaterThan(0);
        });
    });

    // --- Auth Management ---
    describe('POST /api/helpdesk/refresh', () => {
        it('should refresh token', async () => {
            // 1. Login
            const loginRes = await request(app)
                .post('/api/helpdesk/login')
                .send({ mobile: mockHelpDesk.mobile, password: mockHelpDesk.password });

            const refreshToken = loginRes.body.tokens.refreshToken;

            // 2. Refresh
            const res = await request(app)
                .post('/api/helpdesk/refresh')
                .send({ refreshToken });

            expect(res.statusCode).toBe(200);
            expect(res.body.tokens).toHaveProperty('accessToken');
        });
    });

    describe('POST /api/helpdesk/logout', () => {
        it('should logout successfully', async () => {
            const loginRes = await request(app)
                .post('/api/helpdesk/login')
                .send({ mobile: mockHelpDesk.mobile, password: mockHelpDesk.password });

            const refreshToken = loginRes.body.tokens.refreshToken;

            const res = await request(app)
                .post('/api/helpdesk/logout')
                .send({ refreshToken });

            expect(res.statusCode).toBe(204);
        });
    });

    // --- Admin Delete Route (Mapped to deleteHospital) ---
    describe('DELETE /api/helpdesk/:id', () => {
        it('should delete a hospital (requires admin)', async () => {
            // Create Admin User & Token
            const adminUser = await User.create({
                name: "Admin User",
                email: "admin_hd_test@test.com",
                mobile: "0000000000",
                password: "password123",
                role: "admin"
            });
            const adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });

            // Create a dummy hospital to delete
            const hospitalToDelete = await Hospital.create({
                name: 'To Delete',
                address: 'Addr',
                contactNumber: '1111111111'
            });

            const res = await request(app)
                .delete(`/api/helpdesk/${hospitalToDelete._id}`) // The route maps to deleteHospital
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/deleted/i);

            const check = await Hospital.findById(hospitalToDelete._id);
            expect(check).toBeNull();
        });
    });
});
