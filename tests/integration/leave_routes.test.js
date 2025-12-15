import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import Leave from '../../models/Leave.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockDoctor = {
    name: 'Dr Leave',
    email: 'doctor_leave@example.com',
    password: 'password123',
    role: 'doctor',
    mobile: '1234567890',
    consentGiven: true
};

const mockAdmin = {
    name: 'Admin User',
    email: 'admin_leave@example.com',
    password: 'password123',
    role: 'admin',
    mobile: '0987654321',
    consentGiven: true
};

let doctorToken, adminToken;
let doctorUser, adminUser;

describe('Leave Routes Integration', () => {
    beforeEach(async () => {
        await User.deleteMany({ email: { $in: [mockDoctor.email, mockAdmin.email] } });
        await Leave.deleteMany({});

        doctorUser = await User.create(mockDoctor);
        adminUser = await User.create(mockAdmin);

        // Create Doctor Profile (Validates 404 check in controller)
        const DoctorProfile = (await import('../../models/DoctorProfile.js')).default;
        await DoctorProfile.create({ user: doctorUser._id, specialties: ['General'], experience: 5 });

        doctorToken = jwt.sign({ id: doctorUser._id, role: 'doctor' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
        adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
    });

    afterEach(async () => {
        await User.deleteMany({ email: { $in: [mockDoctor.email, mockAdmin.email] } });
        await Leave.deleteMany({});
    });

    describe('POST /api/leaves/request', () => {
        it('should allow doctor to request leave', async () => {
            const leaveData = {
                startDate: new Date(),
                endDate: new Date(new Date().setDate(new Date().getDate() + 1)),
                reason: "Vacation"
            };

            const res = await request(app)
                .post('/api/leaves/request')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send(leaveData);

            expect(res.statusCode).toBe(201);
            expect(res.body.leave).toHaveProperty('status', 'pending');
        });
    });

    describe('GET /api/leaves', () => {
        it('should get leaves', async () => {
            await Leave.create({
                doctorId: doctorUser._id,
                startDate: new Date(),
                endDate: new Date(),
                reason: "Sick",
                status: "pending"
            });

            const res = await request(app)
                .get('/api/leaves')
                .set('Authorization', `Bearer ${adminToken}`); // Admin can view all

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });
    });

    describe('PATCH /api/leaves/:id/status', () => {
        it('should update leave status by admin', async () => {
            const leave = await Leave.create({
                doctorId: doctorUser._id,
                startDate: new Date(),
                endDate: new Date(),
                reason: "Sick",
                status: "pending"
            });

            const res = await request(app)
                .patch(`/api/leaves/${leave._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'approved' });

            expect(res.statusCode).toBe(200);
            expect(res.body.leave).toHaveProperty('status', 'approved');
        });
    });
});
