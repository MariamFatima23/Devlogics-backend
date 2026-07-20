const mongoose = require('mongoose')

const siteSettingsSchema = new mongoose.Schema({
  // ── Identity
  portalName:    { type: String, default: 'DevLogics E-Portal' },
  tagline:       { type: String, default: 'Learn. Apply. Grow.' },
  heroSubtext:   { type: String, default: 'Apply for courses, internships and services — all online, 24/7.' },
  logoUrl:       { type: String, default: '' },

  // ── Stats bar
  statStudents:     { type: String, default: '1000+' },
  statPrograms:     { type: String, default: '50+' },
  statSatisfaction: { type: String, default: '98%' },

  // ── Marquee / partners strip
  partners: {
    type: [{ type: String }],
    default: ['Web Development','Artificial Intelligence','Digital Marketing','React Native','Python',
              'Machine Learning','Data Science','Cybersecurity','UI/UX Design','Cloud Computing',
              'Java','JavaScript','SEO','Graphic Design','DevOps'],
  },

  // ── How It Works steps (array of {step, icon, title, desc})
  howItWorks: {
    type: [{
      step:  { type: String },
      icon:  { type: String },
      title: { type: String },
      desc:  { type: String },
    }],
    default: [
      { step:'01', icon:'user',     title:'Create Account',    desc:'Register and complete your profile.' },
      { step:'02', icon:'submit',   title:'Submit Application', desc:'Choose course, fill form, attach CV.' },
      { step:'03', icon:'review',   title:'Admin Review',       desc:'Admin reviews and updates your status.' },
      { step:'04', icon:'decision', title:'Get Decision',       desc:'Receive Approved or Rejected with feedback.' },
    ],
  },

  // ── Features / Why Choose Us
  features: {
    type: [{
      icon:  { type: String },
      title: { type: String },
      desc:  { type: String },
    }],
    default: [
      { icon:'lock',   title:'Secure Login',       desc:'JWT auth with encrypted passwords.' },
      { icon:'mobile', title:'Mobile Friendly',    desc:'Works on any device perfectly.' },
      { icon:'bell',   title:'Real-time Alerts',   desc:'Instant notifications on status change.' },
      { icon:'chart',  title:'Track Applications', desc:'Full timeline for every application.' },
      { icon:'upload', title:'Document Upload',    desc:'Attach PDFs, images, Word docs.' },
      { icon:'cogs',   title:'Admin Dashboard',    desc:'Powerful panel to manage everything.' },
    ],
  },

  // ── About section
  aboutTitle:    { type: String, default: 'A Smarter Way to Learn & Apply' },
  aboutSubtitle: { type: String, default: 'DevLogics E-Portal is a complete digital solution for course and service management.' },
  aboutPoints: {
    type: [{ type: String }],
    default: [
      'Apply online — no office visits',
      'Upload CV and documents securely',
      'Track every application with timeline',
      'Real-time notifications on changes',
      'Admin review with detailed feedback',
      'Available 24/7 from any device',
    ],
  },
  aboutImageUrl: { type: String, default: '' },

  // ── Contact
  contactEmail:   { type: String, default: 'info@devlogics.com' },
  contactPhone:   { type: String, default: '+92-XXX-XXXXXXX' },
  contactAddress: { type: String, default: 'DevLogics Campus, Pakistan' },
  contactWebsite: { type: String, default: 'www.devlogics.com' },
  contactHours:   { type: String, default: 'Mon-Fri 9AM-5PM' },

  // ── Footer
  footerTagline: { type: String, default: 'Course & Service Management' },

  // ── Theme Colors
  theme: {
    primary:     { type: String, default: '#04065c' },   // navbar, sidebar, buttons
    secondary:   { type: String, default: '#023e8a' },   // gradients, hover
    accent:      { type: String, default: '#48cae4' },   // highlights, badges, active
    bgLight:     { type: String, default: '#f0f9ff' },   // page background
    bgDark:      { type: String, default: '#04065c' },   // dark sections
    cardBg:      { type: String, default: '#ffffff' },   // card background (white)
    cardDark:    { type: String, default: '#023e8a' },   // dark cards
    textColor:   { type: String, default: '#1e293b' },   // body text
    borderColor: { type: String, default: '#caf0f8' },   // borders
    white:       { type: String, default: '#ffffff' },   // white elements (forms, cards)
    navText:     { type: String, default: '#ffffff' },   // navbar text colour
    // Section-specific overrides
    heroFrom:    { type: String, default: '' },
    heroTo:      { type: String, default: '' },
    footerBg:    { type: String, default: '' },
  },
}, { timestamps: true })

module.exports = mongoose.model('SiteSettings', siteSettingsSchema)
