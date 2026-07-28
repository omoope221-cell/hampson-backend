const Session = require('../models/Session');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const factory = require('../utils/handlerFactory');

exports.getAllSessions = factory.getAll(Session);
exports.getSession = factory.getOne(Session);
exports.createSession = factory.createOne(Session);
exports.updateSession = factory.updateOne(Session);
exports.deleteSession = factory.deleteOne(Session);

// PATCH /api/v1/sessions/:id/set-current
// Marks this session (and optionally one of its terms) as the active one
// school-wide, unsetting any previous current session/term.
exports.setCurrent = catchAsync(async (req, res, next) => {
  const { termId } = req.body;
  const target = await Session.findById(req.params.id);
  if (!target) return next(new AppError('Session not found.', 404));

  await Session.updateMany({ _id: { $ne: target._id } }, { isCurrent: false });
  target.isCurrent = true;

  if (termId) {
    target.terms.forEach((t) => {
      t.isCurrent = t._id.toString() === termId;
    });
  }
  await target.save();

  res.status(200).json({ status: 'success', data: target });
});

exports.getCurrent = catchAsync(async (req, res, next) => {
  const current = await Session.findOne({ isCurrent: true });
  if (!current) return next(new AppError('No current session has been set yet.', 404));
  res.status(200).json({ status: 'success', data: current });
});
