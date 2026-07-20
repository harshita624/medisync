// Central branding config for Dana Shivam Heart & Super Speciality Hospital
// Import this anywhere you need the hospital name, contact info, or specialities
// so everything stays consistent across the app.

export const SITE = {
  name:        "Dana Shivam Heart & Super Speciality Hospital",
  shortName:   "Dana Shivam",
  tagline:     "Excellence in Cardiac Care & Super Speciality Treatment",
  city:        "Jaipur, Rajasthan",
  address:     "2, Opp Times Square Sector-2, Central Spine, Vidhyadhar Nagar, Jaipur-302023 (Raj.) INDIA",
  email:       "danashivamhospitalit@gmail.com",
  phones: [
    { label: "Appointments (India)", number: "+91 91160 03476" },
    { label: "Appointments (India)", number: "+91 91160 03477" },
    { label: "Landline",             number: "+91 141 2232220" },
    { label: "Gulf Countries",       number: "00971 50 798 3153" },
  ],
  social: {
    facebook:  "https://www.facebook.com/danashivamhospital/",
    twitter:   "https://twitter.com/dana_shivam",
    instagram: "https://www.instagram.com/danashivamhospital",
    youtube:   "https://www.youtube.com/channel/UCgoMH8r8uIG6uxuyz-xX0Lw",
  },
  mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d113798.89099785847!2d75.70767179610864!3d26.96007910060453!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x396db3ad8425dcc7%3A0xe37b6a26c13e6f8e!2sDana+Shivam+Heart+%26+Superspecialty+Hospital!5e0!3m2!1sen!2sin!4v1520939192261",
};

// Specialities offered — used on homepage, doctor specialization dropdowns, etc.
export const SPECIALITIES = [
  { key: "cardiology",        label: "Cardiology" },
  { key: "neurology",         label: "Neurology & Neurosurgery" },
  { key: "gastroenterology",  label: "Gastroenterology" },
  { key: "icu",               label: "MD Physician & ICU" },
  { key: "cardiac-surgery",   label: "Cardiac Surgery" },
  { key: "urology",           label: "Urology" },
  { key: "plastic-surgery",   label: "Plastic Surgery" },
  { key: "gi-laparoscopic",   label: "GI & Laparoscopic Surgery" },
  { key: "orthopedics",       label: "Orthopedics" },
  { key: "ent",               label: "ENT" },
  { key: "physiotherapy",     label: "Physiotherapy" },
  { key: "dialysis",          label: "Dialysis" },
  { key: "critical-care",     label: "Critical Care Unit" },
  { key: "radiology",         label: "Radiology" },
  { key: "nephrology",        label: "Nephrology" },
];

// Brand colors — cardiac-care theme (deep red/crimson primary, kept alongside
// the existing teal accents used by the patient/doctor/insurance portals)
export const BRAND_COLORS = {
  primary:       "#B91C1C",  // crimson — heart/cardiac theme
  primaryDark:   "#7F1D1D",
  primaryLight:  "#FEF2F2",
  secondary:     "#0D9488",  // teal — kept for portal accents (patient/doctor)
};