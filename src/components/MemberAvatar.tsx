import React from 'react';

interface MemberAvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-20 w-20 text-2xl',
  xl: 'h-24 w-24 text-3xl',
};

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  name,
  src,
  size = 'md',
}) => (
  <span
    className={`member-avatar inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 font-semibold text-blue-700 ring-1 ring-inset ring-blue-100 ${sizeClasses[size]}`}
  >
    {src ? (
      <img src={src} alt="" className="h-full w-full object-cover" />
    ) : (
      (name.trim().charAt(0).toLocaleUpperCase('vi') || '?')
    )}
  </span>
);
