import { useState } from 'react';
import { BookOpen, X, Droplet, Waves, Tornado, Sun } from 'lucide-react';

const DISASTERS = [
  {
    id: 'flood', title: 'Flood', icon: Droplet, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', steps: [
      "Kill main breaker box IMMEDIATELY to prevent electrocution.",
      "Move to highest elevation available. Do not get trapped in an attic without an exit.",
      "Seal valuable documents in watertight bags.",
      "Do NOT wade through floodwaters. 6 inches can knock you down. 2 feet can sweep away cars.",
      "Assume all standing water is biologically or chemically contaminated."
    ]
  },
  {
    id: 'tsunami', title: 'Tsunami', icon: Waves, color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30', steps: [
      "Abandon vehicles. Run to high ground or inland IMMEDIATELY on foot.",
      "Do not wait for official warnings if you feel a strong earthquake lasting 20+ seconds.",
      "Grab your bug-out bag, but drop it if it slows your ascent.",
      "If trapped, find a tall, reinforced concrete building and get to the 3rd floor or higher.",
      "Stay away from the coast until officials issue an 'all clear'. Subsequent waves are often larger."
    ]
  },
  {
    id: 'cyclone', title: 'Cyclones', icon: Tornado, color: 'text-slate-800 dark:text-slate-300', bg: 'bg-slate-400/10', border: 'border-slate-400/30', steps: [
      "Tape windows with a star pattern. Barricade entry points with heavy furniture.",
      "Shelter in a windowless interior room or basement. Use a mattress for overhead cover.",
      "Disconnect gas lines at the main valve to prevent explosions.",
      "Charge all devices while power remains. Fill bathtubs and containers with water.",
      "Do not leave shelter during the 'eye'. The back wall hits with extreme violence."
    ]
  },
  {
    id: 'heat', title: 'Heat Surges', icon: Sun, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', steps: [
      "Block sunlight completely. Cover windows with foil or dark, thick blankets.",
      "Hydrate aggressively. Drink water before you feel thirsty. Mix in salt/electrolytes.",
      "Identify the coolest room (usually lowest level, north-facing). Stay on the floor.",
      "Soak clothing or towels in cold water and drape over your neck and wrists.",
      "Avoid protein-heavy meals; digestion increases internal body temperature."
    ]
  }
];

/**
 * HandbookView — Offline emergency survival handbook with disaster-specific action plans.
 */
export default function HandbookView() {
  const [selectedDisaster, setSelectedDisaster] = useState(null);

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
      {/* Header Card */}
      <div className="bg-[#A891DE] p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[3.5rem] shadow-[0_20px_50px_rgba(168,145,222,0.3)] text-white relative overflow-hidden">
        <div className="relative z-10">
          <BookOpen size={30} className="mb-3 opacity-80" />
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic mb-1 sm:mb-2">Survival Guide</h2>
          <p className="text-xs sm:text-sm font-medium opacity-80">Offline Emergency Handbook</p>
        </div>
        <div className="absolute -right-10 -bottom-10 opacity-10"><BookOpen size={150} /></div>
      </div>

      {selectedDisaster ? (
        <div className="space-y-4 animate-in slide-in-from-right-5 duration-500">
          <button onClick={() => setSelectedDisaster(null)} className="mb-2 sm:mb-4 text-[#A891DE] font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-70">
            <X size={16} /> Back to Hub
          </button>
          <div className={`p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[3rem] border ${selectedDisaster.bg} ${selectedDisaster.border} relative overflow-hidden`}>
            <selectedDisaster.icon size={36} className={`${selectedDisaster.color} mb-4 sm:mb-6`} />
            <h3 className={`font-black text-xl sm:text-2xl uppercase tracking-tight ${selectedDisaster.color} mb-4 sm:mb-6`}>{selectedDisaster.title} Action Plan</h3>
            <div className="space-y-3 sm:space-y-4 relative z-10">
              {selectedDisaster.steps.map((step, idx) => (
                <div key={idx} className="flex gap-3 sm:gap-4 items-start">
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center font-black text-[10px] sm:text-xs text-white ${selectedDisaster.color.replace('text-', 'bg-').replace(' dark:text-slate-300', '')} shrink-0 mt-0.5`}>{idx + 1}</div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
            <selectedDisaster.icon size={120} className={`${selectedDisaster.color} absolute -right-6 -bottom-6 opacity-5`} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {DISASTERS.map((d) => (
            <div
              key={d.id}
              onClick={() => setSelectedDisaster(d)}
              className={`cursor-pointer p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border ${d.border} ${d.bg} flex flex-col items-center gap-3 sm:gap-4 hover:scale-105 active:scale-95 smooth-transition shadow-lg text-center`}
            >
              <div className={`p-3 sm:p-4 rounded-full bg-white/10 ${d.color}`}><d.icon size={26} /></div>
              <h3 className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-slate-800 dark:text-white">{d.title}</h3>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
