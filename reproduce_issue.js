
import { generateSlots } from "./utils/slotUtils.js";

// Mock Data from doctorEdit.js (The "Bad" Format)
const badDoctorProfile = {
    hospitals: [
        {
            hospital: "HOSP001",
            availability: [{ day: "Wednesday", slots: ["9AM-1PM"] }] // Note: 'day' singular, 'slots' array
        }
    ]
};

// Mock Data from DoctorProfile.js Schema (The "Good" Format)
const goodDoctorProfile = {
    hospitals: [
        {
            hospital: "HOSP001",
            availability: [
                {
                    days: ["Wednesday"],
                    startTime: "09:00 AM",
                    endTime: "01:00 PM",
                    breakStart: "12:00 PM",
                    breakEnd: "12:30 PM"
                }
            ]
        }
    ]
};

// Logic from bookingController.js
function checkAvailability(doctor, dateStr) {
    console.log(`Checking availability for ${dateStr}...`);
    const targetHospitalId = "HOSP001";
    const hospitalRecord = doctor.hospitals.find(h => h.hospital === targetHospitalId);

    if (!hospitalRecord) {
        console.log("Hospital not found");
        return;
    }

    const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
    console.log(`Day: ${dayName}`);

    try {
        // This is the line from bookingController.js
        // I added 'a.days &&' to prevent crash in my script, but the real code might not have it.
        // Real code: const availability = hospitalRecord.availability.find(a => a.days.includes(dayName));

        // Simulating the real code's potential crash or failure
        let availability;
        try {
            availability = hospitalRecord.availability.find(a => a.days.includes(dayName));
        } catch (e) {
            console.log("Real code would CRASH here: " + e.message);

            // Let's try to find it safely to see if it exists in bad format
            const badAvailability = hospitalRecord.availability.find(a => a.day === dayName);
            if (badAvailability) {
                console.log("BUT found availability in 'Bad' format (doctorEdit.js style):", badAvailability);
            }
            return;
        }

        if (!availability) {
            console.log(`Doctor is not available on ${dayName}`);
            const badAvailability = hospitalRecord.availability.find(a => a.day === dayName);
            if (badAvailability) {
                console.log("BUT found availability in 'Bad' format (doctorEdit.js style):", badAvailability);
            }
            return;
        }

        console.log("Found availability (Good Format):", availability);

        const slots = generateSlots(
            availability.startTime,
            availability.endTime,
            availability.breakStart,
            availability.breakEnd
        );
        console.log(`Generated ${slots.length} slots.`);
        console.log("First 3 slots:", slots.slice(0, 3));

    } catch (err) {
        console.error("CRASHED:", err.message);
    }
}

console.log("--- TEST 1: Bad Format (from doctorEdit.js) ---");
checkAvailability(badDoctorProfile, "2023-10-25"); // A Wednesday

console.log("\n--- TEST 2: Good Format (from Schema) ---");
checkAvailability(goodDoctorProfile, "2023-10-25"); // A Wednesday
