import Image from 'next/image';

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="rf-panel flex min-w-[220px] flex-col items-center gap-4 px-7 py-6">
        <Image
          src="/email-assets/header-logo.png"
          alt="RenkFlow"
          width={442}
          height={88}
          className="h-8 w-auto object-contain"
          priority
        />
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500 animate-pulse">Yükleniyor...</p>
      </div>
    </div>
  );
}
