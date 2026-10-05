// image processing: resize + WebP, EXIF auto-rotate, metadata stripped
const sharp = require("sharp");

async function processProfilePhoto(buffer) {
  return sharp(buffer, { limitInputPixels: 25_000_000 }) // blocks decompression bombs (default limit is much higher)
    .rotate() // applies EXIF orientation before metadata is dropped
    .resize(512, 512, { fit: "inside", withoutEnlargement: true }) // keeps aspect ratio, never upscales
    .webp({ quality: 80 })
    .toBuffer(); // output has no EXIF/GPS unless you call .withMetadata()
}

module.exports = { processProfilePhoto };