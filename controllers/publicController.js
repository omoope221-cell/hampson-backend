const Leadership = require('../models/Leadership');
const GalleryImage = require('../models/GalleryImage');
const NewsEvent = require('../models/NewsEvent');
const SiteSettings = require('../models/SiteSettings');
const Faq = require('../models/Faq');
const User = require('../models/User');
const Notification = require('../models/Notification');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { sendEmail } = require('../utils/email');
const { contactConfirmationTemplate } = require('../utils/emailTemplates');

// GET /api/v1/public/leadership — active only, in display order
exports.getPublicLeadership = catchAsync(async (req, res) => {
  const leadership = await Leadership.find({ status: 'active' })
    .sort({ displayOrder: 1, fullName: 1 })
    .select('-createdBy -status');
  res.status(200).json({ status: 'success', results: leadership.length, data: leadership });
});

// GET /api/v1/public/gallery
exports.getPublicGallery = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  const images = await GalleryImage.find(filter)
    .sort({ featured: -1, displayOrder: 1, createdAt: -1 })
    .select('-uploadedBy');
  res.status(200).json({ status: 'success', results: images.length, data: images });
});

// GET /api/v1/public/news-events?type=news|event — published only.
// Events are sorted soonest-first (upcoming), News newest-first.
exports.getPublicNewsEvents = catchAsync(async (req, res, next) => {
  const { type } = req.query;
  if (!['news', 'event'].includes(type)) {
    return next(new AppError('type query param must be "news" or "event".', 400));
  }
  const sort = type === 'event' ? { featured: -1, eventDate: 1 } : { featured: -1, publishedAt: -1 };
  const items = await NewsEvent.find({ type, status: 'published' }).sort(sort).select('-createdBy');
  res.status(200).json({ status: 'success', results: items.length, data: items });
});

// GET /api/v1/public/news-events/:id — single published item (for a
// "read more" detail view).
exports.getPublicNewsEventOne = catchAsync(async (req, res, next) => {
  const item = await NewsEvent.findOne({ _id: req.params.id, status: 'published' }).select('-createdBy');
  if (!item) return next(new AppError('Not found.', 404));
  res.status(200).json({ status: 'success', data: item });
});

// GET /api/v1/public/settings — hero/homepage/contact/footer/admissions/SEO
exports.getPublicSettings = catchAsync(async (req, res) => {
  const settings = await SiteSettings.getSingleton();
  res.status(200).json({ status: 'success', data: settings });
});

// GET /api/v1/public/faqs — published only, grouped by category client-side
exports.getPublicFaqs = catchAsync(async (req, res) => {
  const faqs = await Faq.find({ status: 'published' })
    .sort({ category: 1, displayOrder: 1 })
    .select('-createdBy -status');
  res.status(200).json({ status: 'success', results: faqs.length, data: faqs });
});

// POST /api/v1/public/contact — the Contact page form. Sends the visitor
// a confirmation email and notifies Super Admins in-app (same
// Notification model/bell the rest of the dashboard already uses).
exports.submitContactForm = catchAsync(async (req, res, next) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return next(new AppError('Please provide your name, email, and message.', 400));
  }

  const settings = await SiteSettings.getSingleton();
  const recipient = settings.contactFormRecipientEmail || settings.email;

  const admins = await User.find({ accountType: 'super_admin', status: 'active' }).select('_id');
  if (admins.length) {
    await Notification.insertMany(
      admins.map((admin) => ({
        user: admin._id,
        title: `New contact message from ${name}`,
        body: subject || message.slice(0, 120),
        type: 'system',
        link: '/admin/dashboard',
      }))
    );
  }

  const { subject: emailSubject, html } = contactConfirmationTemplate({ name });
  sendEmail({ to: email, toName: name, subject: emailSubject, html }).catch(() => {});
  if (recipient) {
    sendEmail({
      to: recipient,
      subject: `New contact form message: ${subject || 'No subject'}`,
      html: `<p><strong>From:</strong> ${name} (${email})</p><p>${message}</p>`,
    }).catch(() => {});
  }

  res.status(200).json({ status: 'success', message: "Message sent — we'll be in touch soon." });
});
