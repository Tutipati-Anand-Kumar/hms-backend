import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '10s', target: 10 }, // Below normal load
        { duration: '1m', target: 100 }, // SPIKE to 100 users
        { duration: '10s', target: 10 }, // Scale down recovery (optional)
    ],
    thresholds: {
        http_req_failed: ['rate<0.05'], // Allow slightly higher error rate during spike
    },
};

const BASE_URL = 'http://localhost:3000/api';

export default function () {
    let res = http.get(`${BASE_URL}/health`);
    check(res, { 'status was 200': (r) => r.status == 200 });
    sleep(1);
}
