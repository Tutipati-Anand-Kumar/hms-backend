import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import Hospital from '../../models/Hospital.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockAdmin = {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin',
    mobile: '9999999999',
    consentGiven: true
};

let adminToken;
let hospitalId;

describe('Hospital Routes Integration', () => {
    beforeEach(async () => {
        await User.deleteMany({ email: mockAdmin.email });
        await Hospital.deleteMany({});

        const adminUser = await User.create(mockAdmin);
        adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });

        const hospital = await Hospital.create({
            name: 'Test Hospital',
            address: 'Test Address',
            city: 'Test City',
            contactNumber: '9876543210'
        });
        hospitalId = hospital._id;
    });

    afterEach(async () => {
        await User.deleteMany({ email: mockAdmin.email });
        await Hospital.deleteMany({});
    });

    describe('POST /api/hospitals', () => {
        it('should create a new hospital', async () => {
            const res = await request(app)
                .post('/api/hospitals')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'New Hospital',
                    address: 'New Address',
                    city: 'New City',
                    contactNumber: '1231231234'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('name', 'New Hospital');
            expect(res.body).toHaveProperty('hospitalId');
        });
    });

    describe('GET /api/hospitals', () => {
        it('should list all hospitals', async () => {
            const res = await request(app).get('/api/hospitals');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/hospitals/:id', () => {
        it('should get hospital details', async () => {
            const res = await request(app).get(`/api/hospitals/${hospitalId}`);
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('name', 'Test Hospital');
        });
    });

    describe('PATCH /api/hospitals/:id', () => {
        it('should update hospital details', async () => {
            const res = await request(app)
                .patch(`/api/hospitals/${hospitalId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated Hospital' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('name', 'Updated Hospital');
        });
    });

    describe('POST /api/hospitals/:id/branches', () => {
        it('should add a branch to hospital', async () => {
            const res = await request(app)
                .post(`/api/hospitals/${hospitalId}/branches`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Branch 1',
                    address: 'Branch Address'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.branches.length).toBe(1);
            expect(res.body.branches[0].name).toBe('Branch 1');
        });
    });

    describe('GET /api/hospitals/:id/branches', () => {
        it('should list branches of a hospital', async () => {
            // First add a branch
            await request(app)
                .post(`/api/hospitals/${hospitalId}/branches`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Branch 1', address: 'Addr 1' });

            const res = await request(app)
                .get(`/api/hospitals/${hospitalId}/branches`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
        });
    });
});
