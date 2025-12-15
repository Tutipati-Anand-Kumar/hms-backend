import request from 'supertest';
import { app } from '../../app.js';
import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import User from '../../models/User.js';
import DoctorProfile from '../../models/DoctorProfile.js';
import Hospital from '../../models/Hospital.js';

// We don't necessarily need auth for these routes based on the provided route file? 
// The user didn't show the `aiRoutes.js` imports, assuming they might be protected or public.
// Wait, typically AI routes might be protected. 
// Looking at the user's request `router.post("/check-symptoms", checkSymptoms);` -> It didn't have `protect` middleware in the snippet provided by user.
// But standard practice might imply it. The user snippet:
// `router.post("/check-symptoms", checkSymptoms);`
// `router.post("/prescription", generatePrescription);`
// It seems they are PUBLIC based on the snippet. I will assume public.

describe('AI Routes Integration', () => {

    // Setup/Teardown to be safe, though these tests might not hit DB much
    beforeAll(async () => {
        // Just in case we need DB clean
    });

    afterAll(async () => {
        // Clean up
    });

    describe('POST /api/ai/check-symptoms', () => {
        it('should validate input for symptoms (return 400 if missing)', async () => {
            const res = await request(app)
                .post('/api/ai/check-symptoms')
                .send({}); // Empty body

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/required/i);
        });

        it('should return analysis for valid symptoms', async () => {
            const res = await request(app)
                .post('/api/ai/check-symptoms')
                .send({
                    symptoms: ["fever", "headache"],
                    age: 25,
                    gender: "Male"
                });

            // Even if it relies on DB for doctors, it should return at least urgency
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('urgency');
            expect(res.body).toHaveProperty('doctors');
        });
    });

    describe('POST /api/ai/prescription', () => {
        it('should validate input for symptoms (return 400 if missing)', async () => {
            const res = await request(app)
                .post('/api/ai/prescription')
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/required/i);
        });

        it('should generate prescription (fallback or AI) for valid input', async () => {
            // This test allows for the AI to fail (e.g. no API key) and hit the fallback
            const res = await request(app)
                .post('/api/ai/prescription')
                .send({
                    symptoms: "fever, cold",
                    patientDetails: { age: 30, gender: "Female" }
                });

            expect(res.statusCode).toBe(200);
            // The controller ensures these fields exist even in fallback
            expect(res.body).toHaveProperty('medicines');
            expect(res.body).toHaveProperty('diet_advice');
            expect(Array.isArray(res.body.medicines)).toBe(true);
        });
    });
});
