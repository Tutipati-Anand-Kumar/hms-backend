import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import Prescription from '../../models/Prescription.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockDoctor = {
    name: 'Dr Writer',
    email: 'drwriter@example.com',
    password: 'password123',
    role: 'doctor',
    mobile: '5555555555',
    consentGiven: true
};

const mockPatient = {
    name: 'Patient Receiver',
    email: 'patreceiver@example.com',
    password: 'password123',
    role: 'patient',
    mobile: '6666666666',
    consentGiven: true
};

let doctorToken, patientToken;
let doctorUser, patientUser;

describe('Prescription Routes Integration', () => {
    beforeEach(async () => {
        await User.deleteMany({ email: { $in: [mockDoctor.email, mockPatient.email] } });
        await Prescription.deleteMany({});

        doctorUser = await User.create(mockDoctor);
        patientUser = await User.create(mockPatient);

        doctorToken = jwt.sign({ id: doctorUser._id, role: 'doctor' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
        patientToken = jwt.sign({ id: patientUser._id, role: 'patient' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
    });

    afterEach(async () => {
        await User.deleteMany({ email: { $in: [mockDoctor.email, mockPatient.email] } });
        await Prescription.deleteMany({});
    });

    describe('POST /api/prescriptions', () => {
        it('should create a prescription', async () => {
            const presData = {
                patient: patientUser._id, // Controller expects 'patient'
                medicines: ["Paracetamol 500mg - Bid"], // Schema expects string array
                notes: "Take rest"
            };

            const res = await request(app)
                .post('/api/prescriptions')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send(presData);

            if (res.statusCode !== 201) console.log("Create Prescription Fail:", res.body);

            expect(res.statusCode).toBe(201);
            expect(res.body.prescription).toHaveProperty('medicines');
        });
    });

    describe('GET /api/prescriptions', () => {
        it('should get prescriptions for patient', async () => {
            await Prescription.create({
                doctor: doctorUser._id,
                patient: patientUser._id,
                medicines: ["Test Meds"],
                notes: "Test Note"
            });

            const res = await request(app)
                .get('/api/prescriptions')
                .set('Authorization', `Bearer ${patientToken}`); // Patient fetching own

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/prescriptions/:id', () => {
        it('should get prescription by ID', async () => {
            const pres = await Prescription.create({
                doctor: doctorUser._id,
                patient: patientUser._id,
                medicines: ["Specific Med"],
                notes: "Specific details"
            });

            const res = await request(app)
                .get(`/api/prescriptions/${pres._id}`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body._id).toBe(pres._id.toString());
            expect(res.body.notes).toBe("Specific details");
        });
    });
});
