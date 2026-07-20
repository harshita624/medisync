'use strict';
const Groq   = require('groq-sdk');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL        = process.env.GROQ_MODEL        || 'llama-3.1-8b-instant';
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

console.log(`✅ Groq AI ready — Text: ${MODEL} | Vision: ${VISION_MODEL}`);

// ─────────────────────────────────────────────────────────────────────────────
// Validate Cloudinary config at startup so misconfiguration fails fast with a
// clear message, instead of surfacing as a cryptic "Invalid cloud_name X"
// error deep inside a vision request.
//
// COMMON MISTAKE: pasting an API Key's *name/label* (e.g. "medisync") from
// the Cloudinary dashboard "API Keys" table into CLOUDINARY_CLOUD_NAME.
// The cloud name is shown separately at the TOP of that page
// (e.g. "Cloud name: dvwxd5ppp") and is what CLOUDINARY_CLOUD_NAME must be.
// ─────────────────────────────────────────────────────────────────────────────
let cloudinaryConfigured = false;
let cloudinaryConfigError = null;

function checkCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    cloudinaryConfigError =
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, ' +
      'and CLOUDINARY_API_SECRET in backend/.env. Find these on your Cloudinary ' +
      'dashboard under Settings > API Keys — the "Cloud name" shown at the TOP ' +
      'of that page (not the Key Name in the table) is CLOUDINARY_CLOUD_NAME.';
    return;
  }

  // Cloud names are lowercase alphanumeric + hyphens, typically look like
  // random strings (e.g. "dvwxd5ppp"). If it looks like a human-chosen label
  // (e.g. "medisync", "MEDICO", "AI-SAHAYAK" — matching a Key Name pattern),
  // warn early since this is the #1 cause of "Invalid cloud_name" errors.
  if (/^[a-z0-9]{6,15}$/i.test(cloudName) === false) {
    console.warn(
      `⚠️  CLOUDINARY_CLOUD_NAME="${cloudName}" looks unusual. ` +
      `Double-check this matches the "Cloud name" shown at the top of your ` +
      `Cloudinary dashboard (Settings > API Keys), NOT an API key's Key Name label.`
    );
  }

  try {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    cloudinaryConfigured = true;
  } catch (e) {
    cloudinaryConfigError = `Failed to configure Cloudinary: ${e.message}`;
  }
}

checkCloudinaryConfig();

/**
 * Strip filename-like tokens (e.g. "131449326.avif", "report.pdf") from a
 * prompt before sending it to the vision model.
 *
 * ROOT CAUSE: when the prompt mentions the original uploaded filename,
 * llama-4-scout sometimes anchors on that text and responds as if it's
 * reasoning about a file it "can't open" rather than describing the image
 * bytes it actually received — producing hedged, speculative answers like
 * "I'm not capable of directly analyzing... 131449326.avif".
 */
