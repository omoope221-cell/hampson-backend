const Faq = require('../models/Faq');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const recordAudit = require('../utils/audit');

// GET /api/v1/faqs — admin, every status
exports.getAllFaqs = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  const faqs = await Faq.find(filter).sort({ category: 1, displayOrder: 1 });
  res.status(200).json({ status: 'success', results: faqs.length, data: faqs });
});

exports.createFaq = catchAsync(async (req, res, next) => {
  const { question, answer } = req.body;
  if (!question || !answer) return next(new AppError('question and answer are required.', 400));
  const faq = await Faq.create({ ...req.body, createdBy: req.user.id });
  await recordAudit({ actor: req.user.id, action: 'faq.create', targetModel: 'Faq', targetId: faq._id });
  res.status(201).json({ status: 'success', data: faq });
});

exports.updateFaq = catchAsync(async (req, res, next) => {
  const faq = await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!faq) return next(new AppError('FAQ not found.', 404));
  await recordAudit({ actor: req.user.id, action: 'faq.update', targetModel: 'Faq', targetId: faq._id });
  res.status(200).json({ status: 'success', data: faq });
});

exports.deleteFaq = catchAsync(async (req, res, next) => {
  const faq = await Faq.findByIdAndDelete(req.params.id);
  if (!faq) return next(new AppError('FAQ not found.', 404));
  await recordAudit({ actor: req.user.id, action: 'faq.delete', targetModel: 'Faq', targetId: faq._id });
  res.status(204).json({ status: 'success', data: null });
});

// PATCH /api/v1/faqs/reorder  { order: [id1, id2, id3, ...] }
exports.reorderFaqs = catchAsync(async (req, res, next) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0) {
    return next(new AppError('order must be a non-empty array of FAQ ids.', 400));
  }
  await Promise.all(order.map((id, index) => Faq.findByIdAndUpdate(id, { displayOrder: index })));
  const faqs = await Faq.find().sort({ category: 1, displayOrder: 1 });
  res.status(200).json({ status: 'success', data: faqs });
});
