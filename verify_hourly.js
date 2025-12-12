
import { generateSlots } from "./utils/slotUtils.js";

// Mock Data
const doctor = {
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

// Mock checkAvailability Logic
function checkAvailability(dateStr) {
    console.log(`\nChecking availability for ${dateStr}...`);
    const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
    const availability = doctor.hospitals[0].availability.find(a => a.days.includes(dayName));

    if (!availability) {
        console.log("No availability.");
        return;
    }

    const allSlots = generateSlots(
        availability.startTime,
        availability.endTime,
        availability.breakStart,
        availability.breakEnd
    );

    // Hourly Aggregation Logic
    const hourlyBlocks = [];
    const slotsByHour = {};

    allSlots.forEach(slot => {
        const [time, modifier] = slot.startTime.split(" ");
        let [h, m] = time.split(":").map(Number);
        let hour24 = h;
        if (modifier === "PM" && h < 12) hour24 += 12;
        if (modifier === "AM" && h === 12) hour24 = 0;

        const hourKey = `${hour24}`;
        if (!slotsByHour[hourKey]) {
            slotsByHour[hourKey] = {
                hour24,
                displayStart: `${h}:00 ${modifier}`,
                displayEnd: `${h === 12 ? 1 : (h + 1 > 12 ? h + 1 - 12 : h + 1)}:00 ${modifier === "AM" && h === 11 ? "PM" : (modifier === "PM" && h === 11 ? "AM" : modifier)}`,
                slots: []
            };
        }
        slotsByHour[hourKey].slots.push(slot);
    });

    Object.values(slotsByHour).sort((a, b) => a.hour24 - b.hour24).forEach(block => {
        const totalCapacity = block.slots.length;
        const bookedCount = 0; // Mock: 0 bookings
        const isFull = bookedCount >= totalCapacity;

        hourlyBlocks.push({
            timeSlot: `${block.displayStart} - ${block.displayEnd}`,
            totalCapacity,
            bookedCount,
            isFull,
            availableCount: totalCapacity - bookedCount
        });
    });

    console.log("Hourly Blocks:", JSON.stringify(hourlyBlocks, null, 2));
}

// Mock bookAppointment Logic
function bookAppointment(timeSlot) {
    console.log(`\nBooking ${timeSlot}...`);
    if (!timeSlot.includes(" - ")) {
        console.log("Invalid format");
        return;
    }

    let [reqStart, reqEnd] = timeSlot.split(" - ");

    // Generate slots again (simplified)
    const availability = doctor.hospitals[0].availability[0];
    const validSlots = generateSlots(
        availability.startTime,
        availability.endTime,
        availability.breakStart,
        availability.breakEnd
    );

    // Check exact match
    const exactMatch = validSlots.find(s => s.startTime === reqStart && s.endTime === reqEnd);
    if (exactMatch) {
        console.log(`Exact match found: ${exactMatch.startTime} - ${exactMatch.endTime}`);
        return;
    }

    // Hourly Block Logic
    console.log("Checking hourly block...");
    const [t, m] = reqStart.split(" ");
    let [rh, rm] = t.split(":").map(Number);
    if (m === "PM" && rh < 12) rh += 12;
    if (m === "AM" && rh === 12) rh = 0;

    const slotsInHour = validSlots.filter(s => {
        const [st, sm] = s.startTime.split(" ");
        let [sh, smm] = st.split(":").map(Number);
        if (sm === "PM" && sh < 12) sh += 12;
        if (sm === "AM" && sh === 12) sh = 0;
        return sh === rh;
    });

    if (slotsInHour.length > 0) {
        console.log(`Found ${slotsInHour.length} slots in this hour.`);
        console.log(`Assigning first available: ${slotsInHour[0].startTime} - ${slotsInHour[0].endTime}`);
    } else {
        console.log("No slots found in this hour.");
    }
}

// Run Tests
checkAvailability("2023-10-25"); // Wednesday
bookAppointment("9:00 AM - 10:00 AM");
bookAppointment("12:00 PM - 1:00 PM"); // Break time check
