import svgPaths from "./svg-yo31ufm6ef";
import imgRectangle1 from "figma:asset/d5b6bba6867cce143eb53d820b1f4e21c3ad2afe.png";

function Logomark() {
  return (
    <div className="h-[20.992px] relative shrink-0 w-[20.8px]" data-name="Logomark">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20.8 20.9919">
        <g clipPath="url(#clip0_1_855)" id="Logomark">
          <ellipse cx="10.4" cy="10.4959" fill="var(--fill-0, #FFA500)" id="Ellipse 1" rx="10.4" ry="10.4959" />
          <ellipse cx="7.06439" cy="6.10078" fill="url(#paint0_radial_1_855)" id="Ellipse 2" opacity="0.6" rx="7.06439" ry="6.10078" transform="matrix(0.834795 -0.550561 0.54352 0.839396 -3.02709 4.89663)" />
          <path d={svgPaths.p4f3b000} fill="var(--fill-0, #008000)" id="Union" />
        </g>
        <defs>
          <radialGradient cx="0" cy="0" gradientTransform="translate(7.06439 6.10078) rotate(90) scale(6.10078 7.06439)" gradientUnits="userSpaceOnUse" id="paint0_radial_1_855" r="1">
            <stop stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <clipPath id="clip0_1_855">
            <rect fill="white" height="20.9919" width="20.8" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function OrangeFarm() {
  return (
    <div className="absolute h-[19.239px] left-[0.98px] top-[3.74px] w-[117.98px]" data-name="OrangeFarm">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 117.98 19.2385">
        <g id="OrangeFarm">
          <path d={svgPaths.p2a050700} fill="var(--fill-0, #131313)" id="Vector" />
          <path d={svgPaths.p1a6c7200} fill="var(--fill-0, #131313)" id="Vector_2" />
          <path d={svgPaths.p1d599f00} fill="var(--fill-0, #131313)" id="Vector_3" />
          <path d={svgPaths.p100b4da0} fill="var(--fill-0, #131313)" id="Vector_4" />
          <path d={svgPaths.p2e3c1780} fill="var(--fill-0, #131313)" id="Vector_5" />
          <path d={svgPaths.p212ca5f0} fill="var(--fill-0, #131313)" id="Vector_6" />
          <path d={svgPaths.p3c8f9270} fill="var(--fill-0, #131313)" id="Vector_7" />
          <path d={svgPaths.p3f17cf40} fill="var(--fill-0, #131313)" id="Vector_8" />
          <path d={svgPaths.p317b8f00} fill="var(--fill-0, #131313)" id="Vector_9" />
          <path d={svgPaths.pc6bbd00} fill="var(--fill-0, #131313)" id="Vector_10" />
        </g>
      </svg>
    </div>
  );
}

function Frame2() {
  return (
    <div className="h-[24px] relative shrink-0 w-[121px]">
      <OrangeFarm />
    </div>
  );
}

function Logo() {
  return (
    <div className="content-stretch flex gap-[6.4px] h-[40px] items-center justify-center relative shrink-0" data-name="Logo">
      <Logomark />
      <Frame2 />
    </div>
  );
}

function CollapseIcon() {
  return (
    <div className="relative size-[12px]" data-name="Collapse icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="Collapse icon">
          <rect fill="var(--fill-0, #F7F6F3)" height="12" rx="4" width="12" />
          <path d="M3 4.5L6 7.5L9 4.5" id="Vector" stroke="var(--stroke-0, #454545)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Collapse() {
  return (
    <div className="-translate-y-1/2 absolute bg-[#f6f6f3] content-stretch flex items-center justify-center p-[4px] right-[-12px] rounded-[8px] size-[24px] top-[calc(50%+661px)]" data-name="Collapse">
      <div className="flex items-center justify-center relative shrink-0 size-[12px]" style={{ "--transform-inner-width": "1185", "--transform-inner-height": "153.5" } as React.CSSProperties}>
        <div className="flex-none rotate-90">
          <CollapseIcon />
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="relative shrink-0 w-full" data-name="Brand">
      <div className="flex flex-col justify-center size-full">
        <div className="content-stretch flex flex-col gap-[8px] items-start justify-center pb-[12px] pt-[16px] px-[24px] relative w-full">
          <Logo />
          <Collapse />
        </div>
      </div>
    </div>
  );
}

function IconFromTablerIo() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p26e8b180} id="Vector" stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Bar() {
  return (
    <div className="bg-white relative rounded-[20px] shrink-0 w-full" data-name="Bar">
      <div aria-hidden="true" className="absolute border border-[#f1f1f1] border-solid inset-0 pointer-events-none rounded-[20px]" />
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center px-[16px] py-[12px] relative w-full">
          <IconFromTablerIo />
          <p className="font-['Inter:Regular',sans-serif] font-normal leading-[14px] not-italic relative shrink-0 text-[#7d7d7d] text-[14px] tracking-[-0.25px]">Search</p>
        </div>
      </div>
    </div>
  );
}

function Search() {
  return (
    <div className="relative shrink-0 w-full" data-name="Search">
      <div className="content-stretch flex flex-col items-start pb-[12px] px-[12px] relative w-full">
        <Bar />
      </div>
    </div>
  );
}

function IconFromTablerIo1() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p2f0e5a00} id="Vector" stroke="var(--stroke-0, #FFA500)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function SidebarItem3() {
  return (
    <div className="max-w-[320px] min-w-[264px] relative rounded-[24px] shrink-0 w-full" data-name="Sidebar item 01">
      <div className="flex flex-row items-center max-w-[inherit] min-w-[inherit] size-full">
        <div className="content-stretch flex gap-[12px] items-center max-w-[inherit] min-w-[inherit] px-[20px] py-[12px] relative w-full">
          <IconFromTablerIo1 />
          <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[14px] min-h-px min-w-px not-italic relative text-[#131313] text-[14px] tracking-[-0.25px] whitespace-pre-wrap">Dashboard</p>
        </div>
      </div>
    </div>
  );
}

function IconFromTablerIo2() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.pb766f80} id="Vector" stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Closed() {
  return (
    <div className="absolute left-[228px] size-[16px] top-[12.5px]" data-name="Closed">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Closed">
          <path d="M4 6L8 10L12 6" id="Vector" stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function SidebarItem() {
  return (
    <div className="flex-[1_0_0] h-[41px] max-w-[320px] min-h-px min-w-[264px] relative rounded-[24px]" data-name="Sidebar item">
      <div className="flex flex-row items-center max-w-[inherit] min-w-[inherit] size-full">
        <div className="content-stretch flex gap-[12px] items-center max-w-[inherit] min-w-[inherit] px-[20px] py-[12px] relative size-full">
          <IconFromTablerIo2 />
          <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[14px] min-h-px min-w-px not-italic relative text-[#131313] text-[14px] tracking-[-0.25px] whitespace-pre-wrap">Customers</p>
          <Closed />
        </div>
      </div>
    </div>
  );
}

function SidebarNest() {
  return (
    <div className="content-stretch flex items-start min-w-[264px] relative shrink-0 w-full" data-name="Sidebar nest">
      <SidebarItem />
    </div>
  );
}

function IconFromTablerIo3() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.pf0b4c0} id="Vector" stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function SidebarItem4() {
  return (
    <div className="max-w-[320px] min-w-[264px] relative rounded-[24px] shrink-0 w-full" data-name="Sidebar item 02">
      <div className="flex flex-row items-center max-w-[inherit] min-w-[inherit] size-full">
        <div className="content-stretch flex gap-[12px] items-center max-w-[inherit] min-w-[inherit] px-[20px] py-[12px] relative w-full">
          <IconFromTablerIo3 />
          <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[14px] min-h-px min-w-px not-italic relative text-[#131313] text-[14px] tracking-[-0.25px] whitespace-pre-wrap">All reports</p>
        </div>
      </div>
    </div>
  );
}

function IconFromTablerIo4() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p1a6aed00} id="Vector" stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function SidebarItem5() {
  return (
    <div className="max-w-[320px] min-w-[264px] relative rounded-[24px] shrink-0 w-full" data-name="Sidebar item 03">
      <div className="flex flex-row items-center max-w-[inherit] min-w-[inherit] size-full">
        <div className="content-stretch flex gap-[12px] items-center max-w-[inherit] min-w-[inherit] px-[20px] py-[12px] relative w-full">
          <IconFromTablerIo4 />
          <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[14px] min-h-px min-w-px not-italic relative text-[#131313] text-[14px] tracking-[-0.25px] whitespace-pre-wrap">Geography</p>
        </div>
      </div>
    </div>
  );
}

function IconFromTablerIo5() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p4be6e00} id="Vector" stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function SidebarItem6() {
  return (
    <div className="max-w-[320px] min-w-[264px] relative rounded-[24px] shrink-0 w-full" data-name="Sidebar item 04">
      <div className="flex flex-row items-center max-w-[inherit] min-w-[inherit] size-full">
        <div className="content-stretch flex gap-[12px] items-center max-w-[inherit] min-w-[inherit] px-[20px] py-[12px] relative w-full">
          <IconFromTablerIo5 />
          <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[14px] min-h-px min-w-px not-italic relative text-[#131313] text-[14px] tracking-[-0.25px] whitespace-pre-wrap">Conversations</p>
        </div>
      </div>
    </div>
  );
}

function IconFromTablerIo6() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p2fbe7000} id="Vector" stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function SidebarItem7() {
  return (
    <div className="max-w-[320px] min-w-[264px] relative rounded-[24px] shrink-0 w-full" data-name="Sidebar item 06">
      <div className="flex flex-row items-center max-w-[inherit] min-w-[inherit] size-full">
        <div className="content-stretch flex gap-[12px] items-center max-w-[inherit] min-w-[inherit] px-[20px] py-[12px] relative w-full">
          <IconFromTablerIo6 />
          <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[14px] min-h-px min-w-px not-italic relative text-[#131313] text-[14px] tracking-[-0.25px] whitespace-pre-wrap">Deals</p>
        </div>
      </div>
    </div>
  );
}

function IconFromTablerIo7() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p119cfa80} id="Vector" stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function SidebarItem8() {
  return (
    <div className="max-w-[320px] min-w-[264px] relative rounded-[24px] shrink-0 w-full" data-name="Sidebar item 07">
      <div className="flex flex-row items-center max-w-[inherit] min-w-[inherit] size-full">
        <div className="content-stretch flex gap-[12px] items-center max-w-[inherit] min-w-[inherit] px-[20px] py-[12px] relative w-full">
          <IconFromTablerIo7 />
          <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[14px] min-h-px min-w-px not-italic relative text-[#131313] text-[14px] tracking-[-0.25px] whitespace-pre-wrap">Export</p>
        </div>
      </div>
    </div>
  );
}

function Items() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-full" data-name="Items">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[8px] items-start p-[8px] relative size-full">
          <Search />
          <SidebarItem3 />
          <SidebarNest />
          <SidebarItem4 />
          <SidebarItem5 />
          <SidebarItem6 />
          <SidebarItem7 />
          <SidebarItem8 />
        </div>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Avatar">
      <div className="absolute inset-0 rounded-[24px]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[24px]">
          <img alt="" className="absolute h-[218.75%] left-[-28.92%] max-w-none top-[-47.37%] w-[145.83%]" src={imgRectangle1} />
        </div>
      </div>
    </div>
  );
}

function Tag() {
  return (
    <div className="bg-[#ffcd71] content-stretch flex items-center justify-center px-[6px] relative rounded-[24px] shrink-0" data-name="Tag">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[16px] not-italic relative shrink-0 text-[#131313] text-[10px] tracking-[-0.5px]">Admin</p>
    </div>
  );
}

function Frame() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-start justify-center relative shrink-0">
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[normal] not-italic relative shrink-0 text-[#131313] text-[14px] tracking-[-0.25px]">Gustavo Xavier</p>
      <Tag />
    </div>
  );
}

function Info() {
  return (
    <div className="h-[40px] relative shrink-0 w-full" data-name="Info">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[12px] items-center px-[20px] relative size-full">
          <Avatar />
          <Frame />
        </div>
      </div>
    </div>
  );
}

function IconFromTablerIo8() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <g id="Vector">
            <path d={svgPaths.p7a4cef0} stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
            <path d={svgPaths.p19088900} stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function SidebarItem1() {
  return (
    <div className="max-w-[320px] min-w-[264px] relative rounded-[24px] shrink-0 w-full" data-name="Sidebar item">
      <div className="flex flex-row items-center max-w-[inherit] min-w-[inherit] size-full">
        <div className="content-stretch flex gap-[12px] items-center max-w-[inherit] min-w-[inherit] px-[20px] py-[12px] relative w-full">
          <IconFromTablerIo8 />
          <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[14px] min-h-px min-w-px not-italic relative text-[#131313] text-[14px] tracking-[-0.25px] whitespace-pre-wrap">Settings</p>
        </div>
      </div>
    </div>
  );
}

function IconFromTablerIo9() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p328be5b0} id="Vector" stroke="var(--stroke-0, #B01212)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function SidebarItem2() {
  return (
    <div className="max-w-[320px] min-w-[264px] relative rounded-[24px] shrink-0 w-full" data-name="Sidebar item">
      <div className="flex flex-row items-center max-w-[inherit] min-w-[inherit] size-full">
        <div className="content-stretch flex gap-[12px] items-center max-w-[inherit] min-w-[inherit] px-[20px] py-[12px] relative w-full">
          <IconFromTablerIo9 />
          <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[14px] min-h-px min-w-px not-italic relative text-[#b01212] text-[14px] tracking-[-0.25px] whitespace-pre-wrap">Log out</p>
        </div>
      </div>
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex flex-col gap-[2px] items-start justify-center relative shrink-0 w-full">
      <SidebarItem1 />
      <SidebarItem2 />
    </div>
  );
}

function User() {
  return (
    <div className="h-[180px] relative shrink-0 w-full" data-name="User">
      <div className="flex flex-col items-center justify-end size-full">
        <div className="content-stretch flex flex-col gap-[12px] items-center justify-end pb-[24px] pt-[16px] px-[8px] relative size-full">
          <Info />
          <Frame1 />
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <div className="bg-white content-stretch flex flex-col items-start relative rounded-[16px] size-full" data-name="Sidebar">
      <Brand />
      <Items />
      <User />
    </div>
  );
}