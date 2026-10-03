import { useState, useEffect } from 'react';
import { Trophy, Flame, X, Crown, ArrowRight, ShieldAlert } from 'lucide-react';
import { RankingRecord, UserStats } from '../types';
import { fetchTop5Rankings } from '../utils/ranking';
import { audio } from '../utils/audio';

interface RankingModalProps {
  stats: UserStats;
  onStartRanking: () => void;
  onClose: () => void;
}

export function RankingModal({ stats, onStartRanking, onClose }: RankingModalProps) {
  const [rankings, setRankings] = useState<RankingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchTop5Rankings()
      .then((res) => {
        setRankings(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const hasUnlocked5000Pencil = stats.unlockedGoods?.includes('pencil_5000yen');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div 
        id="ranking-modal"
        className="duo-card w-full max-w-md p-6 bg-white relative my-auto shadow-2xl border-4 border-[#FFD966]"
      >
        {/* Close Button */}
        <button
          onClick={() => {
            audio.playTap();
            onClose();
          }}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#F7F7F7] hover:bg-[#EBEBEB] text-[#777777] hover:text-[#3C3C3C] border border-[#E5E5E5] flex items-center justify-center cursor-pointer transition-all active:scale-95"
          title="閉じる"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF9E6] border border-[#FFD966] text-[#A57800] text-xs font-black mb-2 shadow-2xs">
            <Trophy className="w-3.5 h-3.5 text-[#FF9600]" />
            <span>エンドレス正解レース</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#3C3C3C] flex items-center justify-center gap-2">
            <span>🏆 ランキング TOP 5</span>
          </h2>
          <p className="text-xs font-bold text-[#777777] mt-1">
            ライフ1・復活不可の真剣勝負！ひたすら解いて1位を目指せ！
          </p>
        </div>

        {/* 1位達成報酬: 5000円鉛筆 Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#FFFBEB] via-[#FFFDF5] to-[#ECFEFF] border-2 border-[#FFD966] mb-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFD966] to-[#F59E0B] text-white flex items-center justify-center text-2xl shrink-0 shadow-xs">
              💎✏️
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black bg-[#EA580C] text-white px-2 py-0.5 rounded-full shadow-2xs">
                  1位限定報酬
                </span>
                <span className="text-sm font-black text-[#3C3C3C]">
                  5000円鉛筆
                </span>
                {hasUnlocked5000Pencil && (
                  <span className="text-[10px] font-black bg-[#58CC02] text-white px-1.5 py-0.5 rounded-md">
                    獲得済み!
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-[#78350F] mt-0.5 leading-snug">
                1問正解ごとに+20%チャージ！100%で必殺技<strong>「高精度鉛筆」</strong>発動（不正解を❌消去・点繋ぎ接続・並べ替え残り2つ）！
              </p>
            </div>
          </div>
        </div>

        {/* TOP 5 List */}
        <div className="space-y-2 mb-5">
          <div className="text-xs font-black text-[#777777] flex items-center justify-between px-2">
            <span>順位 / プレイヤー</span>
            <span>連続正解記録</span>
          </div>

          {loading ? (
            <div className="p-6 text-center text-xs font-bold text-[#AFAFAF]">
              ランキング読み込み中...
            </div>
          ) : rankings.length === 0 ? (
            <div className="p-6 text-center text-xs font-bold text-[#AFAFAF]">
              まだ記録がありません。あなたが最初の1位になりましょう！
            </div>
          ) : (
            rankings.map((r, idx) => {
              const isFirst = idx === 0;
              const isSecond = idx === 1;
              const isThird = idx === 2;

              let rankBadge = `${idx + 1}位`;
              let badgeColor = 'bg-[#F0F0F0] text-[#777777] border-[#E5E5E5]';
              let rowBg = 'bg-[#FFFFFF] border-[#E5E5E5]';

              if (isFirst) {
                rankBadge = '🥇 1位';
                badgeColor = 'bg-[#FFD966] text-[#78350F] border-[#F59E0B] shadow-2xs';
                rowBg = 'bg-gradient-to-r from-[#FFFBEB] to-[#FFFDF5] border-[#FFD966]';
              } else if (isSecond) {
                rankBadge = '🥈 2位';
                badgeColor = 'bg-[#E2E8F0] text-[#334155] border-[#CBD5E1]';
                rowBg = 'bg-[#F8FAFC] border-[#E2E8F0]';
              } else if (isThird) {
                rankBadge = '🥉 3位';
                badgeColor = 'bg-[#FED7AA] text-[#9A3412] border-[#FDBA74]';
                rowBg = 'bg-[#FFFDF9] border-[#FED7AA]';
              }

              const isMe = r.userId === stats.userId;

              return (
                <div
                  key={r.id || idx}
                  className={`flex items-center justify-between p-2.5 rounded-xl border-2 transition-all ${rowBg} ${
                    isMe ? 'ring-2 ring-[#58CC02]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${badgeColor} shrink-0`}>
                      {rankBadge}
                    </span>
                    <span className="text-xs font-black text-[#3C3C3C] truncate">
                      {r.userName}
                      {isMe && <span className="ml-1 text-[10px] text-[#58CC02]">(あなた)</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Flame className="w-4 h-4 text-[#F97316] fill-[#F97316]" />
                    <span className="text-base font-black text-[#EA580C] font-mono">
                      {r.score}
                    </span>
                    <span className="text-[11px] font-bold text-[#777777]">問正解</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            audio.playTap();
            onClose();
            onStartRanking();
          }}
          className="duo-btn duo-btn-red w-full py-3.5 px-4 rounded-2xl text-base font-black flex items-center justify-center gap-2 shadow-md cursor-pointer group"
        >
          <Crown className="w-5 h-5 text-white" />
          <span>ランキングに挑戦する（ライフ1）🔥</span>
          <ArrowRight className="w-4 h-4 text-white transform group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="text-[11px] font-bold text-[#AFAFAF] text-center mt-2.5 flex items-center justify-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-[#FF4B4B]" />
          <span>間違えた時点で終了・復活不可のランキング測定です</span>
        </p>
      </div>
    </div>
  );
}
