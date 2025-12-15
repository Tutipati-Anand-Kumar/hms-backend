import { jest } from '@jest/globals';
import request from 'supertest';

// Mock auth middleware BEFORE importing app
jest.unstable_mockModule('../../middleware/authMiddleware.js', () => ({
    protect: (req, res, next) => {
        req.user = { _id: "507f1f77bcf86cd799439011", name: "Test User", role: "patient", email: "test@example.com" };
        next();
    },
    authorize: (...roles) => (req, res, next) => next()
}));

// Mock upload middleware
jest.unstable_mockModule('../../middleware/upload.js', () => ({
    default: {
        array: () => (req, res, next) => next(),
        single: () => (req, res, next) => next()
    }
}));

// Mock Support Request Model
const mockSupportSave = jest.fn();
jest.unstable_mockModule('../../models/SupportRequest.js', () => ({
    default: class MockSupportRequest {
        constructor(data) { Object.assign(this, data); }
        save() { mockSupportSave(); return Promise.resolve(this); }
    }
}));

// Dynamic import of app
const { app } = await import('../../app.js');

describe('Support Routes Integration', () => {
    describe('POST /api/support', () => {
        it('should create a support request', async () => {
            const supportData = {
                subject: "Tech Issue",
                message: "Need help",
                type: "technical"
            };

            const res = await request(app)
                .post('/api/support')
                .send(supportData);

            expect([200, 201]).toContain(res.statusCode);
            expect(res.body).toHaveProperty('success', true);
        });
    });
});
