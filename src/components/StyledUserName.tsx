import { Sparkles } from 'lucide-react';
import { getTitle } from '../utils/titles';

interface StyledUserNameProps {
  name: string;
  titleId?: string;
  className?: string;
  showBadge?: boolean;
}

export function StyledUserName({
  name,
  titleId,
  className = '',
  showBadge = false,
}: StyledUserNameProps) {
  const title = getTitle(titleId);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {showBadge && title.id !== 'beginner' && (
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-md border font-black shrink-0 ${title.badgeClass}`}
        >
          {title.name}
        </span>
      )}
      <span
        style={title.textStyle}
        className={`${title.colorClass} truncate`}
      >
        {name}
      </span>
      {title.sparkle && (
        <Sparkles className="w-3.5 h-3.5 text-[#F59E0B] animate-pulse shrink-0" />
      )}
    </span>
  );
}
