import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  title?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const Card: React.FC<CardProps> = ({ title, badge, children, className, bodyClassName }) => {
  return (
    <div className={cn("bg-card border border-border-custom rounded-xl overflow-hidden", className)}>
      {title && (
        <div className="px-4.5 py-3.5 border-b border-border-custom flex items-center justify-between">
          <span className="font-display text-[15px] font-semibold text-wh tracking-[0.5px]">{title}</span>
          {badge}
        </div>
      )}
      <div className={cn("p-4.5", bodyClassName)}>
        {children}
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  delta: string;
  variant: 'c' | 'g' | 'o' | 'p';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, delta, variant }) => {
  const variantMap = {
    c: { border: 'bg-gradient-to-r from-transparent via-c1 to-transparent', text: 'text-c1 drop-shadow-[0_0_20px_rgba(0,229,255,0.3)]' },
    g: { border: 'bg-gradient-to-r from-transparent via-g1 to-transparent', text: 'text-g1 drop-shadow-[0_0_20px_rgba(0,255,157,0.3)]' },
    o: { border: 'bg-gradient-to-r from-transparent via-o1 to-transparent', text: 'text-o1 drop-shadow-[0_0_20px_rgba(255,107,0,0.3)]' },
    p: { border: 'bg-gradient-to-r from-transparent via-p2 to-transparent', text: 'text-p2 drop-shadow-[0_0_20px_rgba(168,85,247,0.3)]' },
  };

  return (
    <div className="bg-card border border-border-custom rounded-xl p-4 px-4.5 relative overflow-hidden">
      <div className={cn("absolute top-0 left-0 right-0 h-[1px]", variantMap[variant].border)} />
      <div className="font-mono text-[9px] text-t3 tracking-[2px] uppercase mb-1.5">{label}</div>
      <div className={cn("font-display text-[26px] font-bold leading-none", variantMap[variant].text)}>{value}</div>
      <div className={cn("text-[11px] mt-1 font-mono", delta.includes('↑') || delta.includes('+') ? 'text-g1' : 'text-r1')}>
        {delta}
      </div>
    </div>
  );
};
