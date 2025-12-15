import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import DoctorProfile from '../../models/DoctorProfile.js';
import PatientProfile from '../../models/PatientProfile.js';
import Appointment from '../../models/Appointment.js';
import Hospital from '../../models/Hospital.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Extend expect for flexibility
expect.extend({
    toBeOneOf(received, validOptions) {
        const pass = validOptions.includes(received);
        if (pass) {
            return {
                message: () => `expected ${received} not to be one of ${validOptions}`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be one of ${validOptions}`,
                pass: false,
            };
        }
    },
});

const mockDoctor = {
    name: 'Doctor One',
    email: 'doctor1@example.com',
    password: 'password123',
    role: 'doctor',
    mobile: '2222222222',
    consentGiven: true,
    doctorId: 'DOC001'
};

let token;
let doctorUser;
let doctorProfile;

describe('Doctor Routes Integration', () => {
    beforeEach(async () => {
        // Clear Collections
        await User.deleteMany({});
        await DoctorProfile.deleteMany({});
        await PatientProfile.deleteMany({});
        await Appointment.deleteMany({});
        await Hospital.deleteMany({});

        // Create Doctor User
        doctorUser = await User.create(mockDoctor);

        // Experience: 5 years ago
        const expDate = new Date();
        expDate.setFullYear(expDate.getFullYear() - 5);

        // Create Doctor Profile
        doctorProfile = await DoctorProfile.create({
            user: doctorUser._id,
            specialties: ['Cardiology'],
            experienceStart: expDate,
            qualifications: ['MBBS']
        });

        token = jwt.sign({ id: doctorUser._id, role: 'doctor' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
    });

    afterEach(async () => {
        // Cleanup handled by beforeEach mostly, but good to ensure
        await User.deleteMany({});
        await DoctorProfile.deleteMany({});
    });

    // --- Profile Routes ---
    describe('GET /api/doctors/me', () => {
        it('should return doctor profile', async () => {
            const res = await request(app)
                .get('/api/doctors/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('specialties');
            expect(res.body.specialties).toContain('Cardiology');
        });
    });

    describe('GET /api/doctors/profile/me', () => {
        it('should return doctor profile (alias)', async () => {
            const res = await request(app)
                .get('/api/doctors/profile/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.user._id).toBe(doctorUser._id.toString());
        });
    });

    describe('PUT /api/doctors/me', () => {
        it('should update doctor profile', async () => {
            const newExpDate = new Date();
            newExpDate.setFullYear(newExpDate.getFullYear() - 6);

            const res = await request(app)
                .put('/api/doctors/me')
                .set('Authorization', `Bearer ${token}`)
                .send({ bio: 'Updated Bio', experienceStart: newExpDate });

            expect(res.statusCode).toBe(200);
            expect(res.body.bio).toBe('Updated Bio');
        });
    });

    // --- Search & Public Routes ---
    describe('GET /api/doctors (Search)', () => {
        it('should list doctors', async () => {
            const res = await request(app)
                .get('/api/doctors');

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
        });

        it('should list doctors by speciality', async () => {
            const res = await request(app)
                .get('/api/doctors')
                .query({ speciality: 'Cardiology' });

            expect(res.statusCode).toBe(200);
            expect(res.body[0].specialties).toContain('Cardiology');
        });
    });

    describe('GET /api/doctors/:id', () => {
        it('should get doctor by ID', async () => {
            const res = await request(app)
                .get(`/api/doctors/${doctorUser._id}`); // Controller accepts User ID or DoctorID

            expect(res.statusCode).toBe(200);
            expect(res.body.user._id).toBe(doctorUser._id.toString());
        });

        it('should get doctor by DoctorID string', async () => {
            const res = await request(app)
                .get(`/api/doctors/${mockDoctor.doctorId}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.user.doctorId).toBe(mockDoctor.doctorId);
        });
    });

    // --- Patient Details ---
    describe('GET /api/doctors/patient/:patientId', () => {
        it('should get patient details including history', async () => {
            // Create Patient
            const patientUser = await User.create({ name: 'Pat', email: 'pat@test.com', mobile: '111', role: 'patient', password: '123' });
            await PatientProfile.create({
                user: patientUser._id,
                age: 30,
                gender: 'male', // Fix: lowercase enum
                conditions: 'Flu' // Fix: String, not array
            });

            // Create Appointment History
            await Appointment.create({
                doctor: doctorProfile._id,
                patient: patientUser._id,
                hospital: (await Hospital.create({ name: 'H_Hist', address: 'A', phone: '1' }))._id, // Fix: Add Hospital
                date: new Date(),
                status: 'completed',
                symptoms: 'Fever',
                startTime: '10:00 AM',
                endTime: '10:30 AM'
            });

            const res = await request(app)
                .get(`/api/doctors/patient/${patientUser._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.personal.email).toBe(patientUser.email);
            expect(res.body.history.length).toBeGreaterThan(0);
        });
    });

    // --- Features: Quick Notes, Photo, Start Next ---
    describe('POST /api/doctors/upload-photo', () => {
        it('should fail if no file uploaded (validation check)', async () => {
            const res = await request(app)
                .post('/api/doctors/upload-photo')
                .set('Authorization', `Bearer ${token}`);
            // Without attaching file, should 400
            expect(res.statusCode).toBe(400);
        });
    });

    describe('Quick Notes', () => {
        it('should add a quick note', async () => {
            const res = await request(app)
                .post('/api/doctors/quick-notes')
                .set('Authorization', `Bearer ${token}`)
                .send({ text: 'Patient needs follow up' });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('text', 'Patient needs follow up');
        });

        it('should get quick notes', async () => {
            // Add one first
            await request(app)
                .post('/api/doctors/quick-notes')
                .set('Authorization', `Bearer ${token}`)
                .send({ text: 'Note 1' });

            const res = await request(app)
                .get('/api/doctors/quick-notes')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
        });

        it('should delete a quick note', async () => {
            const addRes = await request(app)
                .post('/api/doctors/quick-notes')
                .set('Authorization', `Bearer ${token}`)
                .send({ text: 'To Delete' });
            const noteId = addRes.body._id;

            const res = await request(app)
                .delete(`/api/doctors/quick-notes/${noteId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
        });
    });

    describe('POST /api/doctors/start-next', () => {
        it('should start next appointment', async () => {
            // Create Patient
            const patient = await User.create({
                name: 'Patient X', mobile: '9999999999', email: 'p@x.com', password: 'pwd', role: 'patient'
            });

            // Create Hospital
            const hospital = await Hospital.create({ name: 'StartNext Hosp', address: 'Loc', phone: '123' });

            // Create Confirmed Appointment for TODAY
            const today = new Date();
            await Appointment.create({
                doctor: doctorProfile._id,
                patient: patient._id,
                hospital: hospital._id, // Fix: Add Hospital
                date: today,
                status: 'confirmed',
                reason: 'Checkup',
                startTime: '10:00 AM',
                endTime: '10:30 AM'
            });

            const res = await request(app)
                .post('/api/doctors/start-next')
                .set('Authorization', `Bearer ${token}`);

            // 200 OK
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/started/i);
            expect(res.body.appointment.status).toBe('in-progress');
        });
    });

    // --- Calendar Stats ---
    describe('GET /api/doctors/calendar/stats', () => {
        it('should get weekly calendar stats', async () => {
            const res = await request(app)
                .get('/api/doctors/calendar/stats')
                .query({ view: 'weekly', startDate: new Date().toISOString() })
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('timeSlots');
            expect(res.body).toHaveProperty('days');
        });
    });

    describe('GET /api/doctors/calendar/appointments', () => {
        it('should get appointments by date', async () => {
            const res = await request(app)
                .get('/api/doctors/calendar/appointments')
                .query({ date: new Date().toISOString() })
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });
});
