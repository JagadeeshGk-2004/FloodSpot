import { LayoutGrid, PlusCircle, BookOpen, Cloud, Route } from 'lucide-react';

/**
 * NavigationBar — Bottom navigation pill with 5 tabs.
 * Precision-aligned for Android mobile screens.
 */
export default function NavigationBar({ view, setView, fetchReports, requestLocation }) {
  const tabs = [
    { id: 'explore', icon: LayoutGrid, action: () => { fetchReports(); setView('explore'); } },
    { id: 'report', icon: PlusCircle, action: () => setView('report') },
    { id: 'handbook', icon: BookOpen, action: () => setView('handbook') },
    { id: 'weather', icon: Cloud, action: () => { requestLocation(); setView('weather'); } },
    { id: 'route', icon: Route, action: () => { requestLocation(); setView('route'); } },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom,6px)] px-4 sm:px-6" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
      <nav
        id="nav-pill"
        className="pointer-events-auto bg-white/95 dark:bg-[#0C0B09]/95 backdrop-blur-3xl rounded-full px-2 py-2 flex items-center border border-[#D4CBAF]/20 dark:border-[#A891DE]/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        style={{ gap: '2px' }}
      >
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = view === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-${tab.id}`}
              onClick={tab.action}
              className={`relative flex items-center justify-center rounded-full smooth-transition ${
                isActive
                  ? 'bg-[#A891DE] text-white shadow-[0_4px_15px_rgba(168,145,222,0.4)]'
                  : 'text-[#9A8FB3] dark:text-[#A891DE]/70 hover:text-[#A891DE] dark:hover:text-[#D3C9F2] hover:bg-[#A891DE]/5'
              }`}
              style={{
                width: '44px',
                height: '44px',
                minWidth: '44px',
                // No scale transform — prevents misalignment
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
