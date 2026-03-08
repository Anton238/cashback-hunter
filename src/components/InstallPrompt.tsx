import { useState, useEffect } from 'react';

export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !isStandalone) {
      const dismissed = sessionStorage.getItem('install-prompt-dismissed');
      if (!dismissed) setShow(true);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('install-prompt-dismissed', '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 bg-slate-800 border border-slate-600 rounded-xl p-4 shadow-lg max-w-lg mx-auto">
      <p className="text-slate-200 text-sm mb-2">
        Add to home screen for quick access and push reminders:
      </p>
      <p className="text-slate-400 text-xs mb-3">
        Safari → Share → Add to Home Screen
      </p>
      <div className="flex gap-2">
        <button
          onClick={dismiss}
          className="flex-1 py-2 text-slate-400 text-sm rounded-lg border border-slate-600 hover:bg-slate-700"
        >
          Later
        </button>
        <button
          onClick={dismiss}
          className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg"
        >
          OK
        </button>
      </div>
    </div>
  );
}
