const Class = require('../models/Class');
const factory = require('../utils/handlerFactory');

exports.getAllClasses = factory.getAll(Class, {
  searchableFields: ['name', 'arm'],
  populate: 'classTeacher subjects session subjectTeachers.subject subjectTeachers.teacher',
});
exports.getClass = factory.getOne(Class, { populate: 'classTeacher subjects session subjectTeachers.subject subjectTeachers.teacher' });
exports.createClass = factory.createOne(Class);
exports.updateClass = factory.updateOne(Class);
exports.deleteClass = factory.deleteOne(Class);