function stripFilenameMentions(text = '') {
  return text
    .replace(/[\w\-]+\.(avif|jpe?g|png|webp|gif|pdf|heic|bmp|tiff?)\b/gi, '')
    .replace(/[("'`]{1,2}\s*[)"'`]{1,2}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const HEDGE_PATTERNS = [
  /i'?m not capable of (directly )?(analyz|view|access)/i,
  /i (cannot|can't|am unable to) (directly )?(view|see|access|analyz)/i,
  /without (direct access|seeing) (to )?the image/i,
  /this analysis is speculative/i,
];

function looksHedged(text = '') {
  return HEDGE_PATTERNS.some(re => re.test(text));
}

const VISION_SYSTEM_PROMPT =
  'You are an AI with direct visual access to the image provided in this message via image_url. ' +
  'You can see its actual pixel content right now. Never claim you cannot view, open, or access ' +
  'the image, and never reason about a filename — describe only what is visibly present in the ' +
  'image itself. If it is a medical document (prescription, lab report, scan, X-ray), extract all ' +
  'visible text, values, names, and instructions verbatim. If it is a photo, describe the scene factually.';

/**
 * Force a Cloudinary delivery URL to JPEG, regardless of account-level
 * automatic format optimization (e.g. "Optimization > Automatic format
 * and quality selection" delivering AVIF/WebP by default).
 *
 * ROOT CAUSE: Cloudinary accounts with auto-format optimization enabled
 * return secure_url values ending in .avif (or .webp) even when the
 * source file was a .jpg/.png. Groq's llama-4-scout vision model only
 * accepts jpeg/png/webp/gif and rejects avif with "invalid image data".
 *
 * FIX: insert an f_jpg transformation right after "/upload/" and rewrite
 * the trailing file extension to .jpg, so the delivered bytes are always
 * a real JPEG that Groq can decode.
 */
function forceJpegDeliveryUrl(url) {
  let out = url.replace('/upload/', '/upload/f_jpg/');
  out = out.replace(/\.[a-zA-Z0-9]+(\?.*)?$/, '.jpg');
  return out;
}

/**
 * Upload buffer to Cloudinary and return a public URL.
 * Groq llama-4-scout ONLY accepts real HTTPS URLs — not base64 data URLs.
 */
async function uploadToCloudinaryTemp(buffer, mimeType) {
  if (!cloudinaryConfigured) {
    throw new Error(cloudinaryConfigError || 'Cloudinary is not configured.');
  }

  const ext     = mimeType.includes('png') ? '.png' : '.jpg';
  const tmpPath = path.join(os.tmpdir(), `hb-vision-${crypto.randomBytes(8).toString('hex')}${ext}`);
  fs.writeFileSync(tmpPath, buffer);

  try {
    const cloudinary = require('cloudinary').v2;

    const result = await cloudinary.uploader.upload(tmpPath, {
      folder:        'healthbridge-vision-temp',
      resource_type: 'image',
      invalidate:    true,
      // Explicitly request a JPEG-derived asset to reduce the chance of
      // AVIF/WebP being returned, on top of the URL-level f_jpg override below.
      format:        'jpg',
    });

    return forceJpegDeliveryUrl(result.secure_url);
  } catch (err) {
    const detail = err.message || String(err);
    if (/invalid cloud_name/i.test(detail)) {
      throw new Error(
        `${detail}. Your CLOUDINARY_CLOUD_NAME in backend/.env is set to ` +
        `"${process.env.CLOUDINARY_CLOUD_NAME}", but that is not a valid Cloudinary ` +
        `cloud name. On your Cloudinary dashboard (Settings > API Keys), use the ` +
        `"Cloud name" value shown at the TOP of the page — not any value from the ` +
        `Key Name column in the table below it.`
      );
    }
    if (/invalid api_key|invalid signature|api_secret/i.test(detail)) {
      throw new Error(
        `${detail}. Check that CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in ` +
        `backend/.env exactly match the key/secret pair shown on your Cloudinary ` +
        `dashboard (Settings > API Keys) for the SAME row — mixing key/secret from ` +
        `different rows will fail.`
      );
    }
    throw err;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

/**
 * Text chat — main model
 */
async function chat(messages) {
  const systemMsgs = messages.filter(m => m.role === 'system');
  const convMsgs   = messages.filter(m => m.role !== 'system').slice(-10);
  const payload    = [...systemMsgs, ...convMsgs];

  const response = await groq.chat.completions.create({
    model:       MODEL,
    messages:    payload,
    temperature: 0.2,
    max_tokens:  1000,
    top_p:       0.9,
  });

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content || content.length < 3) throw new Error('Empty response from Groq');
  return content;
}

/**
 * Vision chat — uploads image to Cloudinary, passes HTTPS URL to Groq.
 *
 * ROOT CAUSE OF "invalid image data":
 *   meta-llama/llama-4-scout-17b-16e-instruct on Groq does NOT support
 *   base64 data URLs (data:image/jpeg;base64,...).
 *   It ONLY accepts real HTTPS URLs pointing to publicly accessible images.
 *   This is different from OpenAI/Anthropic which accept base64.
 *
 * SOLUTION:
 *   Upload the buffer to Cloudinary → get HTTPS URL → pass to Groq.
 */
async function visionChat(imageBuffer, mimeType, userPrompt) {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error('Image buffer is empty');
  }

  const rawPrompt = userPrompt ||
    'Please analyse this image in detail. If it is a medical report, lab result, prescription, X-ray, or scan, extract and explain all relevant information.';

  // Remove any filename mentions (e.g. "131449326.avif") so the model
  // doesn't anchor on filename text instead of the actual image content.
  const prompt = stripFilenameMentions(rawPrompt) ||
    'Describe everything visible in this image in detail.';

  const supportedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const useMime = supportedMimes.includes((mimeType || '').toLowerCase())
    ? mimeType.toLowerCase().replace('image/jpg', 'image/jpeg')
    : 'image/jpeg';

  let imageUrl;
  try {
    imageUrl = await uploadToCloudinaryTemp(imageBuffer, useMime);
    console.log(`Vision: uploaded to Cloudinary → ${imageUrl}`);
  } catch (uploadErr) {
    console.error('Cloudinary upload failed:', uploadErr.message);
    throw new Error(`Could not prepare image for analysis: ${uploadErr.message}`);
  }

  async function callVision(promptText, extraEmphasis) {
    const messages = [
      { role: 'system', content: VISION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: extraEmphasis ? `${extraEmphasis}\n\n${promptText}` : promptText },
        ],
      },
    ];

    const response = await groq.chat.completions.create({
      model:       VISION_MODEL,
      messages,
      temperature: 0.2,
      max_tokens:  1200,
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content || content.length < 3) throw new Error('Empty vision response from Groq');
    return content;
  }

  try {
    console.log(`Vision request: model=${VISION_MODEL} url=${imageUrl}`);

    let content = await callVision(prompt);

    // If the model still hedges ("I'm not capable of viewing images..."),
    // retry once with a more forceful reminder that the image is attached.
    if (looksHedged(content)) {
      console.warn('Vision response looked hedged, retrying with stronger instruction...');
      content = await callVision(
        prompt,
        'The image is attached to this message and you can see it. Respond only with a direct ' +
        'description of its visible content — do not say you cannot view it.'
      );
    }

    return content;

  } catch (err) {
    const detail = err.error || err.response?.data || err.message;
    console.error('Groq vision API error:', JSON.stringify(detail, null, 2));
    const msg = typeof detail === 'object'
      ? (detail.error?.message || detail.message || JSON.stringify(detail))
      : String(detail);
    throw new Error(msg);
  }
}

async function isOllamaRunning() {
  return !!process.env.GROQ_API_KEY;
}

module.exports = { chat, visionChat, isOllamaRunning, MODEL, VISION_MODEL };