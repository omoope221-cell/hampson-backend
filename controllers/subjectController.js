const Subject = require('../models/Subject');
const Class = require('../models/Class');
const SubjectResult = require('../models/SubjectResult');
const factory = require('../utils/handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.getAllSubjects = factory.getAll(Subject, { searchableFields: ['name', 'code'], populate: 'teachers' });
exports.getSubject = factory.getOne(Subject, { populate: 'teachers' });
exports.createSubject = factory.createOne(Subject);
exports.updateSubject = factory.updateOne(Subject);

// Deliberately NOT the generic factory.deleteOne — a subject can be
// referenced by Class.subjects/subjectTeachers and by SubjectResult
// score entries, and a bare delete would leave those pointing at
// nothing. Block the delete instead of leaving orphaned data behind.
exports.deleteSubject = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const [classUsing, hasResults] = await Promise.all([
    Class.findOne({ $or: [{ subjects: id }, { 'subjectTeachers.subject': id }] }).select('name arm'),
    SubjectResult.exists({ subject: id }),
  ]);

  if (classUsing) {
    return next(new AppError(
      `"${classUsing.name}${classUsing.arm ? ` ${classUsing.arm}` : ''}" still has this subject assigned. Remove it from that class (and any others) in Classes & Subjects before deleting it.`,
      400
    ));
  }
  if (hasResults) {
    return next(new AppError('This subject already has result scores recorded against it and can\'t be deleted. Remove those results first if you really need to delete it.', 400));
  }

  const doc = await Subject.findByIdAndDelete(id);
  if (!doc) return next(new AppError('No document found with that ID.', 404));
  res.status(204).json({ status: 'success', data: null });
});
