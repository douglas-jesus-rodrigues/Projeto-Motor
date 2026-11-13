"use strict";

const { v2: cloudinary } = require("cloudinary");
require("dotenv").config();

const cloudName = String(
    process.env.CLOUDINARY_CLOUD_NAME || ""
).trim();

const apiKey = String(
    process.env.CLOUDINARY_API_KEY || ""
).trim();

const apiSecret = String(
    process.env.CLOUDINARY_API_SECRET || ""
).trim();

const configurado = Boolean(
    cloudName &&
    apiKey &&
    apiSecret
);

if (!configurado) {
    console.warn(
        "⚠️ Cloudinary não está completamente configurado."
    );
}

cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
});

cloudinary.configurado = configurado;

module.exports = cloudinary;