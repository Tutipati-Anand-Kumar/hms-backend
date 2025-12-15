import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 50 }, // Ramp to 50 users
        { duration: '1m', target: 50 },  // Stay at 50
        { duration: '30s', target: 0 },  // Ramp down
    ],
};

const BASE_URL = 'http://localhost:3000/api'; // Adjust port if needed

export default function () {
    // 1. Visit Homepage / Check Health
    // let res = http.get(`${BASE_URL}/health`);

    // 2. Login (Simulate mostly reading or failed login if no real credentials)
    const payload = JSON.stringify({
        email: 'testuser@example.com',
        password: 'password123',
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    let res = http.post(`${BASE_URL}/auth/login`, payload, params);

    check(res, {
        'status is 200 or 401': (r) => r.status === 200 || r.status === 401, // 401 accepted if user doesnt exist
        'transaction time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
}
