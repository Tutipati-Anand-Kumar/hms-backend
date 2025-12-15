import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import Note from '../../models/Note.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockDoctor = {
    name: 'Dr Writer',
    email: 'dr_notes@example.com',
    password: 'password123',
    role: 'doctor',
    mobile: '5551112222',
    consentGiven: true
};

let token;
let user;

describe('Note Routes Integration', () => {
    beforeEach(async () => {
        await User.deleteMany({ email: mockDoctor.email });
        await Note.deleteMany({});

        user = await User.create(mockDoctor);
        token = jwt.sign({ id: user._id, role: 'doctor' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
    });

    afterEach(async () => {
        await User.deleteMany({ email: mockDoctor.email });
        await Note.deleteMany({});
    });

    describe('POST /api/notes', () => {
        it('should create a note', async () => {
            const noteData = {
                text: "Remember to check...",
                doctorId: user._id
            };

            const res = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${token}`)
                .send(noteData);

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('text', 'Remember to check...');
        });
    });

    describe('GET /api/notes/:doctorId', () => {
        it('should retrieve notes for a doctor', async () => {
            await Note.create({
                doctor: user._id,
                text: "Existing Note"
            });

            const res = await request(app)
                .get(`/api/notes/${user._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            expect(res.body[0]).toHaveProperty('text', 'Existing Note');
        });
    });

    describe('DELETE /api/notes/:id', () => {
        it('should delete a specific note', async () => {
            const note = await Note.create({
                doctor: user._id,
                text: "To Delete"
            });

            const res = await request(app)
                .delete(`/api/notes/${note._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/deleted/i);

            const check = await Note.findById(note._id);
            expect(check).toBeNull();
        });
    });

    describe('DELETE /api/notes/all/:doctorId', () => {
        it('should delete all notes for a doctor', async () => {
            await Note.create({ doctor: user._id, text: "Note 1" });
            await Note.create({ doctor: user._id, text: "Note 2" });

            const res = await request(app)
                .delete(`/api/notes/all/${user._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/deleted/i);

            const count = await Note.countDocuments({ doctor: user._id });
            expect(count).toBe(0);
        });
    });
});
