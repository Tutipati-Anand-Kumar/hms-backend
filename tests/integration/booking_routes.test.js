import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import Appointment from '../../models/Appointment.js';
import DoctorProfile from '../../models/DoctorProfile.js';
import Hospital from '../../models/Hospital.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockPatient = {
    name: 'Patient User',
    email: 'patient_book@example.com',
    password: 'password123',
    role: 'patient',
    mobile: '1231231234',
    consentGiven: true
};

const mockDoctor = {
    name: 'Doctor User',
    email: 'doctor_book@example.com',
    password: 'password123',
    role: 'doctor',
    mobile: '3213214321',
    consentGiven: true
};

let patientToken, doctorToken;
let patientUser, doctorUser, doctorProfile, hospital;

describe('Booking Routes Integration', () => {
    beforeEach(async () => {
        // Clear DB
        await User.deleteMany({ email: { $in: [mockPatient.email, mockDoctor.email] } });
        await Appointment.deleteMany({});
        await DoctorProfile.deleteMany({});
        await Hospital.deleteMany({});

        // Create Users
        patientUser = await User.create(mockPatient);
        doctorUser = await User.create(mockDoctor);

        // Create Hospital
        hospital = await Hospital.create({ name: "Gen Hospital", address: "City", contactNumber: "0000000000" });

        // Create Doctor Profile with Availability
        doctorProfile = await DoctorProfile.create({
            user: doctorUser._id,
            specialties: ['General'],
            hospitals: [{
                hospital: hospital._id,
                consultationFee: 500,
                availability: [
                    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], startTime: '09:00 AM', endTime: '05:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' }
                ]
            }]
        });

        // Generate Tokens
        patientToken = jwt.sign({ id: patientUser._id, role: 'patient' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
        doctorToken = jwt.sign({ id: doctorUser._id, role: 'doctor' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
    });

    afterEach(async () => {
        await User.deleteMany({ email: { $in: [mockPatient.email, mockDoctor.email] } });
        await Appointment.deleteMany({});
        await DoctorProfile.deleteMany({});
        await Hospital.deleteMany({});
    });

    describe('POST /api/bookings/book', () => {
        it('should book an appointment', async () => {
            // Ensure date is a future weekday to match availability
            const date = new Date();
            date.setDate(date.getDate() + 1); // Tomorrow
            const dateStr = date.toISOString().split('T')[0];

            // NOTE: The controller logic tries to find exact slot match OR hourly block match.
            // Let's use an hourly block format "10:00 AM - 11:00 AM" which the controller seems to support heavily.
            const bookingData = {
                doctorId: doctorProfile._id,
                date: dateStr,
                timeSlot: "10:00 AM - 11:00 AM",
                hospitalId: hospital._id,
                reason: "Checkup",
                type: "offline",
                patientDetails: { age: 30, gender: "Male" }
            };

            const res = await request(app)
                .post('/api/bookings/book')
                .set('Authorization', `Bearer ${patientToken}`)
                .send(bookingData);

            if (res.statusCode !== 201) console.log("Booking Fail:", res.body);

            expect(res.statusCode).toBe(201);
            expect(res.body.appointment).toHaveProperty('status', 'pending');
            const savedApp = await Appointment.findById(res.body.appointment._id);
            expect(savedApp).not.toBeNull();
        });
    });

    describe('GET /api/bookings/availability', () => {
        it('should return available slots', async () => {
            const date = new Date();
            date.setDate(date.getDate() + 1); // Tomorrow
            const dateStr = date.toISOString().split('T')[0];

            const res = await request(app)
                .get('/api/bookings/availability')
                .query({ doctorId: doctorProfile._id.toString(), hospitalId: hospital._id.toString(), date: dateStr })
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('slots');
            expect(Array.isArray(res.body.slots)).toBe(true);
            expect(res.body.slots.length).toBeGreaterThan(0);
            // Verify structure of slot
            if (res.body.slots.length > 0) {
                expect(res.body.slots[0]).toHaveProperty('timeSlot');
                expect(res.body.slots[0]).toHaveProperty('availableCount');
            }
        });
    });

    describe('GET /api/bookings/hospital-stats', () => {
        it('should return hourly stats for day view', async () => {
            const dateStr = new Date().toISOString().split('T')[0];
            const res = await request(app)
                .get('/api/bookings/hospital-stats')
                .query({ hospitalId: hospital._id.toString(), date: dateStr })
                .set('Authorization', `Bearer ${doctorToken}`); // Doctor or Admin could call this

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(24); // 24 hours
        });

        it('should return weekly stats', async () => {
            const dateStr = new Date().toISOString().split('T')[0];
            const res = await request(app)
                .get('/api/bookings/hospital-stats')
                .query({ hospitalId: hospital._id.toString(), date: dateStr, range: 'week' })
                .set('Authorization', `Bearer ${doctorToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('period', 'week');
            expect(res.body).toHaveProperty('dailyStats');
        });
    });

    describe('PUT /api/bookings/status/:id', () => {
        it('should update appointment status', async () => {
            // Create dummy appointment
            const appt = await Appointment.create({
                patient: patientUser._id,
                doctor: doctorProfile._id, // NOTE: Appointment model links to User or Profile?
                // Controller `bookAppointment` uses `doctor: doctorId` where doctorId is Profile ID.
                // Model usually refs User for doctor field? 
                // Let's check `process.env`... wait, `bookAppointment` lines: `const doctor = await DoctorProfile.findById(doctorId)...`
                // But `Appointment.create` calls `doctor: doctorId` (Profile ID).
                // Wait, Appointment Schema usually refs User. 
                // Let's assume Profile ID is stored or User ID. Ideally User ID.
                // The controller `bookAppointment` implies `doctor: doctorId` which is PROFILE ID passed from body.
                // Let's use Profile ID here to match controller behavior, 
                // OR better yet, verify what Appointment Model expects.
                // Assuming controller works, it stores Profile ID ? Or maybe logic inside extracts User ID?
                // `bookAppointment`: `const appointment = await Appointment.create({... doctor: doctorId ...})` -> Stores what was passed.
                // So it stores Profile ID. 

                doctor: doctorProfile._id,
                hospital: hospital._id,
                date: new Date(),
                startTime: "10:00 AM",
                endTime: "11:00 AM",
                status: "pending"
            });

            // Doctor updates status
            const res = await request(app)
                .put(`/api/bookings/status/${appt._id}`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({ status: 'confirmed' });

            expect(res.statusCode).toBe(200);
            expect(res.body.appointment.status).toBe('confirmed');
        });
    });

    describe('GET /api/bookings/my-appointments', () => {
        it('should list patient appointments', async () => {
            await Appointment.create({
                patient: patientUser._id,
                doctor: doctorProfile._id,
                hospital: hospital._id,
                date: new Date(),
                startTime: "10:00 AM",
                endTime: "11:00 AM",
                status: "confirmed"
            });

            const res = await request(app)
                .get('/api/bookings/my-appointments')
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });
    });
});
