import Report from "../models/Report.js";

// @desc    Upload file handler (after multer processes the file)
// @route   POST /api/reports/upload
// @access  Private
export const uploadFile = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }
    res.json({
        message: "File uploaded successfully",
        url: req.file.path,
        public_id: req.file.filename
    });
};

// @desc    Save report metadata to database
// @route   POST /api/reports/save
// @access  Private
export const saveReport = async (req, res) => {
    try {
        const { patientId, name, url, type, public_id, date, size, appointmentId } = req.body;

        const report = new Report({
            patient: patientId,
            name,
            url,
            type,
            public_id,
            date,
            size
        });

        await report.save();

        // Link report to Appointment if appointmentId is provided
        if (appointmentId) {
            const Appointment = (await import("../models/Appointment.js")).default;
            await Appointment.findByIdAndUpdate(appointmentId, {
                $push: { reports: url }
            });
        }

        res.status(201).json(report);
    } catch (err) {
        console.error("Error saving report:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// @desc    Get all reports for a specific patient
// @route   GET /api/reports/patient/:patientId
// @access  Private
export const getPatientReports = async (req, res) => {
    try {
        const reports = await Report.find({ patient: req.params.patientId }).sort({ date: -1 });
        res.json(reports);
    } catch (err) {
        console.error("Error fetching reports:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// @desc    Delete a report
// @route   DELETE /api/reports/:id
// @access  Private
export const deleteReport = async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        await report.deleteOne();
        res.json({ message: "Report deleted" });
    } catch (err) {
        console.error("Error deleting report:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// @desc    Proxy PDF from Cloudinary to bypass CORS/auth issues
// @route   GET /api/reports/proxy/:reportId
// @access  Private

export const proxyPDF = async (req, res) => {
    try {
        const { reportId } = req.params;

        // 1. Get report from database
        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        // 2. Verify user has permission to view this report
        // Allow if user is the patient, or if user is admin/doctor
        const isOwner = report.patient.toString() === req.user.id;
        const isAuthorized = isOwner || req.user.role === 'admin' || req.user.role === 'doctor';

        if (!isAuthorized) {
            return res.status(403).json({ message: "Access denied" });
        }

        // 3. Fetch PDF logic
        const axios = (await import('axios')).default;
        const cloudinary = (await import('../config/cloudinary.js')).default;

        console.log(`📄 Proxying PDF: ${report.name}`);

        let pdfResponse;

        try {
            // Attempt 1: Direct Fetch (Works for Public files)
            // We access the stored URL directly
            console.log(`🔹 Attempt 1: Fetching public URL: ${report.url}`);
            pdfResponse = await axios.get(report.url, {
                responseType: 'arraybuffer',
                headers: { 'Accept': 'application/pdf' },
                timeout: 30000
            });
            console.log("✅ Public fetch successful");

        } catch (filesError) {
            console.log(`⚠️ Public fetch failed (${filesError.response?.status}). Attempt 2: Generating Signed URL...`);

            try {
                // INTELLIGENT PARSING: Determine type and ID from the stored URL
                // URL format: https://res.cloudinary.com/cloud_name/resource_type/type/vVERSION/folder/filename
                const urlParts = report.url.split('/');

                // Find resource_type (raw/image/video)
                const resourceTypeIndex = urlParts.findIndex(p => ['raw', 'image', 'video'].includes(p));

                let resourceType = 'raw';
                let deliveryType = 'authenticated';
                let publicId = report.public_id; // Fallback

                if (resourceTypeIndex !== -1) {
                    resourceType = urlParts[resourceTypeIndex];

                    // delivery type is next
                    if (urlParts[resourceTypeIndex + 1]) {
                        const foundType = urlParts[resourceTypeIndex + 1];
                        if (['upload', 'authenticated', 'private'].includes(foundType)) {
                            deliveryType = foundType;
                        }
                    }

                    // Extract Public ID: Everything after the version (v12345)
                    // If version is present (v + digits), skip it.
                    // The rest of the path is the public_id.
                    const versionIndex = urlParts.findIndex(p => /^v\d+$/.test(p));
                    if (versionIndex !== -1 && versionIndex > resourceTypeIndex) {
                        // Public ID is everything after version
                        publicId = urlParts.slice(versionIndex + 1).join('/');
                    } else {
                        // Fallback: assume everything after delivery type?
                        // e.g. .../raw/upload/folder/file.pdf
                        // If no version, use parts after delivery type
                        if (urlParts.length > resourceTypeIndex + 2) {
                            publicId = urlParts.slice(resourceTypeIndex + 2).join('/');
                        }
                    }
                }

                // If publicId contains URL encoding or query params, clean it (unlikely from split but safe)
                publicId = decodeURIComponent(publicId.split('?')[0]);

                console.log(`🔍 Detected: ${resourceType}/${deliveryType}, ID: ${publicId}`);

                const signedUrl = cloudinary.url(publicId, {
                    resource_type: resourceType,
                    type: deliveryType,
                    sign_url: true,
                    secure: true,
                    expires_at: Math.floor(Date.now() / 1000) + 3600
                });

                console.log("🔐 Fetching Signed URL...");
                pdfResponse = await axios.get(signedUrl, {
                    responseType: 'arraybuffer',
                    headers: { 'Accept': 'application/pdf' },
                    timeout: 30000
                });
                console.log("✅ Signed fetch successful");

            } catch (signedError) {
                console.error("❌ Signed URL Fetch Failed:", signedError.response?.status || signedError.message);

                // NUCLEAR OPTION: Admin API Fallback
                try {
                    console.log("🕵️‍♂️ Fallback: detailed lookup via Cloudinary Admin API...");
                    let resourceDetails = null;
                    const idVariants = [report.public_id, report.public_id.replace(/\.pdf$/i, '')];

                    for (const id of idVariants) {
                        if (resourceDetails) break;
                        for (const rt of ['raw', 'image']) {
                            try {
                                console.log(`Checking API for: ${id} (${rt})...`);
                                resourceDetails = await cloudinary.api.resource(id, { resource_type: rt });
                                if (resourceDetails) {
                                    console.log("✅ Resource Found via Admin API!");
                                    break;
                                }
                            } catch (e) { /* Check next */ }
                        }
                    }

                    if (resourceDetails) {
                        console.log(`✅ Using verified details to sign... Details:`, JSON.stringify(resourceDetails, null, 2));

                        // Try with returned type first
                        try {
                            // Fix for RAW files: Do not pass format if it's already in public_id
                            // Cloudinary Admin API returns public_id with extension for RAW files.
                            const options = {
                                resource_type: resourceDetails.resource_type,
                                type: resourceDetails.type,
                                // version: resourceDetails.version, // <-- REMOVED version to avoid signature mismatch
                                sign_url: true,
                                secure: true,
                                expires_at: Math.floor(Date.now() / 1000) + 3600
                            };

                            // Only add format if it's NOT raw (e.g. images)
                            if (resourceDetails.resource_type !== 'raw') {
                                options.format = resourceDetails.format;
                            }

                            const verifiedUrl = cloudinary.url(resourceDetails.public_id, options);

                            console.log("🔐 Fetching Verified URL (No Version):", verifiedUrl);
                            pdfResponse = await axios.get(verifiedUrl, {
                                responseType: 'arraybuffer',
                                headers: { 'Accept': 'application/pdf' },
                                timeout: 30000
                            });
                            console.log("✅ Verified fetch successful");
                        } catch (verifiedError) {
                            console.error(`❌ Verified fetch failed (${verifiedError.response?.status}). Attempting retry with 'authenticated' type...`);

                            try {
                                // Retry Strategy: Try 'authenticated' type (also without version)
                                const authOptions = {
                                    resource_type: resourceDetails.resource_type,
                                    type: 'authenticated', // Force authenticated
                                    // version: resourceDetails.version, // <-- REMOVED
                                    sign_url: true,
                                    secure: true,
                                    expires_at: Math.floor(Date.now() / 1000) + 3600
                                };

                                // Only add format if it's NOT raw
                                if (resourceDetails.resource_type !== 'raw') {
                                    authOptions.format = resourceDetails.format;
                                }

                                const authUrl = cloudinary.url(resourceDetails.public_id, authOptions);
                                console.log("🔐 Fetching Auth URL (No Version):", authUrl);

                                pdfResponse = await axios.get(authUrl, {
                                    responseType: 'arraybuffer',
                                    headers: { 'Accept': 'application/pdf' },
                                    timeout: 30000
                                });
                                console.log("✅ Authenticated fetch successful");
                            } catch (retryError) {
                                console.error(`❌ Auth Retry failed (${retryError.response?.status})`);
                                throw retryError; // Propagate to trigger Admin API failure log
                            }
                        }

                    } else {
                        throw new Error("Resource not found in Cloudinary (Admin API confirmed)");
                    }
                } catch (adminError) {
                    console.error("❌ Admin API failed:", adminError.message);

                    // FINAL RESORT: Redirect the user to the URL directly
                    // This satisfies "ignore 401 status directly show preview" request
                    // If the browser can open it (cached creds?), good. If not, it fails there.
                    console.log("⚠️ Fallback to Direct Redirect");
                    return res.redirect(report.url);
                }
            }
        }

        // 4. Set headers and stream
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${report.name}"`,
            'Content-Length': pdfResponse.data.length,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff'
        });

        res.send(Buffer.from(pdfResponse.data));
        console.log(`✅ PDF proxied successfully via backend`);

    } catch (error) {
        console.error("❌ PDF Proxy Error:", error.message);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
        }
        res.status(500).json({ message: "Failed to access PDF" });
    }
};
