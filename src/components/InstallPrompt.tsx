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
    <div className="fixed bottom-24 left-4 right-4 z-40 bg-white border border-slate-200 rounded-xl p-4 shadow-lg max-w-lg mx-auto">
      <p className="text-slate-700 text-sm mb-2">
        Add to home screen for quick access and push reminders:
      </p>
      <p className="text-slate-500 text-xs mb-3">
        Safari → Share → Add to Home Screen
      </p>
      <div className="flex gap-2">
        <button
          onClick={dismiss}
          className="flex-1 py-2 text-slate-600 text-sm rounded-full border border-slate-300 hover:bg-slate-50"
        >
          Later
        </button>
        <button
          onClick={dismiss}
          className="flex-1 py-2 bg-violet-500 text-white text-sm font-medium rounded-full"
        >
          OK
        </button>
      </div>
    </div>
  );
}
