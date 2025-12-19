#!/usr/bin/env node

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [16, 32, 48, 128];
const inputSvg = path.join(__dirname, '..', 'src', 'assets', 'icons', 'ato-logo.svg');
const outputDir = path.join(__dirname, '..', 'src', 'assets', 'icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcon(size) {
  const outputPath = path.join(outputDir, `icon${size}.png`);

  await sharp(inputSvg)
    .resize(size, size)
    .png()
    .toFile(outputPath);

  console.log(`✅ Generated icon${size}.png`);
}

async function generateAllIcons() {
  console.log('🎨 Generating ATO icons from ato-logo.svg...\n');

  // Check if source SVG exists
  if (!fs.existsSync(inputSvg)) {
    console.error(`❌ Source SVG not found: ${inputSvg}`);
    process.exit(1);
  }

  try {
    for (const size of sizes) {
      await generateIcon(size);
    }
    console.log('\n✨ All icons generated successfully!');
    console.log(`📁 Icons saved to: ${outputDir}`);
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateAllIcons();
