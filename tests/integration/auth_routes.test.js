import request from 'supertest';
import { app } from '../../app.js';
import User from '../../models/User.js';
import OTP from '../../models/OTP.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock data
const mockUser = {
    name: 'Test User',
    mobile: '1234567890',
    email: 'test@example.com',
    password: 'password123',
    otp: '123456',
    consentGiven: true
};

// Mock sendEmail
jest.mock('../../utils/sendEmail.js', () => jest.fn());

describe('Auth Routes Integration', () => {
    beforeEach(async () => {
        // Clean up data before each test
        await User.deleteMany({ email: mockUser.email });
        await User.deleteMany({ mobile: mockUser.mobile });
        await OTP.deleteMany({ mobile: mockUser.mobile });
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully with valid OTP', async () => {
            // Seed valid OTP in database
            const otpHash = crypto.createHash("sha256").update(mockUser.otp).digest("hex");
            await OTP.create({
                mobile: mockUser.mobile,
                otpHash,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send(mockUser);

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('tokens');
            expect(res.body.user).toHaveProperty('mobile', mockUser.mobile);
        });

        it('should fail with invalid OTP', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ ...mockUser, otp: '000000' });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('POST /api/auth/send-otp', () => {
        it('should send OTP successfully', async () => {
            const res = await request(app)
                .post('/api/auth/send-otp')
                .send({ mobile: mockUser.mobile, email: mockUser.email });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('message', 'OTP sent successfully');

            // Verify OTP is created in DB
            const otp = await OTP.findOne({ mobile: mockUser.mobile });
            expect(otp).toBeTruthy();
        });
    });

    describe('POST /api/auth/verify-otp', () => {
        it('should verify valid OTP', async () => {
            const otpHash = crypto.createHash("sha256").update(mockUser.otp).digest("hex");
            await OTP.create({
                mobile: mockUser.mobile,
                otpHash,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            });

            const res = await request(app)
                .post('/api/auth/verify-otp')
                .send({ mobile: mockUser.mobile, otp: mockUser.otp });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('message', 'OTP verified');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            // Create user
            const hashedPassword = await bcrypt.hash(mockUser.password, 10);
            await new User({
                ...mockUser,
                password: hashedPassword,
                role: 'patient'
            }).save();
        });

        it('should login successfully with correct credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: mockUser.mobile,
                    password: mockUser.password
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('tokens');
        });

        it('should fail with incorrect password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: mockUser.mobile,
                    password: 'wrongpassword'
                });

            expect(res.statusCode).toBe(401);
        });
    });

    describe('Token Management & Logout', () => {
        let refreshToken;
        let accessToken;

        beforeEach(async () => {
            const hashedPassword = await bcrypt.hash(mockUser.password, 10);
            const user = await new User({
                ...mockUser,
                password: hashedPassword,
                role: 'patient'
            }).save();

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: mockUser.mobile,
                    password: mockUser.password
                });
            refreshToken = res.body.tokens.refreshToken;
            accessToken = res.body.tokens.accessToken;
        });

        it('should refresh token successfully', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken });

            expect(res.statusCode).toBe(200);
            expect(res.body.tokens).toHaveProperty('accessToken');
            expect(res.body.tokens).toHaveProperty('refreshToken');
        });

        it('should logout successfully', async () => {
            const res = await request(app)
                .post('/api/auth/logout')
                .send({ refreshToken });

            expect(res.statusCode).toBe(204);

            // Verify refresh token is invalidated
            const resRef = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken });
            expect(resRef.statusCode).toBe(401);
        });

        it('should get current user profile (me)', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('mobile', mockUser.mobile);
        });
    });

    describe('Password Recovery', () => {
        beforeEach(async () => {
            const hashedPassword = await bcrypt.hash(mockUser.password, 10);
            await new User({
                ...mockUser,
                password: hashedPassword,
                role: 'patient'
            }).save();
        });

        it('should send forgot password email', async () => {
            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: mockUser.email });

            expect(res.statusCode).toBe(200);
            // Check if user has reset token
            const user = await User.findOne({ email: mockUser.email });
            expect(user.resetPasswordToken).toBeTruthy();
        });

        it('should reset password with valid token', async () => {
            // Manually set reset token
            const resetToken = 'reset123';
            const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

            await User.updateOne(
                { email: mockUser.email },
                {
                    resetPasswordToken: hashedToken,
                    resetPasswordExpire: Date.now() + 10 * 60 * 1000
                }
            );

            const res = await request(app)
                .patch('/api/auth/reset-password')
                .send({ token: resetToken, newPwd: 'newpassword123' });

            expect(res.statusCode).toBe(200);

            // Verify login with new password
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: mockUser.mobile,
                    password: 'newpassword123'
                });
            expect(loginRes.statusCode).toBe(200);
        });
    });
});
