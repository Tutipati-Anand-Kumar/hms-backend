import multer from "multer";
import pkg from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const { CloudinaryStorage } = pkg;

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let resourceType = "image";

    if (file.mimetype.includes("pdf") || file.mimetype.includes("application")) {
      resourceType = "raw";
    } else if (file.mimetype.includes("video")) {
      resourceType = "video";
    } else if (file.mimetype.includes("audio")) {
      resourceType = "video";
    }

    return {
      folder: "hospital_management_reports",
      resource_type: resourceType,
      type: 'upload', // Make files public
      public_id: file.originalname.split(".")[0] + "-" + Date.now(),
    };
  },
});

const upload = multer({ storage });
export default upload;
