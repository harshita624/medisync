import Link from "next/link";
import { Activity, Facebook, Twitter, Instagram, Youtube, MapPin, Phone, Mail } from "lucide-react";

const patientCareLinks = ["Request an Appointment","Find a Doctor","Patient Stories","Insurance Partners","Health Package"];
const spec1 = ["Cardiology","Neurology & Neurosurgery","Cardiac Surgeries","MD Physician & ICU","Gastroenterology"];
const spec2 = ["Orthopedics","Plastic Surgery","Urology","Physiotherapy","Radiology"];
const socials = [
  { icon: Facebook,  href: "https://www.facebook.com/danashivamhospital/" },
  { icon: Twitter,   href: "https://twitter.com/dana_shivam" },
  { icon: Instagram, href: "https://www.instagram.com/danashivamhospital" },
  { icon: Youtube,   href: "https://www.youtube.com/channel/UCgoMH8r8uIG6uxuyz-xX0Lw" },
];

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
        <div className="grid md:grid-cols-4 gap-10 mb-12">

          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-9 h-9 rounded-xl med-icon-bubble flex items-center justify-center">
                <Activity size={17} className="text-white" />
              </div>
              <span className="font-syne font-extrabold text-lg text-white">Dana Shivam</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs text-slate-400 mb-5">
              Spirit to care, skill to heal — 25 years of cardiac and super-speciality excellence in Jaipur.
            </p>
            <div className="flex items-center gap-3">
              {socials.map(({ icon: Icon, href }) => (
                <a key={href} href={href} target="_blank" rel="noreferrer"
                  className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-white font-semibold mb-4 text-sm">Patient Care</p>
            <div className="space-y-2.5">
              {patientCareLinks.map(l => (
                <p key={l} className="text-sm hover:text-teal-400 cursor-pointer transition-colors">{l}</p>
              ))}
            </div>
          </div>

          <div>
            <p className="text-white font-semibold mb-4 text-sm">Specialities</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[...spec1, ...spec2].map(l => (
                <p key={l} className="text-xs hover:text-teal-400 cursor-pointer transition-colors leading-snug">{l}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-10">
          {[
            { icon: MapPin, text: "Vidhyadhar Nagar, Jaipur-302023" },
            { icon: Phone,  text: "+91 91160 03461" },
            { icon: Mail,   text: "danashivamhospitalit@gmail.com" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 bg-slate-800 rounded-2xl px-4 py-3">
              <Icon size={14} className="text-teal-400 shrink-0" />
              <span className="text-xs text-slate-300 truncate">{text}</span>
            </div>
          ))}
        </div>

        <div className="h-px animate-border-gradient opacity-40 mb-7" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Dana Shivam Heart &amp; Super Speciality Hospital. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-slate-500">24-hour emergency services</span>
          </div>
        </div>
      </div>
    </footer>
  );
}