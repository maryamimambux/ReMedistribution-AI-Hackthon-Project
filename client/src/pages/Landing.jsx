import { Link } from 'react-router-dom';
import { Heart, Scan, Shield, MapPin, Users, TrendingUp, ArrowRight, CheckCircle2 } from 'lucide-react';

const stats = [
  { value: '8-10 min', label: 'Manual verification time', sub: 'Before AI' },
  { value: '<2 min', label: 'With AI pre-screening', sub: 'After AI', highlight: true },
  { value: '19+', label: 'Known manufacturers', sub: 'In risk database' },
  { value: '4', label: 'AI components', sub: 'OCR + Vision + Matching + LLM' },
];

const features = [
  { icon: Scan, title: 'OCR Label Scanning', desc: 'Scan any medicine box with your phone camera. Name, batch, expiry — auto-filled in 2 seconds.' },
  { icon: Shield, title: 'AI Safety Checks', desc: 'Computer vision pre-flags damaged packaging, broken seals, or tampering before the pharmacist even opens the box.' },
  { icon: MapPin, title: 'Nearby Drop-off Points', desc: 'Find verified collection centers near you — hospitals, pharmacies, and NGOs that are already in your area.' },
  { icon: Users, title: 'Smart Matching', desc: 'AI auto-matches patients to the nearest available medicine with the earliest expiry and highest priority.' },
  { icon: TrendingUp, title: 'Demand Prediction', desc: 'Forecast medicine needs by city and category — so NGOs can act before a shortage, not after.' },
  { icon: Heart, title: 'AI Chatbot', desc: 'Patients describe their need in plain Urdu or English. The AI extracts structured data — no forms needed.' },
];

const steps = [
  { num: '01', title: 'Scan', desc: 'Open the app and scan the medicine box. AI reads the label automatically.' },
  { num: '02', title: 'Answer', desc: 'Answer quick safety questions — seal intact, refrigerated, any damage?' },
  { num: '03', title: 'Drop Off', desc: 'Take the medicine to the nearest verified collection center.' },
  { num: '04', title: 'Verify', desc: 'A licensed pharmacist inspects and approves it.' },
  { num: '05', title: 'Match', desc: 'AI matches it to a patient who needs it most.' },
];

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-400 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-400 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700/50 rounded-full text-emerald-200 text-sm font-medium mb-8">
              <Heart className="w-4 h-4" />
              No life-saving medicine should become waste
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight">
              Donate unused medicine.{' '}
              <span className="text-emerald-300">Save lives.</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-emerald-100 leading-relaxed max-w-2xl">
              A trusted platform that connects donors with patients through licensed pharmacists.
              Every donation is verified, tracked, and matched using AI — so your medicine reaches
              someone who needs it, safely.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-emerald-800 font-bold rounded-xl hover:bg-emerald-50 transition-all shadow-lg hover:shadow-xl">
                Start Donating <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-700/50 text-white font-semibold rounded-xl hover:bg-emerald-700/70 transition-all border border-emerald-500/30">
                I Need Medicine
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className={`card text-center ${stat.highlight ? 'ring-2 ring-emerald-500 bg-emerald-50' : ''}`}>
              <div className={`text-3xl font-bold ${stat.highlight ? 'text-emerald-600' : 'text-gray-900'}`}>{stat.value}</div>
              <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">How It Works</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Five simple steps from scanning to saving a life. Every donation passes through
            a licensed pharmacist — never directly between strangers.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          {steps.map((step, i) => (
            <div key={i} className="relative">
              <div className="card text-center">
                <div className="w-12 h-12 mx-auto bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-lg font-bold mb-4">
                  {step.num}
                </div>
                <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
                <p className="text-sm text-gray-600 mt-2">{step.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-emerald-300">
                  <ArrowRight className="w-6 h-6" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* AI Features */}
      <section className="bg-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Powered by AI</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Four AI components that cut verification time from 8-10 minutes to under 2 minutes
              and automate the entire matching pipeline.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, i) => (
              <div key={i} className="card group hover:border-emerald-200">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
                  <feat.icon className="w-6 h-6 text-emerald-700" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{feat.title}</h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Chain */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">The Trust Chain</h2>
          <p className="mt-4 text-lg text-gray-600">
            Medicine never goes directly from stranger to stranger.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-center">
          {['Donor', 'Verified Center', 'Pharmacist Check', 'NGO/Hospital', 'Patient'].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`px-6 py-4 rounded-xl font-semibold ${i === 2 ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-700'}`}>
                {step}
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-5 h-5 text-gray-300" />}
            </div>
          ))}
        </div>
      </section>

      {/* SDGs */}
      <section className="bg-emerald-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-8">SDGs We Cover</h2>
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { num: 1, label: 'No Poverty', color: 'bg-red-600' },
              { num: 3, label: 'Good Health', color: 'bg-green-600' },
              { num: 12, label: 'Responsible Consumption', color: 'bg-yellow-600' },
            ].map((sdg) => (
              <div key={sdg.num} className={`${sdg.color} px-8 py-4 rounded-xl`}>
                <div className="text-3xl font-bold">SDG {sdg.num}</div>
                <div className="text-sm mt-1 opacity-90">{sdg.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-emerald-500" />
            <span className="text-lg font-bold text-white">ReMedistribution</span>
          </div>
          <p className="text-sm">No life-saving medicine should become waste.</p>
          <p className="text-xs mt-4 text-gray-500">Built for Pakistan. Designed for impact.</p>
        </div>
      </footer>
    </div>
  );
}
