import { Sparkles, Ruler, CheckCircle2 } from 'lucide-react';
import { Question } from '../types';

interface PencilHintProps {
  question: Question;
  onClose?: () => void;
}

export function PencilHintCard({ question }: PencilHintProps) {
  // Generate smart hint from question content
  let hintText = '';
  if (question.explanation) {
    hintText = question.explanation;
  } else if (question.type === 'order') {
    const words = question.english.split(' ');
    hintText = `出だしは「${words[0]}」から始まります。主語のあとに動詞「${words[1] || ''}」が続く構造です！`;
  } else if (question.type === 'blank') {
    hintText = `正解は「${question.correctAnswer}」です。空欄に入る品詞と主語・時制の一致に注目しましょう！`;
  } else {
    hintText = `日本語の意味「${question.japanese}」に対応する英文のキーフレーズを意識しましょう！`;
  }

  return (
    <div className="p-3.5 rounded-2xl bg-[#FFFDEB] border-2 border-[#FDE68A] text-left shadow-xs animate-in slide-in-from-top-2 duration-300 mb-3 relative overflow-hidden">
      {/* Decorative notebook lines */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg bg-[#FDE68A] flex items-center justify-center text-sm shadow-xs">
          ✏️
        </div>
        <div>
          <div className="text-xs font-black text-[#92400E] flex items-center gap-1">
            <span>えんぴつメモ・手書きヒント</span>
            <Sparkles className="w-3 h-3 text-[#D97706]" />
          </div>
          <div className="text-[10px] font-bold text-[#B45309]">
            えんぴつが答えのコツを書き残してくれました！
          </div>
        </div>
      </div>

      <div className="p-2.5 rounded-xl bg-white/80 border border-[#FDE68A] text-xs font-bold text-[#78350F] leading-relaxed font-mono">
        ✍️ {hintText}
      </div>
    </div>
  );
}

interface MarkerOverlayProps {
  onDismiss: () => void;
}

export function MarkerOverlay({ onDismiss }: MarkerOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl border-4 border-[#FDE047] p-5 shadow-2xl text-center space-y-3 relative overflow-hidden">
        {/* Fluorescent Marker Scribble Background */}
        <div className="absolute -inset-2 bg-gradient-to-r from-[#FEF08A]/30 via-[#FDE047]/40 to-[#FEF08A]/30 rotate-6 pointer-events-none" />

        <div className="w-16 h-16 rounded-3xl bg-[#FEF08A] border-2 border-[#EAB308] text-4xl flex items-center justify-center mx-auto shadow-md animate-bounce relative z-10">
          🖊️
        </div>

        <div className="relative z-10">
          <div className="inline-block px-3 py-1 rounded-full bg-[#FEF08A] text-[#854D0E] text-[11px] font-black mb-1.5 border border-[#FACC15]">
            マーカーペン発動！
          </div>
          <h3 className="text-xl font-black text-[#3C3C3C]">
            ミスを落書きして帳消し！
          </h3>
          <p className="text-xs font-bold text-[#777777] mt-1 leading-relaxed">
            マーカーペンが問題を上書きしました！<br />
            ライフを減らさずに、<span className="text-[#854D0E] font-black">もう一度同じ問題に挑戦</span>できます！
          </p>
        </div>

        <div className="pt-2 relative z-10">
          <button
            type="button"
            onClick={onDismiss}
            className="duo-btn duo-btn-green w-full py-3.5 rounded-2xl text-sm font-black cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>もう一度解き直す</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface RulerGuideProps {
  question: Question;
}

export function RulerGuideCard({ question }: RulerGuideProps) {
  // Format character count markers
  let guideRepresentation = '';
  if (question.type === 'order') {
    const words = question.english.split(' ');
    // Each word replaced with '〇' repeated for word length
    guideRepresentation = words.map((w) => '〇'.repeat(w.replace(/[^a-zA-Z]/g, '').length)).join(' ');
  } else {
    // For choice/blank: correct answer length
    const answerWord = question.correctAnswer.replace(/[^a-zA-Z]/g, '');
    guideRepresentation = '〇'.repeat(answerWord.length);
  }

  return (
    <div className="p-3 rounded-2xl bg-[#F0FDF4] border-2 border-[#BBF7D0] text-left shadow-xs animate-in slide-in-from-top-2 duration-300 mb-3 overflow-hidden relative">
      {/* Ruler graphic header with centimeter notches */}
      <div className="flex items-center justify-between border-b-2 border-dashed border-[#86EFAC] pb-1.5 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-black text-[#15803D]">
          <Ruler className="w-4 h-4 text-[#16A34A]" />
          <span>ものさし計測ガイド (定規で文字数を計測)</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[9px] text-[#16A34A]">
          <span>|'''|'''|'''|'''|'''|</span>
          <span className="font-bold">cm</span>
        </div>
      </div>

      <div className="text-xs text-[#166534] font-bold">
        {question.type === 'order' ? (
          <div>
            <span className="text-[11px] text-[#15803D] block mb-1">
              各単語の文字数枠 (〇の数 = 単語のアルファベット数):
            </span>
            <div className="p-2 rounded-xl bg-white border border-[#BBF7D0] font-mono text-sm tracking-wider font-black text-[#15803D] select-none break-all">
              {guideRepresentation}
            </div>
          </div>
        ) : (
          <div>
            <span className="text-[11px] text-[#15803D] block mb-1">
              空欄に入る正解の文字数:
            </span>
            <div className="p-2 rounded-xl bg-white border border-[#BBF7D0] font-mono text-base tracking-widest font-black text-[#15803D] select-none flex items-center gap-2">
              <span>{guideRepresentation}</span>
              <span className="text-xs font-bold text-[#16A34A]">
                ({guideRepresentation.length}文字)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
