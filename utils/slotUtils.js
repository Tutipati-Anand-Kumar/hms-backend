export const generateSlots = (startTime, endTime, breakStart, breakEnd, duration = 5) => {
    const parseTime = (timeStr) => {
        if (!timeStr) return null;
        const [time, modifier] = timeStr.split(" ");
        let [hours, minutes] = time.split(":").map(Number);
        if (modifier === "PM" && hours < 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;
        return new Date(1970, 0, 1, hours, minutes, 0);
    };

    const slots = [];
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const bStart = parseTime(breakStart);
    const bEnd = parseTime(breakEnd);

    let current = new Date(start);

    while (current < end) {
        // Check if current time is within break
        if (bStart && bEnd && current >= bStart && current < bEnd) {
            current = new Date(bEnd); // Skip to end of break
            continue;
        }

        const slotEnd = new Date(current.getTime() + duration * 60000);
        if (slotEnd > end) break;

        // Check if slot overlaps with break
        if (bStart && bEnd && slotEnd > bStart && current < bEnd) {
            current = new Date(bEnd); // Skip to end of break
            continue;
        }

        const formatTime = (d) => {
            let h = d.getHours();
            const m = d.getMinutes().toString().padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            h = h ? h : 12;
            return `${h}:${m} ${ampm}`;
        };

        // Format: "10:00 AM"
        // We need separate start and end times for the model, but for generation we can return objects
        slots.push({
            startTime: formatTime(current),
            endTime: formatTime(slotEnd),
            rawStart: new Date(current), // For sorting/filtering
            rawEnd: new Date(slotEnd)
        });

        current = slotEnd;
    }

    return slots;
};

export const isHourBlockFull = (appointments, date, hour) => {
    // Filter appointments for the specific date and hour
    const count = appointments.filter(app => {
        const appDate = new Date(app.date);
        const appTime = app.startTime; // "10:00 AM"

        // Parse appTime to get hour
        const [time, modifier] = appTime.split(" ");
        let [h, m] = time.split(":").map(Number);
        if (modifier === "PM" && h < 12) h += 12;
        if (modifier === "AM" && h === 12) h = 0;

        return appDate.toDateString() === new Date(date).toDateString() && h === hour;
    }).length;

    return count >= 12;
};
