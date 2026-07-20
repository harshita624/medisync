'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import { HeartPulse, GraduationCap, ChevronRight, ArrowRight } from 'lucide-react';

const SIDEBAR = [
  { slug:'cardiology',        title:'Cardiology'                },
  { slug:'neurology',         title:'Neurology & Neurosurgery'  },
  { slug:'gastroenterology',  title:'Gastroenterology'          },
  { slug:'md-physician-icu',  title:'MD Physician & ICU'        },
  { slug:'cardiac-surgeries', title:'Cardiac Surgeries'         },
  { slug:'urology',           title:'Urology'                   },
  { slug:'plastic-surgery',   title:'Plastic Surgery'           },
  { slug:'gi-laparoscopic',   title:'GI & Laparoscopic Surgery' },
  { slug:'orthopedics',       title:'Orthopedics'               },
  { slug:'ent',               title:'ENT'                       },
  { slug:'physiotherapy',     title:'Physiotherapy'             },
  { slug:'dialysis',          title:'Dialysis'                  },
  { slug:'critical-care',     title:'Critical Care Unit'        },
  { slug:'radiology',         title:'Radiology'                 },
  { slug:'nephrology',        title:'Nephrology'                },
];

const CONTENT = {
  cardiology: {
    title:'Cardiology',
    intro:'Cardiology is a branch of medicine dealing with disorders of the heart and parts of the circulatory system. Dana Shivam Heart & Superspeciality Hospital has a dedicated heart care unit and Cath Lab for all kinds of cardiac problems.',
    hod:{ name:'Dr. Sunil Kumar Garssa', role:'Director & Senior Consultant Cardiology', qualifications:'MBBS, MD (Internal Medicine), DM (Cardiology) SGPGI-Lucknow · FACC · FESC · FSCAI', bio:'HOD of the cardiology department. Has treated more than 10,000 patients and completed over 4,500 angiographies and angioplasties. Among the best cardiologists in Jaipur.', initials:'SG' },
    sections:[
      { heading:'Techniques to Diagnose Heart Issues', content:'A small pain or acute/chronic heart issue can become evident during daily routine. Expert diagnosis is required to determine the appropriate course of treatment.\n\nDana Shivam has access to the latest advanced diagnostic equipment and vast range of cardiac diagnostic services.' },
      { heading:'Angiography', content:'A medical imaging technique where a catheter is inserted into blood vessels guided towards the heart with digital X-ray. Dana Shivam is the best hospital for Coronary Angiography and Dr. Sunil Kumar Garssa has done Radial Angiography in more than 90% of cases.' },
      { heading:'Angioplasty', content:'An endovascular minimally invasive technique to widen obstructed arteries. In Dana Shivam, angioplasty through Radial route is done in more than 80% cases.', bullets:['LM Disease','LM Bifurcation','Rotablation of Calcified Artery','Primary Angioplasty by Radial Route','Peripheral Angioplasty','Carotid Angioplasty','Pacemaker & CRT & Combo device','Device closure of CHD / ASD / PDA','Balloon Valvuloplasty'] },
      { heading:'Echocardiography (ECHO)', content:'Routine ECHO along with Infant & Paediatric ECHO and TEE (transoesophageal echocardiogram).' },
      { heading:'Stress Testing (TMT)', content:'Treadmill test performed to assess cardiac function under controlled stress conditions.' },
    ],
    doctors:[{ name:'Dr. Sunil Kumar Garssa', role:'Director & Senior Consultant Cardiology', qualifications:'MD, DM (Cardiology) SGPGI-Lucknow · FACC · FESC · FSCAI', initials:'SG' },{ name:'Dr. Shalini Tomar Garssa', role:'Director & Non-Interventional Cardiologist', qualifications:'MBBS, PGDHHM', initials:'ST' }],
    teamTitle:'Cardiology Team',
  },
  neurology: {
    title:'Neurology & Neurosurgery',
    intro:'Neurology deals with disorders of the nervous system. Dana Shivam Hospital has a dedicated neuro-intensive care unit, theatre suite and ward.',
    hod:{ name:'Dr. Rajveer Garssa', role:'Head of Department — Neurosurgery', qualifications:'MS, M.Ch (AIIMS, New Delhi)', bio:'HOD of Neurosurgery. Has treated more than 9,500 patients and completed over 1,500 Neurosurgeries.', initials:'RG' },
    sections:[{ heading:'Our Neuro Treatment Includes', bullets:['Head injury','Brain hemorrhage including aneurysms','Tumors of pituitary region','Brain tumors of all types','Congenital brain disorders','Movement disorders (Parkinson\'s, tremor, dystonia)','Peripheral nerve entrapment syndromes','Spinal disorders'], content:'Dana Shivam is among the few hospitals in Rajasthan where Neurologist, Neurosurgeons, Neuro anaesthetist and Neuro critical doctors work as a team.' }],
    doctors:[{ name:'Dr. Rajvir Singh Garssa', role:'Consultant — Brain & Spine Surgery', qualifications:'MS, M.Ch (AIIMS, New Delhi)', initials:'RG' },{ name:'Dr. Kuldeep Nehra', role:'Neurologist', qualifications:'', initials:'KN' }],
    teamTitle:'Neurology & Neurosurgery Doctors',
  },
  gastroenterology: {
    title:'Gastroenterology',
    intro:'The department of Gastroenterology at Dana Shivam is dedicated to the management of diseases of the digestive and hepatobiliary systems, offering expert care in both Medical and Surgical Gastroenterology.',
    sections:[{ content:'Covers diseases of the esophagus, stomach, small intestine, colon, rectum, pancreas, gallbladder, bile ducts, and liver. Also provides all endoscopic procedures.' },{ heading:'GI Surgical Team (GIST)', content:'Functions within the Centre of Excellence for Liver & Digestive Diseases. The GIST team provides comprehensive laparoscopic and conventional surgical treatments for all gastrointestinal conditions.' }],
    doctors:[{ name:'Dr. Subhash Doot', role:'Consultant — Gastroenterologist', qualifications:'MD (Medicine), DM (Gastro)', initials:'SD' }],
    teamTitle:'Gastroenterology Doctor',
  },
  'md-physician-icu': {
    title:'MD Physician & ICU',
    intro:'Dana Shivam has a dedicated Critical / General care unit with the best General Physician in Jaipur, who studies, diagnoses and treats each patient accordingly.',
    sections:[{ heading:'Role of Physician', content:'The physician leads and supervises patient overall health care through a regulated range of practice and laboratory-based diagnostics.' }],
    doctors:[{ name:'Dr. C.P. Suthar', role:'Physician, Diabetologist & Intensivist', qualifications:'MD (Medicine), FCCS (USA)', initials:'CS' }],
    teamTitle:'MD Physician & ICU Doctor',
  },
  'cardiac-surgeries': {
    title:'Cardiac Surgeries',
    intro:'Dana Shivam Heart & Superspeciality Hospital is a top-ranked cardiac surgery hospital in Jaipur. Our doctors see more than 4,500 outpatients and perform more than 2,000 heart operations annually.',
    sections:[{ content:'Highly trained surgeons, physicians, nurses and care givers work as a team using the latest innovations including minimally invasive and robot-assisted heart surgery.' },{ heading:'Complex Procedures Performed', bullets:['Open heart surgery / Heart failure treatment','Surgery for congenital heart disease in adults','Surgery for congenital heart defects in children','Heart valve repair and replacement surgery'] }],
    doctors:[], teamTitle:'',
  },
  urology: {
    title:'Urology',
    intro:'Urology deals with diseases of the Kidney, Urinary Bladder, Prostate gland, Testis and Penis.',
    sections:[{ heading:'Conditions Treated', bullets:['Urinary Tract Infections (UTI)','Male sexual dysfunction','Renal stones','Renal / Ureteric obstructions','Male infertility','Kidney tumors','Bladder tumors'], content:'Also deals with Kidney transplantation and congenital anomalies of the Genitourinary tract.' },{ heading:'Urology Facilities', bullets:['24-hour urology care with daily morning and evening OPD','Minimal access urological emergencies','Dornier lithotripter for kidney stones','Uro-dynamics Laboratory'] }],
    doctors:[], teamTitle:'',
  },
  'plastic-surgery': {
    title:'Plastic Surgery',
    intro:'Plastic surgery at Dana Shivam covers correction, modification, restoration, and alteration of human body parts — from cosmetic shortcomings to burn marks and age-related issues.',
    sections:[{ content:'Our surgeons are among the leaders in their category with international reputation, maintaining privacy and confidence. International patients come to Dana Shivam for cosmetic surgery with successful results.' }],
    doctors:[{ name:'Dr. Deepesh Goyal', role:'Consultant Plastic Surgery & Cosmetic Surgery', qualifications:'M.S., MCh (Plastic & Cosmetic Surgery)', initials:'DG' },{ name:'Dr. Vipin Barala', role:'Consultant Plastic Surgery & Cosmetic Surgery', qualifications:'M.S., DNB, MCh (Plastic & Cosmetic Surgery)', initials:'VB' }],
    teamTitle:'Plastic Surgery Doctors',
  },
  'gi-laparoscopic': {
    title:'GI & Laparoscopic Surgery',
    intro:'Dana Shivam offers advanced GI & Laparoscopic Surgery services with experienced surgeons specialising in minimally invasive procedures for abdominal conditions.',
    sections:[{ content:'Comprehensive care for all gastrointestinal and laparoscopic surgical conditions using both conventional and minimally invasive techniques for faster recovery.' }],
    doctors:[], teamTitle:'',
  },
  orthopedics: {
    title:'Orthopedics',
    intro:'Dana Shivam for Orthopedics, Joint Reconstruction and Spine Surgery is among the best quaternary care hospitals in Jaipur, focused on the latest joint replacement, spine surgery, sports injury, and trauma techniques.',
    sections:[{ heading:'Services', content:'The Centre is organised in sub-specializations for disorders of the musculoskeletal system.', bullets:['Trauma and General Orthopedics','Spine Surgery','Sports Medicine and Joint Reconstruction','Joint Replacement','Total Hip Replacement','Total Knee Replacement (MIS)','Unicondylar (Partial) Knee Replacement','Replacement of Shoulder and Elbow joints','Paediatric Orthopaedic','Musculoskeletal Oncology'] }],
    doctors:[{ name:'Dr. Nitin Gupta', role:'Orthopedic Surgeon', qualifications:'MBBS, MS (Ortho)', initials:'NG' }],
    teamTitle:'Orthopedic Surgeon',
  },
  ent: {
    title:'ENT',
    intro:'The ENT department at Dana Shivam handles all surgeries related to EAR, NOSE, THROAT and NECK including Cochlear Implant surgery, and provides Emergency services, routine OPD, and Speech therapy.',
    sections:[{ heading:'Surgeries Performed', grouped:[
      { group:'EAR', items:['Cochlear implantation','Tympanoplasty','Mytringoplasty','Stapedotomy','Radical mastoidectomy','Facial nerve decompression'] },
      { group:'NOSE', items:['Endoscopic DCR','Septoplasty','FESS','Endoscopic Orbital decompression','Turbinoplasty'] },
      { group:'THROAT', items:['Adenotonsillectomy','UPPP','MLS for Vocal polyp','Foreign body removal'] },
      { group:'NECK & HEAD', items:['Thyroidectomy','Parotidectomy','Thyroglossal cyst removal','Submandibular gland excision','Laryngectomy'] },
    ] }],
    doctors:[], teamTitle:'',
  },
  physiotherapy: {
    title:'Physiotherapy',
    intro:'Dana Shivam has a dedicated physiotherapy and rehabilitation unit supporting post-surgical recovery and management of musculoskeletal conditions for all age groups.',
    sections:[{ content:'Our physiotherapy team works with orthopedic, neurological, and cardiac departments to provide tailored rehabilitation programs — helping patients regain mobility, strength, and independence.' }],
    doctors:[], teamTitle:'',
  },
  dialysis: {
    title:'Dialysis',
    intro:'Dana Shivam provides comprehensive dialysis services with dedicated facilities, experienced nephrologists, and trained technicians ensuring the highest standard of care.',
    sections:[{ content:'Our Dialysis unit offers both Haemodialysis and Peritoneal Dialysis along with regular monitoring and counselling for patients and families.' }],
    doctors:[], teamTitle:'',
  },
  'critical-care': {
    title:'Critical Care Unit',
    intro:'Dana Shivam\'s Critical Care Unit is staffed 24/7 by MD physicians and intensivists, providing round-the-clock monitoring for critically ill patients.',
    sections:[{ content:'Equipped with latest monitoring equipment and ventilatory support systems. The multidisciplinary team manages complex, life-threatening conditions for the best possible outcomes.' }],
    doctors:[], teamTitle:'',
  },
  radiology: {
    title:'Radiology',
    intro:'Radiology at Dana Shivam uses radiant energy like X-rays for the diagnosis and treatment of disorders through medical imaging techniques.',
    sections:[{ heading:'Imaging Techniques', bullets:['X-ray radiography','Sonography','Ultrasound','Computed tomography (CT scan)','Positron emission tomography (PET)','Magnetic resonance imaging (MRI)'], content:'Our dedicated team includes the best Radiology Specialist experienced in Interventional Radiology for minimally invasive image-guided procedures.' }],
    doctors:[{ name:'Dr. Sanju Palsania', role:'Radiologist', qualifications:'M.D. (Radio-Diagnosis)', initials:'SP' }],
    teamTitle:'Radiology Doctor',
  },
  nephrology: {
    title:'Nephrology',
    intro:'Dana Shivam offers comprehensive nephrology services for the diagnosis and treatment of kidney diseases at all stages — from early detection to advanced care including transplant support.',
    sections:[{ content:'Works in close coordination with the dialysis unit, urology, and critical care. Treats CKD, acute kidney injury, glomerulonephritis, polycystic kidney disease, and diabetic nephropathy.' }],
    doctors:[], teamTitle:'',
  },
};

