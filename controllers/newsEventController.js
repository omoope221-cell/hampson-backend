const NewsEvent = require('../models/NewsEvent');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');
const { uploadBuffer, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

// GET /api/v1/news-events?type=news|event — Super Admin management list,
// includes drafts (unlike the public endpoint).
exports.getAll = catchAsync(async (req, res) => {
  const features = new ApiFeatures(NewsEvent.find(), req.query).filter().sort().paginate();
  const [docs, total] = await Promise.all([features.query, NewsEvent.countDocuments(features.query.getFilter())]);

  res.status(200).json({
    status: 'success',
    results: docs.length,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

exports.getOne = catchAsync(async (req, res, next) => {
  const item = await NewsEvent.findById(req.params.id);
  if (!item) return next(new AppError('Not found.', 404));
  res.status(200).json({ status: 'success', data: item });
});

// POST /api/v1/news-events — multipart, optional field name "image"
exports.create = catchAsync(async (req, res, next) => {
  const { type, title, summary, content, status, eventDate, eventTime, location, featured, publishedAt } = req.body;
  if (!type || !title || !content) return next(new AppError('type, title and content are required.', 400));
  if (!['news', 'event'].includes(type)) return next(new AppError('type must be "news" or "event".', 400));

  let image = null;
  let imagePublicId = null;
  if (req.file) {
    const uploaded = await uploadBuffer(req.file.buffer, { folder: 'news-events' });
    image = uploaded.url;
    imagePublicId = uploaded.publicId;
  }

  const item = await NewsEvent.create({
    type, title, summary, content, image, imagePublicId,
    status: status || 'published',
    eventDate: type === 'event' ? (eventDate || null) : null,
    eventTime: type === 'event' ? (eventTime || '') : '',
    location: type === 'event' ? (location || '') : '',
    featured: featured === 'true' || featured === true,
    publishedAt: publishedAt || Date.now(),
    createdBy: req.user.id,
  });

  await recordAudit({ actor: req.user.id, action: 'news_event.create', targetModel: 'NewsEvent', targetId: item._id });
  res.status(201).json({ status: 'success', data: item });
});

exports.update = catchAsync(async (req, res, next) => {
  const item = await NewsEvent.findById(req.params.id);
  if (!item) return next(new AppError('Not found.', 404));

  const { title, summary, content, status, eventDate, eventTime, location, featured, publishedAt } = req.body;

  if (req.file) {
    const uploaded = await uploadBuffer(req.file.buffer, { folder: 'news-events' });
    if (item.imagePublicId) await deleteFromCloudinary(item.imagePublicId).catch(() => {});
    item.image = uploaded.url;
    item.imagePublicId = uploaded.publicId;
  }

  Object.assign(item, {
    title: title ?? item.title,
    summary: summary ?? item.summary,
    content: content ?? item.content,
    status: status ?? item.status,
    featured: featured !== undefined ? (featured === 'true' || featured === true) : item.featured,
    publishedAt: publishedAt ?? item.publishedAt,
  });
  if (item.type === 'event') {
    item.eventDate = eventDate ?? item.eventDate;
    item.eventTime = eventTime ?? item.eventTime;
    item.location = location ?? item.location;
  }
  await item.save();

  await recordAudit({ actor: req.user.id, action: 'news_event.update', targetModel: 'NewsEvent', targetId: item._id });
  res.status(200).json({ status: 'success', data: item });
});

exports.remove = catchAsync(async (req, res, next) => {
  const item = await NewsEvent.findByIdAndDelete(req.params.id);
  if (!item) return next(new AppError('Not found.', 404));
  if (item.imagePublicId) await deleteFromCloudinary(item.imagePublicId).catch(() => {});
  await recordAudit({ actor: req.user.id, action: 'news_event.delete', targetModel: 'NewsEvent', targetId: item._id });
  res.status(204).json({ status: 'success', data: null });
});
