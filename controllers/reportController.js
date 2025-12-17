import Report from "../models/Report.js";

export const uploadFile = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    try {
        const cloudinary = (await import("../config/cloudinary.js")).default;

        // Use a stream upload since file is in memory (req.file.buffer)
        const uploadStream = (buffer) => {
            return new Promise((resolve, reject) => {
                // User requested removing extension for upload
                const originalName = req.file.originalname.replace(/\.[^/.]+$/, "");
                const stream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: "auto",
                        folder: "hms_reports",
                        public_id: originalName, // Force public_id without extension
                        use_filename: true,
                        unique_filename: false
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                stream.end(buffer);
            });
        };

        const result = await uploadStream(req.file.buffer);

        res.json({
            message: "File uploaded successfully",
            url: result.secure_url,
            public_id: result.public_id
        });
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        res.status(500).json({ message: "Upload failed" });
    }
};

export const saveReport = async (req, res) => {
    try {
        const { patientId, name, url, type, public_id, date, size, appointmentId, hospitalId } = req.body;

        if (!url) {
            console.error("Save Report Error: Missing URL in request body", req.body);
            return res.status(400).json({ message: "Report URL is required" });
        }

        if (!patientId || !name || !type || !date) {
            return res.status(400).json({ message: "Missing required fields: patientId, name, type, or date" });
        }

        const report = new Report({
            patient: patientId,
            name,
            url,
            type,
            public_id,
            date,
            size,
            appointment: appointmentId,
            hospital: hospitalId
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
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: "Server error" });
    }
};

export const getPatientReports = async (req, res) => {
    try {
        const reports = await Report.find({ patient: req.params.patientId }).sort({ date: -1 }).lean();
        const cloudinary = (await import("../config/cloudinary.js")).default;

        // Sign all report URLs for direct access
        const signedReports = reports.map(report => {
            try {
                // Match resource type from URL (raw/image/video)
                const resourceTypeMatch = report.url.match(/\/(raw|image|video)\//);
                let resourceType = resourceTypeMatch ? resourceTypeMatch[1] : 'raw';

                // Fallback: If not found in URL, infer from mime type (cautiously)
                if (!resourceTypeMatch && (report.type.startsWith('image/') || report.type === 'application/pdf')) {
                    resourceType = 'image';
                }

                // Parse details from stored URL (e.g., version, delivery type)
                const urlParts = report.url.split('/');
                const versionMatch = report.url.match(/v(\d+)/);
                const version = versionMatch ? versionMatch[1] : undefined;

                // Detect delivery type (upload/private/authenticated)
                let deliveryType = 'upload'; // default
                if (report.url.includes('/private/')) deliveryType = 'private';
                if (report.url.includes('/authenticated/')) deliveryType = 'authenticated';

                if (report.public_id) {
                    // Start with stored public_id
                    // ENCODE components to handle spaces (Cloudinary expects encoded ID in signature for URLs with %20)
                    let publicIdToSign = report.public_id.split('/').map(p => encodeURIComponent(p)).join('/');

                    const options = {
                        resource_type: resourceType,
                        type: deliveryType,
                        version: version, // Include version for correct signature
                        sign_url: true,
                        secure: true,
                        expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour
                    };

                    // For PDFs stored as 'image', we must ensure the URL has .pdf extension.
                    // If public_id doesn't have it, we add format: 'pdf'.
                    if (resourceType === 'image' && report.type === 'application/pdf' && !publicIdToSign.endsWith('.pdf')) {
                        options.format = 'pdf';
                    }

                    const signedUrl = cloudinary.url(publicIdToSign, options);

                    // DEBUG: Log details for specific files to trace mismatches
                    if (report.name.includes("DESIGNER") || report.name.includes("Text")) {
                        console.log(`🔍 Signing Debug [${report.name}]:`);
                        console.log(`   - Stored URL: ${report.url}`);
                        console.log(`   - Public ID (DB): ${report.public_id}`);
                        console.log(`   - ID to Sign: ${publicIdToSign}`);
                        console.log(`   - Resource: ${resourceType}, Type: ${deliveryType}, Version: ${version}`);
                        console.log(`   - Options:`, JSON.stringify(options));
                        console.log(`   - Generated: ${signedUrl}`);
                    }

                    return { ...report, signedUrl };
                }
                return report;
            } catch (e) {
                console.error("Error signing report URL:", e);
                return report;
            }
        });

        res.json(signedReports);
    } catch (err) {
        console.error("Error fetching reports:", err);
        res.status(500).json({ message: "Server error" });
    }
};

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

export const proxyPDF = async (req, res) => {
    try {
        const { reportId } = req.params;

        // 1. Get report from database
        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

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
        let fallbackSignedUrl = null;

        try {

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
                    const versionIndex = urlParts.findIndex(p => /^v\d+$/.test(p));
                    if (versionIndex !== -1 && versionIndex > resourceTypeIndex) {
                        // Public ID is everything after version
                        publicId = urlParts.slice(versionIndex + 1).join('/');
                    } else {

                        if (urlParts.length > resourceTypeIndex + 2) {
                            publicId = urlParts.slice(resourceTypeIndex + 2).join('/');
                        }
                    }
                }

                // If publicId contains URL encoding or query params, clean it (unlikely from split but safe)
                publicId = decodeURIComponent(publicId.split('?')[0]);

                console.log(`🔍 Detected: ${resourceType}/${deliveryType}, ID: ${publicId}`);

                // Try signing with inferred details
                const signedUrl = cloudinary.url(publicId, {
                    resource_type: resourceType,
                    type: deliveryType,
                    sign_url: true,
                    secure: true,
                    expires_at: Math.floor(Date.now() / 1000) + 3600
                });

                fallbackSignedUrl = signedUrl;

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

                        // Generate Verified URL
                        const options = {
                            resource_type: resourceDetails.resource_type,
                            type: resourceDetails.type,
                            version: resourceDetails.version, // <-- RESTORED: Version is crucial for signature matching
                            sign_url: true,
                            secure: true,
                            expires_at: Math.floor(Date.now() / 1000) + 3600
                        };

                        if (resourceDetails.resource_type !== 'raw') {
                            options.format = resourceDetails.format;
                        }

                        const verifiedUrl = cloudinary.url(resourceDetails.public_id, options);
                        fallbackSignedUrl = verifiedUrl; // Update fallback

                        console.log("🔐 Fetching Verified URL:", verifiedUrl);
                        pdfResponse = await axios.get(verifiedUrl, {
                            responseType: 'arraybuffer',
                            headers: { 'Accept': 'application/pdf' },
                            timeout: 30000
                        });
                        console.log("✅ Verified fetch successful");
                    } else {
                        throw new Error("Resource not found in Cloudinary (Admin API confirmed)");
                    }
                } catch (adminError) {
                    console.error("❌ Admin API failed:", adminError.message);

                    // FINAL RESORT: Redirect the user to the SIGNED URL directly
                    if (fallbackSignedUrl) {
                        console.log("⚠️ Fallback to Redirect (Signed URL)");
                        return res.redirect(fallbackSignedUrl);
                    }

                    console.log("⚠️ Fallback to Direct Redirect (Unsigned)");
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
        // If we have a fallback URL and haven't sent headers, redirect.
        if (!res.headersSent) {
            const fallback = report.signedUrl || report.url; // Use signedUrl from DB or raw
            console.log("⚠️ Detailed Error Fallback: Redirecting to", fallback);
            return res.redirect(fallback);
        }
    }
};
