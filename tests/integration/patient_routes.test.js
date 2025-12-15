import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import PatientProfile from '../../models/PatientProfile.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockPatient = {
    name: 'Patient One',
    email: 'patient1@example.com',
    password: 'password123',
    role: 'patient',
    mobile: '1111111111',
    consentGiven: true
};

let token;

describe('Patient Routes Integration', () => {
    beforeEach(async () => {
        // Create User
        await User.deleteMany({ email: mockPatient.email });
        await PatientProfile.deleteMany({}); // Cleanup profiles

        const user = await User.create(mockPatient);

        // Create Profile
        const dob = new Date();
        dob.setFullYear(dob.getFullYear() - 30);
        await PatientProfile.create({ user: user._id, dob: dob, gender: 'male' });

        // Generate Token
        token = jwt.sign({ id: user._id, role: 'patient' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
    });

    afterEach(async () => {
        await User.deleteMany({ email: mockPatient.email });
        await PatientProfile.deleteMany({});
    });

    describe('GET /api/patients/profile', () => {
        it('should get patient profile with valid token', async () => {
            const res = await request(app)
                .get('/api/patients/profile')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.user).toHaveProperty('email', mockPatient.email);
            expect(res.body).toHaveProperty('age', 30);
        });

        it('should deny access without token', async () => {
            const res = await request(app)
                .get('/api/patients/profile');

            expect(res.statusCode).toBe(401);
        });
    });

    describe('PATCH /api/patients/profile', () => {
        it('should update patient profile', async () => {
            const updateData = { address: '123 Test St' };
            const res = await request(app)
                .patch('/api/patients/profile')
                .set('Authorization', `Bearer ${token}`)
                .send(updateData);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('address', '123 Test St');
        });
    });
});
