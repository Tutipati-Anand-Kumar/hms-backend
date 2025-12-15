# Load Testing & Rate Limiting Strategy

This guide explains the load testing and rate limiting strategy implemented for the HMS Backend.

## 1. Rate Limiting

We use `express-rate-limit` to protect the API from abuse and DDoS attacks.

### Configuration
- **Global Limit**: 100 requests per 15 minutes.
  - Applies to most endpoints (`/api/doctors`, `/api/bookings`, etc.)
- **Auth Limit**: 10 requests per 1 minute.
  - Applies to `/api/auth` (Login, Register, OTP).
  - Stricter to prevent brute-force attacks.

### Testing Rate Limits
Run the dedicated test suite:
```bash
npm test tests/rateLimit.test.js
```
*Note: Ensure your testing environment is not blocked by previous runs.*

## 2. Load Testing

We use **Artillery** for flow-based load testing and **k6** for high-concurrency stress testing.

### Prerequisites
- **Artillery**: Installed via `npm install` (devDependency).
- **k6**: Must be installed separately. [Download k6](https://k6.io/docs/get-started/installation/)

### A. Artillery (Flow Testing)
Use Artillery to simulate real user journeys (e.g., Login -> Book Appointment).

**Run Auth Load Test:**
```bash
npx artillery run tests/load/artillery/auth-load-test.yaml
```

**Run Booking Load Test:**
```bash
npx artillery run tests/load/artillery/booking-load-test.yaml
```

### B. k6 (Stress & Spike Testing)
Use k6 to test raw performance and breaking points.

**Run Stress Test (50 concurrent users):**
```bash
k6 run tests/load/k6/stress-test.js
```

**Run Spike Test (Surge to 100 users):**
```bash
k6 run tests/load/k6/spike-test.js
```

## 3. Performance Thresholds
The tests are configured with the following pass/fail criteria:
- **Response Time (p95)**: < 500ms
- **Error Rate**: < 1%
- **Throughput**: Should handle at least 50 req/sec without degradation.

## 4. Interpretation
- **429 Errors**: Expected when testing rate limits.
- **500 Errors**: Indieates backend failure under load (monitor server logs).
- **High Latency**: Indicates database bottlenecks or unoptimized code.
