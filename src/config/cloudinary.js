"use strict";

require("dotenv").config();

const { v2: cloudinary } = require("cloudinary");

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

if (configurado) {
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
    });

    console.log("☁️ Cloudinary configurado.");
} else {
    console.warn(
        "⚠️ Cloudinary não configurado. Verifique CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET."
    );
}

cloudinary.configurado = configurado;

module.exports = cloudinary;