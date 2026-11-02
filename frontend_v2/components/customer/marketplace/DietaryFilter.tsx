'use client';

import React from 'react';
import { Egg, Leaf, Wheat, X, Check } from 'lucide-react';

export interface DietaryFilterOption {
  id: 'EGGLESS' | 'VEGAN' | 'GLUTEN_FREE';
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  activeColor: string;
}

export const DIETARY_OPTIONS: DietaryFilterOption[] = [
  {
    id: 'EGGLESS',
    label: 'Eggless',
    shortLabel: 'Eggless',
    icon: <Egg className="w-3.5 h-3.5" />,
    activeColor: 'bg-emerald-700 text-white border-emerald-700 shadow-xs',
  },
  {
    id: 'VEGAN',
    label: 'Vegan',
    shortLabel: 'Vegan',
    icon: <Leaf className="w-3.5 h-3.5" />,
    activeColor: 'bg-green-700 text-white border-green-700 shadow-xs',
  },
  {
    id: 'GLUTEN_FREE',
    label: 'Gluten-Free',
    shortLabel: 'Gluten-Free',
    icon: <Wheat className="w-3.5 h-3.5" />,
    activeColor: 'bg-amber-700 text-white border-amber-700 shadow-xs',
  },
];

interface DietaryFilterProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  showTitle?: boolean;
}

export const DietaryFilter: React.FC<DietaryFilterProps> = ({
  selected,
  onChange,
  className = '',
  showTitle = true,
}) => {
  const normalizedSelected = React.useMemo(() => {
    return selected.map((s) => s.toUpperCase().replace('-', '_'));
  }, [selected]);

  const handleToggle = (optionId: 'EGGLESS' | 'VEGAN' | 'GLUTEN_FREE') => {
    if (normalizedSelected.includes(optionId)) {
      onChange(normalizedSelected.filter((id) => id !== optionId));
    } else {
      onChange([...normalizedSelected, optionId]);
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {showTitle && (
        <span className="text-xs font-bold text-brand-espresso flex items-center gap-1 mr-1">
          Dietary:
        </span>
      )}

      {DIETARY_OPTIONS.map((opt) => {
        const isSelected = normalizedSelected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleToggle(opt.id)}
            aria-pressed={isSelected}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${
              isSelected
                ? `${opt.activeColor} scale-102`
                : 'bg-white text-brand-espresso border-brand-border/80 hover:border-brand-plum hover:bg-brand-cream/40'
            }`}
          >
            <span className={isSelected ? 'text-white' : 'text-brand-plum'}>
              {opt.icon}
            </span>
            <span>{opt.label}</span>
            {isSelected && <Check className="w-3 h-3 ml-0.5 opacity-90" />}
          </button>
        );
      })}

      {normalizedSelected.length > 0 && (
        <button
          type="button"
          onClick={handleClearAll}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-brand-muted hover:text-brand-plum hover:bg-brand-blush/40 rounded-full transition-colors cursor-pointer"
          title="Clear dietary filters"
        >
          <X className="w-3 h-3" />
          <span>Clear ({normalizedSelected.length})</span>
        </button>
      )}
    </div>
  );
};

