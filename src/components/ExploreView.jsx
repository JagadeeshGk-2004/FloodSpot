import { ShieldAlert, ExternalLink, Loader, Users, Wifi } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * ExploreView — Feed of flood reports + P2P mesh discovery indicator.
 */
export default function ExploreView({ reports, nearbySurvivors }) {
  return (
    <div className="space-y-6 sm:space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">

      {/* P2P MESH DISCOVERY INDICATOR */}
      <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[3rem] border border-[#A891DE]/30 flex items-center justify-between shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-3 sm:gap-4 relative z-10">
          <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center ${nearbySurvivors > 0 ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'bg-[#F3EFDF] dark:bg-white/10 text-[#9A8FB3] dark:text-white/30'}`}>
            {nearbySurvivors > 0 ? (
              <div className="relative">
                <Users size={20} />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
              </div>
            ) : (
              <Wifi size={20} />
            )}
          </div>
          <div>
            <h3 className="font-black text-xs sm:text-sm uppercase tracking-widest text-[#1a1410] dark:text-[#FFFFFF]">
              {nearbySurvivors > 0 ? `${nearbySurvivors} People detected nearby` : 'Scanning Mesh...'}
            </h3>
            <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1 ${nearbySurvivors > 0 ? 'text-green-600 dark:text-green-400' : 'text-[#9A8FB3] dark:text-white/40'}`}>
              {nearbySurvivors > 0 ? 'Local Mesh Active. You are not alone.' : 'Searching for nearby peers'}
            </p>
          </div>
        </div>
        {nearbySurvivors > 0 && <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 to-green-500/10 animate-pulse" />}
      </div>

      {/* REPORT CARDS */}
      {reports.length === 0 && (
        <div className="text-center py-16 opacity-50">
          <ShieldAlert size={48} className="mx-auto mb-4 text-[#A891DE]" />
          <p className="text-xs font-black uppercase tracking-widest">No reports yet</p>
          <p className="text-[10px] font-medium mt-1">Submit the first flood report for this area.</p>
        </div>
      )}

      {reports.map((r) => (
        <div key={r.id} className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 rounded-[1.5rem] sm:rounded-[3.5rem] overflow-hidden border border-[#D4CBAF] dark:border-[#A891DE]/30 shadow-xl smooth-transition">
          {r.photo_url ? (
            <img src={r.photo_url} className="w-full h-48 sm:h-84 object-cover" alt="flood intel" loading="lazy" />
          ) : (
            <div className="w-full h-36 sm:h-84 bg-[#F9F7F0] dark:bg-[#0A0A0A] flex flex-col items-center justify-center gap-3 border-b border-[#D4CBAF] dark:border-[#A891DE]/20">
              <div className="p-4 sm:p-6 rounded-full bg-[#F3EFDF] dark:bg-[#A891DE]/10 border border-[#D4CBAF] dark:border-[#A891DE]/30">
                <ShieldAlert className="text-[#A891DE]" size={28} />
              </div>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white/50 dark:text-[#A891DE]">Visual Intel Restricted</p>
            </div>
          )}
          <div className="p-5 sm:p-10 space-y-4 sm:space-y-6">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] sm:text-[10px] font-black uppercase text-[#A891DE]">Incident Sector</p>
                <h3 className="font-black text-lg sm:text-2xl tracking-tight text-[#1a1410] dark:text-[#FFFFFF] truncate">{r.place_name || "Unmapped"}</h3>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {r._isPending && (
                  <span className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-500 text-[8px] font-black uppercase tracking-widest">
                    <Loader size={9} className="animate-spin" /> Pending
                  </span>
                )}
                <span className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase ${r.severity === 'high' ? 'bg-red-600' : 'bg-[#A891DE]'} text-white shadow-lg`}>
                  {r.severity}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 sm:pt-6 border-t border-[#D4CBAF] dark:border-[#A891DE]/20">
              <p className="text-[9px] sm:text-[10px] font-bold text-[#1a1410] dark:text-[#D3C9F2] uppercase">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </p>
              <a
                href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] sm:text-[10px] font-black text-[#A891DE] flex items-center gap-2 uppercase hover:translate-x-1 smooth-transition"
              >
                <ExternalLink size={12} /> GPS Link
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
