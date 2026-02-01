// Local Avatar Component - Fallback for external services
'use client';

interface AvatarProps {
  name?: string;
  src?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name = 'User', src, size = 40, className = '' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    { bg: 'bg-blue-600', text: 'text-white' },
    { bg: 'bg-purple-600', text: 'text-white' },
    { bg: 'bg-green-600', text: 'text-white' },
    { bg: 'bg-orange-600', text: 'text-white' },
    { bg: 'bg-pink-600', text: 'text-white' },
  ];

  // Generate consistent color based on name
  const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  const { bg, text } = colors[colorIndex];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
        onError={(e) => {
          // Fallback to initials if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          if (target.nextElementSibling) {
            (target.nextElementSibling as HTMLElement).style.display = 'flex';
          }
        }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold ${bg} ${text} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}
