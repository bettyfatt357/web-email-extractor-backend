import Image from 'next/image'
import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { Features } from '@/components/landing/features'
import { Workflow } from '@/components/landing/workflow'
import { Industries } from '@/components/landing/industries'
import { Stats } from '@/components/landing/stats'
import { Pricing } from '@/components/landing/pricing'
import { FAQ } from '@/components/landing/faq'
import { Footer } from '@/components/landing/footer'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <Hero />

      {/* Dashboard Preview */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl overflow-hidden border border-border shadow-2xl">
            <Image
              src="/dashboard-mockup.png"
              alt="Nastech Dashboard Preview"
              width={1280}
              height={720}
              quality={75}
              priority
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <Features />

      {/* Workflow Section */}
      <Workflow />

      {/* Industries Section */}
      <Industries />

      {/* Stats Section */}
      <Stats />

      {/* Pricing Section */}
      <Pricing />

      {/* FAQ Section */}
      <FAQ />

      {/* Footer */}
      <Footer />
    </main>
  )
}
