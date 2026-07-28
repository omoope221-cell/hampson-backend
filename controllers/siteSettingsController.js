const SiteSettings = require('../models/SiteSettings');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const recordAudit = require('../utils/audit');
const { uploadBuffer } = require('../utils/cloudinaryUpload');

const VALID_TARGETS = ['logo', 'favicon', 'ogImage', 'admissionsBanner', 'heroImage'];

// GET /api/v1/site-settings — admin (full document, same shape as public)
exports.getSettings = catchAsync(async (req, res) => {
  const settings = await SiteSettings.getSingleton();
  res.status(200).json({ status: 'success', data: settings });
});

// PATCH /api/v1/site-settings — deep-merges the provided sections so the
// admin form can save one section (e.g. just `hero`) without wiping others.
exports.updateSettings = catchAsync(async (req, res, next) => {
  const settings = await SiteSettings.getSingleton();
  const body = req.body || {};

  const NESTED_KEYS = ['socialLinks', 'hero', 'cta', 'admissions', 'footer', 'seo', 'theme'];
  for (const key of Object.keys(body)) {
    if (NESTED_KEYS.includes(key) && typeof body[key] === 'object' && body[key] !== null && !Array.isArray(body[key])) {
      settings[key] = { ...(settings[key]?.toObject?.() || settings[key] || {}), ...body[key] };
    } else {
      settings[key] = body[key];
    }
  }
  settings.updatedBy = req.user.id;
  await settings.save();

  await recordAudit({ actor: req.user.id, action: 'site_settings.update', targetModel: 'SiteSettings', targetId: settings._id });

  res.status(200).json({ status: 'success', data: settings });
});

// POST /api/v1/site-settings/image?target=logo|favicon|ogImage|admissionsBanner|heroImage
// multipart, field name "image". heroImage appends to the backgroundImages
// array; every other target overwrites a single field.
exports.uploadImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('No image file uploaded.', 400));
  const { target } = req.query;
  if (!VALID_TARGETS.includes(target)) {
    return next(new AppError(`target must be one of: ${VALID_TARGETS.join(', ')}`, 400));
  }

  const { url } = await uploadBuffer(req.file.buffer, { folder: 'site' });
  const settings = await SiteSettings.getSingleton();

  if (target === 'logo') settings.logo = url;
  else if (target === 'favicon') settings.favicon = url;
  else if (target === 'ogImage') settings.seo.ogImage = url;
  else if (target === 'admissionsBanner') settings.admissions.banner = url;
  else if (target === 'heroImage') settings.hero.backgroundImages.push(url);

  settings.updatedBy = req.user.id;
  await settings.save();

  await recordAudit({
    actor: req.user.id,
    action: 'site_settings.upload_image',
    details: { target },
    targetModel: 'SiteSettings',
    targetId: settings._id,
  });

  res.status(200).json({ status: 'success', data: settings });
});

// DELETE /api/v1/site-settings/hero-image/:index — removes one hero
// background image from the array by position.
exports.removeHeroImage = catchAsync(async (req, res, next) => {
  const settings = await SiteSettings.getSingleton();
  const index = Number(req.params.index);
  if (Number.isNaN(index) || index < 0 || index >= settings.hero.backgroundImages.length) {
    return next(new AppError('Invalid hero image index.', 400));
  }
  settings.hero.backgroundImages.splice(index, 1);
  settings.updatedBy = req.user.id;
  await settings.save();
  res.status(200).json({ status: 'success', data: settings });
});
