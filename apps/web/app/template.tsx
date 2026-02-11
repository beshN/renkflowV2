export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 w-full">
      {children}
    </div>
  );
}
