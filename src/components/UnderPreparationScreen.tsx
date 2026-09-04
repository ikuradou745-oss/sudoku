import { RotateCcw, Sparkles } from 'lucide-react';

interface UnderPreparationScreenProps {
  onRelock: () => void;
}

export function UnderPreparationScreen({ onRelock }: UnderPreparationScreenProps) {
  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Main Clean Pop Card */}
      <div 
        id="under-preparation-card"
        className="duo-card p-6 sm:p-8 text-center"
      >
        {/* Top Success Icon Badge */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-8 h-8" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-[#3C3C3C] tracking-tight mb-2">
          準備中...
        </h1>
        <p className="text-sm font-bold text-[#AFAFAF] mb-6">
          コード認証に成功しました。コンテンツを準備しています。
        </p>

        {/* Pop 3D Glossy Progress Bar */}
        <div className="w-full bg-[#E5E5E5] h-4 rounded-full overflow-hidden mb-6 p-0.5 relative">
          <div 
            className="h-full bg-[#58CC02] rounded-full relative"
            style={{ width: '85%' }}
          >
            {/* Glossy top highlight */}
            <div className="absolute top-0.5 left-2 right-2 h-1 bg-white/30 rounded-full"></div>
          </div>
        </div>

        {/* Back / Relock Button */}
        <button
          id="relock-button"
          onClick={onRelock}
          className="duo-btn duo-btn-gray w-full h-12 rounded-2xl text-sm font-black flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4 text-[#AFAFAF]" />
          <span>最初に戻る</span>
        </button>
      </div>
    </div>
  );
}
