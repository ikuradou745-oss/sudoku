import { useState, useEffect } from 'react';
import { CodeEntryGate } from './components/CodeEntryGate';
import { UnderPreparationScreen } from './components/UnderPreparationScreen';
import { checkExistingSession, clearGateSession } from './utils/security';

export function App() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  useEffect(() => {
    if (checkExistingSession()) {
      setIsUnlocked(true);
    }
  }, []);

  const handleUnlockSuccess = () => {
    setIsUnlocked(true);
  };

  const handleResetGate = () => {
    clearGateSession();
    setIsUnlocked(false);
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-4 selection:bg-[#58CC02] selection:text-white">
      {!isUnlocked ? (
        <CodeEntryGate onUnlockSuccess={handleUnlockSuccess} />
      ) : (
        <UnderPreparationScreen onRelock={handleResetGate} />
      )}
    </div>
  );
}

export default App;
