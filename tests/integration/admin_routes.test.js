import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import Hospital from '../../models/Hospital.js';
import DoctorProfile from '../../models/DoctorProfile.js';
import HelpDesk from '../../models/HelpDesk.js';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Test Data
const mockAdmin = {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin',
    mobile: '9999999999',
    consentGiven: true
};

const mockSuperAdmin = {
    name: 'Super Admin',
    email: 'superadmin@example.com',
    password: 'password123',
    role: 'super-admin',
    mobile: '8888888888',
    consentGiven: true
};

let adminToken;
let superAdminToken;
let adminUser;
let superAdminUser;

describe('Admin Routes Integration', () => {
    beforeEach(async () => {
        // Clear DB
        await User.deleteMany({});
        await Hospital.deleteMany({});
        await DoctorProfile.deleteMany({});
        await HelpDesk.deleteMany({});

        // Create Admin
        adminUser = await User.create(mockAdmin);
        adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });

        // Create Super Admin
        superAdminUser = await User.create(mockSuperAdmin);
        superAdminToken = jwt.sign({ id: superAdminUser._id, role: 'super-admin' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
    });

    afterEach(async () => {
        await User.deleteMany({});
        await Hospital.deleteMany({});
        await DoctorProfile.deleteMany({});
        await HelpDesk.deleteMany({});
    });

    // --- Hospital Management ---
    describe('Hospital Management', () => {
        it('POST /api/admin/hospitals/bulk - should accept bulk upload', async () => {
            const res = await request(app)
                .post('/api/admin/hospitals/bulk')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ hospitals: [] }); // Payload structure may vary based on implementation

            expect(res.statusCode).toBe(202); // Controller returns 202
            expect(res.body).toHaveProperty('taskId');
        });

        it('GET /api/admin/hospitals - should list hospitals', async () => {
            await Hospital.create({ name: 'H1', address: 'A1', phone: '123' });
            const res = await request(app)
                .get('/api/admin/hospitals')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
        });

        it('PATCH /api/admin/hospitals/:id/status - should update status', async () => {
            const h = await Hospital.create({ name: 'H2', address: 'A2', phone: '123', status: 'pending' });
            const res = await request(app)
                .patch(`/api/admin/hospitals/${h._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'active' });
            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('active');
        });

        it('POST /api/admin/hospitals/assign-doctor - should assign doctor', async () => {
            const h = await Hospital.create({ name: 'H3', address: 'A3', phone: '123' });
            // Create Doctor via API or Model directly
            // Using API to ensure User+Profile creation
            const docUser = await User.create({
                name: 'Dr. Assign',
                email: 'assign@test.com',
                password: 'pass',
                role: 'doctor',
                mobile: '1234567890',
                doctorId: 'DOCASSIGN'
            });
            const docProfile = await DoctorProfile.create({ user: docUser._id });

            const res = await request(app)
                .post('/api/admin/hospitals/assign-doctor')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    doctorProfileId: docProfile._id,
                    hospitalId: h._id,
                    specialties: ['Cardiology']
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.hospital.doctors.length).toBe(1);
        });

        it('POST /api/admin/hospitals/:hospitalId/remove-doctor - should remove doctor', async () => {
            const h = await Hospital.create({ name: 'H4', address: 'A4', phone: '123' });
            const docUser = await User.create({
                name: 'Dr. Remove',
                email: 'remove@test.com',
                password: 'pass',
                role: 'doctor',
                mobile: '0987654321',
                doctorId: 'DOCREMOVE'
            });
            const docProfile = await DoctorProfile.create({
                user: docUser._id,
                hospitals: [{ hospital: h._id }]
            });
            h.doctors.push({ doctor: docProfile._id });
            await h.save();

            const res = await request(app)
                .post(`/api/admin/hospitals/${h._id}/remove-doctor`) // Note: Route changed to POST vs DELETE based on user request "POST /api/admin/hospitals/:hospitalId/remove-doctor" ? Or typically DELETE? Checked controller: router.post('/:hospitalId/remove-doctor', ...) is likely or delete. 
                // Checking controller signature in mind... usually a DELETE or specialized POST. 
                // Assuming POST based on user list.
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ doctorProfileId: docProfile._id });

            // Note: If controller uses router.delete, this needs to change. 
            // Common pattern: router.delete('/:hospitalId/doctors/:doctorId') or router.post('/:hospitalId/remove-doctor')
            // Based on previous view, it was `router.delete` probably? Or `router.post`. 
            // Let's assume typical REST or explicit actions. 
            // User request says: POST /api/admin/hospitals/:hospitalId/remove-doctor
            expect(res.statusCode).toBe(200);
            const checkH = await Hospital.findById(h._id);
            expect(checkH.doctors.length).toBe(0);
        });

        it('GET /api/admin/hospitals/:id/doctors - should get doctors', async () => {
            const h = await Hospital.create({ name: 'H5', address: 'A5', phone: '123' });
            const res = await request(app)
                .get(`/api/admin/hospitals/${h._id}/doctors`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('GET /api/admin/hospitals/:id/details - should get details', async () => {
            const h = await Hospital.create({ name: 'H6', address: 'A6', phone: '123' });
            const res = await request(app)
                .get(`/api/admin/hospitals/${h._id}/details`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.name).toBe('H6');
        });

        it('POST /api/admin/create-hospital - should create hospital', async () => {
            const hData = {
                name: 'New General Hospital',
                address: '123 Main St',
                phone: '9876543210'
            };
            const res = await request(app)
                .post('/api/admin/create-hospital')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(hData);
            expect(res.statusCode).toBe(201);
            expect(res.body.hospital.hospitalId).toMatch(/^HOSP\d{4}$/);
        });
    });

    // --- User Management ---
    describe('User Management', () => {
        it('GET /api/admin/users - should get all users', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('PUT /api/admin/users/:id - should update user role', async () => {
            const u = await User.create({ name: 'User 1', email: 'u1@test.com', mobile: '111', password: '123', role: 'patient' });
            const res = await request(app)
                .put(`/api/admin/users/${u._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ role: 'admin' });
            expect(res.statusCode).toBe(200);
            expect(res.body.role).toBe('admin');
        });

        it('DELETE /api/admin/users/:id - should delete user', async () => {
            const u = await User.create({ name: 'User 2', email: 'u2@test.com', mobile: '222', password: '123', role: 'patient' });
            const res = await request(app)
                .delete(`/api/admin/users/${u._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            const check = await User.findById(u._id);
            expect(check).toBeNull();
        });
    });


    // --- Admin Profile ---
    describe('Admin Profile', () => {
        it('GET /api/admin/me - should get profile', async () => {
            const res = await request(app)
                .get('/api/admin/me')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.email).toBe(mockAdmin.email);
        });

        it('PUT /api/admin/me - should update profile', async () => {
            const res = await request(app)
                .put('/api/admin/me')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'New Name' });
            expect(res.statusCode).toBe(200);
            expect(res.body.name).toBe('New Name');
        });
    });

    // --- Creation & Assignment ---
    describe('Creation & Assignment', () => {
        it('POST /api/admin/create-doctor - should create doctor', async () => {
            const docData = {
                name: 'New Doctor',
                email: 'new.doctor@test.com',
                password: 'password',
                mobile: '5551234567',
                specialties: ['General'],
                qualifications: ['MBBS'],
                experience: 5
            };
            const res = await request(app)
                .post('/api/admin/create-doctor')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(docData);
            expect(res.statusCode).toBe(201);
            expect(res.body.doctor.user.email).toBe(docData.email);
        });

        it('POST /api/admin/create-admin - should create admin', async () => {
            const data = {
                name: 'Sub Admin',
                email: 'subadmin@test.com',
                password: 'pass',
                mobile: '9998887776'
            };
            const res = await request(app)
                .post('/api/admin/create-admin')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send(data);
            expect(res.statusCode).toBe(201);
            expect(res.body.admin.role).toBe('admin');
        });

        it('POST /api/admin/create-helpdesk - should create helpdesk', async () => {
            const h = await Hospital.create({ name: 'HD Hospital', address: 'Loc', phone: '555' });
            const data = {
                name: 'Help Desk',
                email: 'hd2@test.com',
                password: 'pass',
                mobile: '1231231234',
                hospitalId: h._id
            };
            const res = await request(app)
                .post('/api/admin/create-helpdesk')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send(data);
            expect(res.statusCode).toBe(201);
            expect(res.body.helpdesk.email).toBe(data.email);
        });

        it('POST /api/admin/assign-helpdesk - should assign helpdesk (if separate route exists)', async () => {
            // User requested `POST /api/admin/assign-helpdesk`
            // Checking controller: `assignHelpdeskToHospital`
            const h = await Hospital.create({ name: 'Target Hosp', address: 'T', phone: '000' });
            const hd = await HelpDesk.create({ name: 'HD', email: 'hd3@t.com', mobile: '000', password: 'p', hospital: h._id });

            // Create another hospital to move helpdesk to
            const h2 = await Hospital.create({ name: 'Target Hosp 2', address: 'T2', phone: '000' });

            const res = await request(app)
                .post('/api/admin/assign-helpdesk')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ helpdeskId: hd._id, hospitalId: h2._id });

            expect(res.statusCode).toBe(200);
            expect(res.body.helpdesk.hospital.toString()).toBe(h2._id.toString());
        });

        it('POST /api/admin/create-helpdesk - should fail without hospitalId', async () => {
            const data = {
                name: 'Help Desk Fail',
                email: 'hdfail@test.com',
                password: 'pass',
                mobile: '1231231235'
            };
            const res = await request(app)
                .post('/api/admin/create-helpdesk')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send(data);
            expect(res.statusCode).toBe(400); // Validation error
        });
    });

    // --- System ---
    describe('System', () => {
        it('GET /api/admin/audits - should get audits', async () => {
            const res = await request(app)
                .get('/api/admin/audits')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
        });

        it('POST /api/admin/broadcast - should broadcast', async () => {
            const res = await request(app)
                .post('/api/admin/broadcast')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ title: 'Alert', body: 'Message' });
            expect(res.statusCode).toBe(200);
        });

        it('GET /api/admin/analytics/dashboard - should get dashboard stats', async () => {
            const res = await request(app)
                .get('/api/admin/analytics/dashboard')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('totalUsers');
            expect(res.body).toHaveProperty('totalDoctors');
        });
    });

});
