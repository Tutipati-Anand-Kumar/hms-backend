import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '2m', target: 50 }, // Ramp up to 50 users
        { duration: '5m', target: 50 }, // Stay at 50 users
        { duration: '2m', target: 0 },  // Scale down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
        http_req_failed: ['rate<0.01'],    // Error rate must be < 1%
    },
};

const BASE_URL = 'http://localhost:3000/api';

export default function () {
    // 1. Visit Homepage/Health check
    let res = http.get(`${BASE_URL}/health`);
    check(res, { 'status was 200': (r) => r.status == 200 });

    // 2. Login (Simulated heavily)
    const loginPayload = JSON.stringify({
        email: 'testdoctor@example.com', // Use a seeded user
        password: 'password123',
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    res = http.post(`${BASE_URL}/auth/login`, loginPayload, params);

    // Check if login succeeded to extract token
    if (check(res, { 'login status was 200': (r) => r.status == 200 })) {
        const token = res.json('token'); // Adjust JSON path if needed
        const authParams = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        };

        // 3. Authenticated Request: Get Doctor Profile
        let profileRes = http.get(`${BASE_URL}/doctors/profile`, authParams);
        check(profileRes, { 'profile status was 200': (r) => r.status == 200 });
    }

    sleep(1);
}
