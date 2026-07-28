const Subject = require('../models/Subject');
const factory = require('../utils/handlerFactory');

exports.getAllSubjects = factory.getAll(Subject, { searchableFields: ['name', 'code'], populate: 'teachers' });
exports.getSubject = factory.getOne(Subject, { populate: 'teachers' });
exports.createSubject = factory.createOne(Subject);
exports.updateSubject = factory.updateOne(Subject);
exports.deleteSubject = factory.deleteOne(Subject);
