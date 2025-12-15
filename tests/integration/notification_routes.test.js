import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import Notification from '../../models/Notification.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockUser = {
    name: 'Notif User',
    email: 'user_notif@example.com',
    password: 'password123',
    role: 'patient',
    mobile: '1122334455',
    consentGiven: true
};

let token;
let user;

describe('Notification Routes Integration', () => {
    beforeEach(async () => {
        await User.deleteMany({ email: mockUser.email });
        await Notification.deleteMany({});

        user = await User.create(mockUser);
        token = jwt.sign({ id: user._id, role: 'patient' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
    });

    afterEach(async () => {
        await User.deleteMany({ email: mockUser.email });
        await Notification.deleteMany({});
    });

    describe('GET /api/notifications', () => {
        it('should get notifications for user', async () => {
            await Notification.create({
                recipient: user._id,
                message: "Test Notif",
                type: "system_alert"
            });

            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });
    });

    describe('PUT /api/notifications/:id/read', () => {
        it('should mark notification as read', async () => {
            const notif = await Notification.create({
                recipient: user._id,
                message: "Read Me",
                type: "system_alert",
                isRead: false
            });

            const res = await request(app)
                .put(`/api/notifications/${notif._id}/read`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('isRead', true);
        });
    });

    describe('PUT /api/notifications/read-all', () => {
        it('should mark all notifications as read', async () => {
            await Notification.create({ recipient: user._id, message: "1", type: "system_alert", isRead: false });
            await Notification.create({ recipient: user._id, message: "2", type: "system_alert", isRead: false });

            const res = await request(app)
                .put('/api/notifications/read-all')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);

            const count = await Notification.countDocuments({ recipient: user._id, isRead: false });
            expect(count).toBe(0);
        });
    });

    describe('POST /api/notifications/emergency', () => {
        it('should create emergency alerts', async () => {
            // Need a hospital for emergency alert
            const Hospital = (await import('../../models/Hospital.js')).default;
            const hospital = await Hospital.create({
                name: "Emerg Hospital",
                address: "Emerg Address",
                contactNumber: "9119119111"
            });

            const res = await request(app)
                .post('/api/notifications/emergency')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    message: "Help!",
                    hospitalId: hospital._id
                });

            // Clean up hospital
            await Hospital.findByIdAndDelete(hospital._id);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/sent/i);
        });
    });

    describe('DELETE /api/notifications/type/emergency', () => {
        it('should delete emergency alerts', async () => {
            await Notification.create({ recipient: user._id, message: "Emergency", type: "emergency_alert" });

            const res = await request(app)
                .delete('/api/notifications/type/emergency')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);

            const count = await Notification.countDocuments({ recipient: user._id, type: "emergency_alert" });
            expect(count).toBe(0);
        });
    });

    describe('DELETE /api/notifications/:id', () => {
        it('should delete notification', async () => {
            const notif = await Notification.create({
                recipient: user._id,
                message: "Delete Me",
                type: "system_alert"
            });

            const res = await request(app)
                .delete(`/api/notifications/${notif._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);

            const check = await Notification.findById(notif._id);
            expect(check).toBeNull();
        });
    });
});
