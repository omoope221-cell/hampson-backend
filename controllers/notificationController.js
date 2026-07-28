const Notification = require('../models/Notification');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');

exports.getMyNotifications = catchAsync(async (req, res) => {
  const filter = { user: req.user.id };
  const features = new ApiFeatures(Notification.find(filter), req.query).filter().sort().paginate();
  const [docs, total, unreadCount] = await Promise.all([
    features.query,
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user.id, read: false }),
  ]);
  res.status(200).json({
    status: 'success',
    results: docs.length,
    unreadCount,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

exports.markRead = catchAsync(async (req, res, next) => {
  const note = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { read: true },
    { new: true }
  );
  if (!note) return next(new AppError('Notification not found.', 404));
  res.status(200).json({ status: 'success', data: note });
});

exports.markAllRead = catchAsync(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.status(200).json({ status: 'success', message: 'All notifications marked as read.' });
});

exports.deleteNotification = catchAsync(async (req, res, next) => {
  const note = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!note) return next(new AppError('Notification not found.', 404));
  res.status(204).json({ status: 'success', data: null });
});
