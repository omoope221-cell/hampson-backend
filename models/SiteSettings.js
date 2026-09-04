const mongoose = require('mongoose');

// A single document (fixedId below) holding every piece of public-website
// copy/config that isn't its own collection (Events/Announcements/
// Teachers/Gallery already have their own models). One document keeps the
// Website Settings admin page and the public site reading from one place,
// with no risk of "which record is live" ambiguity.
const FIXED_ID = 'site-settings-singleton';

const statSchema = new mongoose.Schema(
  { label: String, value: String, icon: String },
  { _id: false }
);

const testimonialSchema = new mongoose.Schema(
  { name: String, role: String, quote: String, photo: String },
  { _id: false }
);

const partnerSchema = new mongoose.Schema({ name: String, logo: String, url: String }, { _id: false });

const siteSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: FIXED_ID },

    // --- Identity / contact (Website Settings + Contact page + Footer) ---
    schoolName: { type: String, default: 'Hampsons Group of School' },
    motto: { type: String, default: 'Believe and Achieve' },
    logo: { type: String, default: '/logo-removebg-preview.png' },
    tourVideoUrl: { type: String, default: '' }, // YouTube/Vimeo link or a direct video file URL
    favicon: { type: String, default: null },
    email: { type: String, default: 'info@hampsonsgroupofschool.edu.ng' },
    admissionsEmail: { type: String, default: 'admissions@hampsonsgroupofschool.edu.ng' },
    phones: { type: [String], default: ['+234 800 123 4567'] },
    whatsapp: { type: String, default: null },
    address: { type: String, default: '15 Educational Crescent, GRA Phase 2, Lagos, Nigeria' },
    googleMapsEmbed: { type: String, default: null },
    officeHours: { type: String, default: 'Mon–Fri: 8:00 AM – 4:00 PM' },
    websiteUrl: { type: String, default: 'http://localhost:5173' },
    socialLinks: {
      facebook: { type: String, default: null },
      twitter: { type: String, default: null },
      instagram: { type: String, default: null },
      linkedin: { type: String, default: null },
      youtube: { type: String, default: null },
    },
    contactFormRecipientEmail: { type: String, default: null },

    // --- Homepage hero ---
    hero: {
      title: { type: String, default: 'Hampsons Group of School' },
      subtitle: {
        type: String,
        default:
          "Nurturing Tomorrow's Leaders Today — world-class education blending academic excellence with character development, creativity, and innovation.",
      },
      buttonText: { type: String, default: 'Apply Now' },
      buttonLink: { type: String, default: '/admissions' },
      backgroundImages: { type: [String], default: [] },
      backgroundVideo: { type: String, default: null },
    },

    // --- Homepage content ---
    about: {
      type: String,
      default:
        'Hampsons Group of School is a leading primary and secondary school committed to providing a balanced education that develops intellectual curiosity, moral integrity, and a lifelong love of learning. Our dedicated faculty and state-of-the-art facilities create an environment where every child can thrive.',
    },
    principalMessage: { type: String, default: '' },
    mission: {
      type: String,
      default: 'To provide a nurturing, inclusive environment where every student is empowered to reach their full academic and personal potential.',
    },
    vision: {
      type: String,
      default: 'To be a leading centre of educational excellence, shaping confident, principled leaders for tomorrow.',
    },
    coreValues: { type: [String], default: ['Integrity', 'Excellence', 'Respect', 'Innovation'] },
    // The only two stats shown publicly now (Home + About, via the shared
    // SchoolStats component) — free-text so the admin can write "2,500+",
    // "3,000+", "13+", etc. Left blank, the stat is simply not shown.
    studentCount: { type: String, trim: true, default: '2,500+' },
    yearsOfExcellence: { type: String, trim: true, default: '13+' },
    // Kept for backward compatibility with any data already saved here —
    // no longer read by the public site (see SchoolStats.jsx).
    statistics: {
      type: [statSchema],
      default: [
        { label: 'Students', value: '1,200+' },
        { label: 'Teachers', value: '85+' },
        { label: 'Years of Excellence', value: '13+' },
        { label: 'University Placements', value: '98%' },
      ],
    },
    testimonials: { type: [testimonialSchema], default: [] },
    partners: { type: [partnerSchema], default: [] },
    cta: {
      title: { type: String, default: 'Ready to Join the Hampsons Family?' },
      subtitle: { type: String, default: 'Applications for the current academic year are now open. Spaces are limited.' },
      buttonText: { type: String, default: 'Apply Now' },
      buttonLink: { type: String, default: '/admissions' },
    },

    // --- Admissions page ---
    admissions: {
      status: { type: String, enum: ['open', 'closed'], default: 'open' },
      requirements: {
        type: [String],
        default: [
          'Completed application form',
          'Copy of birth certificate or passport',
          'Previous school reports (last 2 years)',
          'Recent passport-size photograph',
        ],
      },
      process: {
        type: [String],
        default: [
          'Submit the online application form with student and guardian details.',
          'Prospective students take an age-appropriate entrance assessment.',
          'Shortlisted families are invited for an interview and campus tour.',
          'Successful applicants receive an offer and complete enrollment.',
        ],
      },
      datesNote: { type: String, default: '' },
      forms: { type: [{ label: String, url: String }], default: [] },
      banner: { type: String, default: null },
      // --- Admission Settings ---
      // Payment and the entrance exam both happen physically at the school —
      // there is no online payment gateway. These values are read by the
      // application-received email so every applicant gets the same
      // up-to-date instructions without any hardcoding.
      admissionFeeAmount: { type: Number, default: 5000 }, // in Naira, paid physically at the school
      schoolVisitDate: { type: Date, default: null }, // date the applicant should come to the school
      examDate: { type: Date, default: null },
      examStartTime: { type: String, default: '09:00' }, // 24h "HH:MM"
      examEndTime: { type: String, default: '11:00' },
      examDurationMinutes: { type: Number, default: 60 },
      instructions: {
        type: String,
        default: 'Payment and the entrance examination will both be conducted physically at the school. Please do not make any online payment.',
      },
    },

    // --- Footer ---
    footer: {
      description: {
        type: String,
        default:
          'Nurturing excellence in education. We provide a holistic learning environment that fosters intellectual, social, and emotional growth.',
      },
      quickLinks: { type: [{ label: String, url: String }], default: [] },
      copyrightText: { type: String, default: '' },
    },

    // --- SEO / theme ---
    seo: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      keywords: { type: String, default: '' },
      ogImage: { type: String, default: null },
    },
    theme: {
      primaryColor: { type: String, default: '#2563EB' },
      secondaryColor: { type: String, default: '#EC4899' },
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

siteSettingsSchema.statics.FIXED_ID = FIXED_ID;

// Always returns the one settings document, creating it with defaults on
// first access so the public site never has to special-case "no settings
// saved yet".
siteSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findById(FIXED_ID);
  if (!doc) doc = await this.create({ _id: FIXED_ID });
  return doc;
};

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
