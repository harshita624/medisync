import Navbar     from "@/components/shared/Navbar";
import Hero       from "@/components/shared/Hero";
import Stats      from "@/components/shared/Stats";
import Features   from "@/components/shared/Features";
import Doctors    from "@/components/shared/Doctors";
import HowItWorks from "@/components/shared/HowItWorks";
import Portals    from "@/components/shared/Portals";
import Footer     from "@/components/shared/Footer";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <Doctors />
      <HowItWorks />
      <Portals />
      <Footer />
    </main>
  );
}