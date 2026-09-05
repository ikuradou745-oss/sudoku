import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { audio } from '../utils/audio';

interface UnderPreparationScreenProps {
  onCompleteToHome: () => void;
}

export function UnderPreparationScreen({ onCompleteToHome }: UnderPreparationScreenProps) {
  const [progress, setProgress] = useState<number>(20);

  useEffect(() => {
    const timer1 = setTimeout(() => setProgress(60), 400);
    const timer2 = setTimeout(() => setProgress(90), 900);
    const timer3 = setTimeout(() => {
      setProgress(100);
      audio.playEnergyGet();
      setTimeout(() => {
        onCompleteToHome();
      }, 500);
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onCompleteToHome]);

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <div 
        id="under-preparation-card"
        className="duo-card p-6 sm:p-8 text-center"
      >
        {/* Top Success Icon Badge */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] flex items-center justify-center text-white shadow-xs animate-bounce">
            <Sparkles className="w-8 h-8" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-[#3C3C3C] tracking-tight mb-2">
          準備完了！
        </h1>
        <p className="text-sm font-bold text-[#AFAFAF] mb-6">
          「うおリンゴ」へようこそ！ホーム画面へ移動します...
        </p>

        {/* Pop 3D Glossy Progress Bar */}
        <div className="w-full bg-[#E5E5E5] h-4 rounded-full overflow-hidden mb-6 p-0.5 relative">
          <div 
            className="h-full bg-[#58CC02] rounded-full relative transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          >
            {/* Glossy top highlight */}
            <div className="absolute top-0.5 left-2 right-2 h-1 bg-white/30 rounded-full"></div>
          </div>
        </div>

        {/* Manual Skip/Go Button */}
        <button
          id="go-to-home-button"
          onClick={() => {
            audio.playTap();
            onCompleteToHome();
          }}
          className="duo-btn duo-btn-green w-full h-12 rounded-2xl text-base font-black flex items-center justify-center gap-2"
        >
          <span>ホームへ進む</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
