import Sidebar from './imports/Sidebar';
import Body from './imports/Body';

export default function App() {
  return (
    <div className="flex h-screen w-screen bg-[#f6f6f3] p-[16px] gap-[16px]">
      {/* Sidebar */}
      <div className="w-[288px] flex-shrink-0">
        <Sidebar />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Body />
      </div>
    </div>
  );
}
