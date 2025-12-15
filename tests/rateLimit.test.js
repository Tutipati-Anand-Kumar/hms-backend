import request from "supertest";
import { app } from "../app.js"; // Adjust import path if needed
import { jest } from "@jest/globals";

// Increase timeout for rate limit tests specifically
jest.setTimeout(30000);

describe("Rate Limiting Tests", () => {
    let originalEnv;

    beforeAll(() => {
        // Save original env
        originalEnv = process.env.NODE_ENV;
        // Set to development to ENABLE rate limiting (skip logic in app.js checks for 'test')
        process.env.NODE_ENV = 'development';
    });

    afterAll(() => {
        // Restore original env
        process.env.NODE_ENV = originalEnv;
    });

    describe("General API Rate Limiting", () => {
        it("should allow requests under the limit", async () => {
            // General limit is 100 per 15 min. sending 5 requests is fine.
            for (let i = 0; i < 5; i++) {
                const res = await request(app).get("/api/health");
                expect(res.statusCode).not.toBe(429);
            }
        });

        // Validating specific general routes (e.g. Doctors)
        it("should include RateLimit headers", async () => {
            const res = await request(app).get("/api/health");
            expect(res.headers).toHaveProperty("ratelimit-limit");
            expect(res.headers).toHaveProperty("ratelimit-remaining");
        });
    });

    describe("Auth API Rate Limiting (Stricter)", () => {

        it("should enforce stricter limits on auth routes", async () => {

            const promises = [];
            for (let i = 0; i < 12; i++) {
                promises.push(
                    request(app)
                        .post("/api/auth/login")
                        .send({ email: "invalid@test.com", password: "wrong" })
                );
            }

            const responses = await Promise.all(promises);

            const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
            const normalResponses = responses.filter(r => r.statusCode !== 429);

            // Debugging output if failing
            if (rateLimitedResponses.length === 0) {
                console.log("Headers of first response:", responses[0].headers);
            }

            expect(rateLimitedResponses.length).toBeGreaterThan(0);
            // Expect at least the last few to be blocked
            expect(rateLimitedResponses[0].body).toHaveProperty("error");
        });

        it("should return Retry-After header when blocked", async () => {
            // Ensure we are blocked first (state persists in memory for the process duration usually)
            // We just hammered it in previous test, so we might still be blocked.
            // If Jest resets modules/app, we might need to hammer again. 
            // Let's hammer again just to be sure.

            let blockedResponse;
            for (let i = 0; i < 15; i++) {
                const res = await request(app).post("/api/auth/login").send({});
                if (res.statusCode === 429) {
                    blockedResponse = res;
                    break;
                }
            }

            expect(blockedResponse).toBeDefined();
            expect(blockedResponse.statusCode).toBe(429);
            expect(blockedResponse.headers).toHaveProperty("retry-after");
        });
    });
});
