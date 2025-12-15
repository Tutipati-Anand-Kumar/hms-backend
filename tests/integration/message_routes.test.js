import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import Message from '../../models/Message.js';
import Hospital from '../../models/Hospital.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockSender = {
    name: 'Sender User',
    email: 'sender@example.com',
    password: 'password123',
    role: 'patient',
    mobile: '1231231234',
    consentGiven: true
};

const mockReceiver = {
    name: 'Receiver User',
    email: 'receiver@example.com',
    password: 'password123',
    role: 'doctor',
    mobile: '3213214321',
    consentGiven: true
};

let senderToken;
let sender, receiver, hospital;

describe('Message Routes Integration', () => {
    beforeEach(async () => {
        await User.deleteMany({ email: { $in: [mockSender.email, mockReceiver.email] } });
        await Message.deleteMany({});
        await Hospital.deleteMany({});

        sender = await User.create(mockSender);
        receiver = await User.create(mockReceiver);
        hospital = await Hospital.create({ name: "Msg Hospital", address: "City", contactNumber: "0000000000" });

        senderToken = jwt.sign({ id: sender._id, role: 'patient' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
    });

    afterEach(async () => {
        await User.deleteMany({ email: { $in: [mockSender.email, mockReceiver.email] } });
        await Message.deleteMany({});
        await Hospital.deleteMany({});
    });

    describe('POST /api/messages', () => {
        it('should send a message', async () => {
            const msgData = {
                receiverId: receiver._id,
                content: "Hello Doctor",
                hospitalId: hospital._id
            };

            const res = await request(app)
                .post('/api/messages')
                .set('Authorization', `Bearer ${senderToken}`)
                .send(msgData);

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('content', 'Hello Doctor');
        });
    });

    describe('GET /api/messages/conversation/:otherUserId', () => {
        it('should get conversation', async () => {
            await Message.create({
                sender: sender._id,
                receiver: receiver._id,
                content: "Previous Message",
                hospital: hospital._id
            });

            const res = await request(app)
                .get(`/api/messages/conversation/${receiver._id}`)
                .set('Authorization', `Bearer ${senderToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/messages/conversations', () => {
        it('should list conversations', async () => {
            await Message.create({
                sender: sender._id,
                receiver: receiver._id,
                content: "Convo Starter",
                hospital: hospital._id
            });

            const res = await request(app)
                .get('/api/messages/conversations')
                .set('Authorization', `Bearer ${senderToken}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('DELETE /api/messages/:messageId', () => {
        it('should delete a message', async () => {
            const msg = await Message.create({
                sender: sender._id,
                receiver: receiver._id,
                content: "To Delete",
                hospital: hospital._id
            });

            const res = await request(app)
                .delete(`/api/messages/${msg._id}`)
                .set('Authorization', `Bearer ${senderToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/deleted/i);
        });
    });
});
