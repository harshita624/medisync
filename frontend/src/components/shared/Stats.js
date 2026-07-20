"use client";
const ITEMS = [
  "Cardiology ✦", "Neurology & Neurosurgery ✦", "Gastroenterology ✦",
  "MD Physician & ICU ✦", "Cardiac Surgery ✦", "Urology ✦",
  "Plastic Surgery ✦", "Orthopedics ✦", "ENT ✦",
  "Physiotherapy ✦", "Nephrology & Dialysis ✦", "Critical Care ✦",
  "Radiology ✦", "GI & Laparoscopic ✦",
];

export default function Stats() {
  const doubled = [...ITEMS, ...ITEMS];
  return (
    <section className="relative overflow-hidden py-4 border-y border-teal-100 bg-gradient-to-r from-teal-50 via-white to-sky-50">
      <div className="flex animate-marquee whitespace-nowrap">
        {doubled.map((d, i) => (
          <span key={i} className="inline-flex items-center gap-3 text-sm font-bold text-teal-700 px-6">
            {d}
          </span>
        ))}
      </div>
    </section>
  );
}