function SectionBlock({ section }) {
  return (
    <div className="mb-6">
      {section.heading && <h3 className="text-lg font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">{section.heading}</h3>}
      {section.content && section.content.split('\n\n').map((p, i) => <p key={i} className="text-slate-600 text-sm leading-relaxed mb-3">{p}</p>)}
      {section.bullets?.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {section.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0" />{b}
            </li>
          ))}
        </ul>
      )}
      {section.extraContent && section.extraContent.split('\n\n').map((p, i) => <p key={i} className="text-slate-600 text-sm leading-relaxed mb-3">{p}</p>)}
      {section.grouped?.map(group => (
        <div key={group.group} className="mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2">{group.group}</p>
          <ul className="space-y-1.5">
            {group.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0" />{item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function DoctorCard({ doc }) {
  return (
    <div className="bento p-5 flex flex-col items-center text-center card-hover">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-white text-2xl font-extrabold mb-4 shadow-lg"
        style={{ background: "var(--grad-primary)" }}>
        {doc.initials}
      </div>
      <h4 className="font-bold text-slate-900 text-sm">{doc.name}</h4>
      <p className="text-xs font-semibold text-teal-600 mt-1 leading-snug">{doc.role}</p>
      {doc.qualifications && (
        <div className="flex items-center gap-1 mt-2 text-slate-400">
          <GraduationCap size={11} /><p className="text-[11px]">{doc.qualifications}</p>
        </div>
      )}
    </div>
  );
}

export default function SpecialityPage() {
  const { slug } = useParams();
  const data = CONTENT[slug] || null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Hero bar */}
      <div className="pt-20 pb-0" style={{ background: "var(--grad-primary)" }}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 text-xs text-white/70 mb-3">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight size={12} />
            <Link href="/#features" className="hover:text-white transition-colors">Specialities</Link>
            <ChevronRight size={12} />
            <span className="text-white font-semibold">{data?.title || 'Not Found'}</span>
          </div>
          {data && <h1 className="font-syne text-3xl font-extrabold text-white">{data.title}</h1>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-[260px_1fr] gap-7 items-start">

          {/* Sidebar */}
          <aside className="lg:sticky lg:top-6">
            <div className="bento rounded-3xl overflow-hidden">
              <div className="px-4 py-3.5 flex items-center gap-2" style={{ background: "var(--grad-primary)" }}>
                <HeartPulse size={15} className="text-white" />
                <p className="font-bold text-sm text-white">Our Specialities</p>
              </div>
              <nav className="bg-white">
                {SIDEBAR.map(item => {
                  const active = item.slug === slug;
                  return (
                    <Link key={item.slug} href={`/specialities/${item.slug}`}
                      className={`flex items-center justify-between px-4 py-2.5 text-sm border-b border-slate-50 transition-all ${
                        active ? 'bg-teal-50 text-teal-700 font-semibold border-l-2 border-l-teal-500' : 'text-slate-600 hover:bg-slate-50 hover:text-teal-600'
                      }`}>
                      {item.title}
                      {active && <ChevronRight size={13} className="text-teal-400 shrink-0" />}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main>
            {!data ? (
              <div className="med-card rounded-3xl p-16 text-center">
                <HeartPulse size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-500 font-medium">Speciality not found</p>
                <Link href="/" className="text-teal-600 text-sm font-semibold mt-2 inline-block hover:underline">Back to Home</Link>
              </div>
            ) : (
              <>
                <div className="med-card rounded-3xl p-7 mb-5">
                  {data.intro.split('\n\n').map((p, i) => <p key={i} className="text-slate-600 text-sm leading-relaxed mb-3">{p}</p>)}
                  {data.hod && (
                    <div className="mt-5 rounded-2xl p-4 flex items-start gap-4" style={{ background: "var(--grad-soft)" }}>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-extrabold shrink-0 shadow-sm"
                        style={{ background: "var(--grad-primary)" }}>
                        {data.hod.initials}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{data.hod.name}</p>
                        <p className="text-xs font-semibold text-teal-600 mt-0.5">{data.hod.role}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{data.hod.qualifications}</p>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{data.hod.bio}</p>
                      </div>
                    </div>
                  )}
                </div>

                {data.sections.length > 0 && (
                  <div className="med-card rounded-3xl p-7 mb-5">
                    {data.sections.map((s, i) => <SectionBlock key={i} section={s} />)}
                  </div>
                )}

                {data.teamTitle && data.doctors.length > 0 && (
                  <div className="med-card rounded-3xl p-7 mb-5">
                    <h2 className="text-xl font-bold text-slate-900 mb-5 text-center">{data.teamTitle}</h2>
                    <div className={`grid gap-5 ${data.doctors.length === 1 ? 'max-w-xs mx-auto' : data.doctors.length === 2 ? 'sm:grid-cols-2 max-w-md mx-auto' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                      {data.doctors.map(doc => <DoctorCard key={doc.name} doc={doc} />)}
                    </div>
                  </div>
                )}

                <div className="rounded-3xl p-7 text-white flex flex-col sm:flex-row items-center justify-between gap-4"
                  style={{ background: "var(--grad-primary)" }}>
                  <div>
                    <p className="font-bold text-xl">Need a Consultation?</p>
                    <p className="text-white/75 text-sm mt-1">Book an appointment with our {data.title} specialists today.</p>
                  </div>
                  <Link href="/register"
                    className="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-white font-bold text-sm rounded-2xl hover:bg-teal-50 transition-all shadow-lg"
                    style={{ color: "var(--teal-dark)" }}>
                    Book Appointment <ArrowRight size={15} />
                  </Link>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}