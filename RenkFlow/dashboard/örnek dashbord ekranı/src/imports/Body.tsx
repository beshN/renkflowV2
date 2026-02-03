import svgPaths from "./svg-lgfl7djgye";
import imgRectangle1 from "figma:asset/6f285f85f99be56c6c5213eed85abb29135121ac.png";
import imgRectangle2 from "figma:asset/07134d98838509f53aef9aab726701f4f8469454.png";
import imgRectangle3 from "figma:asset/13f0f0f82f07420bd0d1112b8f005ee5ed21afd3.png";
import imgRectangle4 from "figma:asset/d4f901a4ec5d438b291d2222533724bc2492e227.png";
import imgRectangle5 from "figma:asset/35c5c692e8754e1cbd192847ac022e1ab9863667.png";
import imgRectangle6 from "figma:asset/1bfac056a5e2d81fdba7c3952411444c90b8323d.png";
import imgRectangle7 from "figma:asset/4f95f6a0c198aa597b4c24e90e737f2f2be67ee6.png";

function Heading() {
  return (
    <div className="content-stretch flex items-start pb-[16px] relative shrink-0 w-full" data-name="Heading">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[#131313] text-[20px] tracking-[-0.2px]">Revenues</p>
    </div>
  );
}

function IconFromTablerIo() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p3b051400} id="Vector" stroke="var(--stroke-0, #25CD25)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function BigNumber() {
  return (
    <div className="content-stretch flex gap-[8px] items-baseline relative shrink-0" data-name="Big number">
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[normal] not-italic relative shrink-0 text-[#131313] text-[48px] tracking-[-2px]">15%</p>
      <IconFromTablerIo />
    </div>
  );
}

function IconFromTablerIo1() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.pb799a80} id="Vector" stroke="var(--stroke-0, #734A00)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Frame4() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">Revenues report</p>
      <IconFromTablerIo1 />
    </div>
  );
}

function Frame3() {
  return (
    <div className="content-stretch flex flex-[1_0_0] items-end min-h-px min-w-px pt-[16px] relative">
      <Frame4 />
    </div>
  );
}

function Widget() {
  return (
    <div className="bg-white flex-[1_0_0] h-full min-h-[200px] min-w-[320px] relative rounded-[16px]" data-name="Widget">
      <div className="min-h-[inherit] min-w-[inherit] overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[8px] items-start min-h-[inherit] min-w-[inherit] p-[24px] relative size-full">
          <Heading />
          <BigNumber />
          <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#454545] text-[14px] tracking-[-0.3px]">Increase compared to last week</p>
          <Frame3 />
        </div>
      </div>
    </div>
  );
}

function Heading1() {
  return (
    <div className="content-stretch flex items-start pb-[16px] relative shrink-0 w-full" data-name="Heading">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[#131313] text-[20px] tracking-[-0.2px]">Lost deals</p>
    </div>
  );
}

function BigNumber1() {
  return (
    <div className="content-stretch flex items-baseline relative shrink-0" data-name="Big number">
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[normal] not-italic relative shrink-0 text-[#131313] text-[48px] tracking-[-2px]">4%</p>
    </div>
  );
}

function IconFromTablerIo2() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.pb799a80} id="Vector" stroke="var(--stroke-0, #734A00)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Frame6() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">All deals</p>
      <IconFromTablerIo2 />
    </div>
  );
}

function Frame5() {
  return (
    <div className="content-stretch flex flex-[1_0_0] items-end min-h-px min-w-px pt-[16px] relative">
      <Frame6 />
    </div>
  );
}

function Widget1() {
  return (
    <div className="bg-white flex-[1_0_0] h-full min-h-[200px] min-w-[320px] relative rounded-[16px]" data-name="Widget">
      <div className="min-h-[inherit] min-w-[inherit] overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[8px] items-start min-h-[inherit] min-w-[inherit] p-[24px] relative size-full">
          <Heading1 />
          <BigNumber1 />
          <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#454545] text-[14px] tracking-[-0.3px]">You closed 96 out of 100 deals</p>
          <Frame5 />
        </div>
      </div>
    </div>
  );
}

function Heading2() {
  return (
    <div className="content-stretch flex items-start justify-center pb-[16px] relative shrink-0 w-full" data-name="Heading">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[#131313] text-[20px] tracking-[-0.2px]">Quarter goal</p>
    </div>
  );
}

function Frame8() {
  return (
    <div className="h-[102px] relative shrink-0 w-[210.12px]">
      <div className="absolute h-[102px] left-0 top-0 w-[209.389px]">
        <div className="absolute inset-[0_0.16%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 208.738 102">
            <path d={svgPaths.p2d1adf00} fill="var(--fill-0, #FFF7E8)" id="Ellipse 3" />
          </svg>
        </div>
      </div>
      <div className="absolute h-[69.824px] left-0 top-[32.18px] w-[40.586px]">
        <div className="absolute inset-[0_0_0_0.8%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 40.2615 69.8238">
            <path d={svgPaths.p2623a9c0} fill="var(--fill-0, #D9D9D9)" id="Ellipse 4" />
          </svg>
        </div>
      </div>
      <div className="absolute h-[102px] left-0 top-0 w-[189.394px]">
        <div className="absolute inset-[0_1.84%_0_0.17%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 185.581 102">
            <path d={svgPaths.p17927880} fill="var(--fill-0, #FFCD71)" id="Ellipse 5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 absolute bottom-[19.5px] flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] left-[calc(50%+0.5px)] not-italic text-[#131313] text-[32px] text-center tracking-[-1.5922px] translate-y-1/2 whitespace-nowrap">
        <p className="leading-[normal]">84%</p>
      </div>
    </div>
  );
}

function Frame7() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0 w-full">
      <Frame8 />
    </div>
  );
}

function IconFromTablerIo3() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.pb799a80} id="Vector" stroke="var(--stroke-0, #734A00)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Frame9() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">All goals</p>
      <IconFromTablerIo3 />
    </div>
  );
}

function Frame() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center justify-end min-h-px min-w-px pt-[12px] relative">
      <Frame9 />
    </div>
  );
}

function Widget2() {
  return (
    <div className="bg-white content-stretch flex flex-col gap-[8px] h-full items-center min-h-[200px] min-w-[260px] overflow-clip p-[24px] relative rounded-[16px] shrink-0" data-name="Widget">
      <Heading2 />
      <Frame7 />
      <Frame />
    </div>
  );
}

function Row() {
  return (
    <div className="content-stretch flex gap-[16px] h-[261.612px] items-start relative shrink-0 w-full" data-name="Row">
      <Widget />
      <Widget1 />
      <Widget2 />
    </div>
  );
}

function IconFromTablerIo4() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon (from Tabler.io)">
          <path d="M3.5 5.25L7 8.75L10.5 5.25" id="Vector" stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Frame10() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[0] not-italic relative shrink-0 text-[#454545] text-[14px] tracking-[-0.3px]">
        <span className="leading-[normal]">{`Sort by `}</span>
        <span className="font-['Inter:Medium',sans-serif] font-medium leading-[normal]">Newest</span>
      </p>
      <IconFromTablerIo4 />
    </div>
  );
}

function Heading3() {
  return (
    <div className="relative shrink-0 w-full" data-name="Heading">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between px-[24px] relative w-full">
          <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[#131313] text-[20px] tracking-[-0.2px]">Customers</p>
          <Frame10 />
        </div>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Avatar">
      <div className="absolute inset-0 rounded-[24px]">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[24px] size-full" src={imgRectangle1} />
      </div>
    </div>
  );
}

function Frame11() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[2px] items-start justify-center leading-[normal] min-h-px min-w-px not-italic relative tracking-[-0.3px]">
      <p className="font-['Inter:Medium',sans-serif] font-medium relative shrink-0 text-[#131313] text-[14px]">Chris Friedkly</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal relative shrink-0 text-[#454545] text-[12px]">Supermarket Villanova</p>
    </div>
  );
}

function Customer() {
  return (
    <div className="relative rounded-[16px] shrink-0 w-full" data-name="Customer">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[12px] items-center p-[16px] relative w-full">
          <Avatar />
          <Frame11 />
        </div>
      </div>
    </div>
  );
}

function Avatar1() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Avatar">
      <div className="absolute inset-0 rounded-[24px]">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[24px] size-full" src={imgRectangle2} />
      </div>
    </div>
  );
}

function Frame12() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[2px] items-start justify-center leading-[normal] min-h-px min-w-px not-italic relative tracking-[-0.3px]">
      <p className="font-['Inter:Medium',sans-serif] font-medium relative shrink-0 text-[#131313] text-[14px]">Maggie Johnson</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal relative shrink-0 text-[#454545] text-[12px]">Oasis Organic Inc.</p>
    </div>
  );
}

function IconFromTablerIo5() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p4be6e00} id="Vector" stroke="var(--stroke-0, #734A00)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Frame15() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 size-[36px]">
      <IconFromTablerIo5 />
    </div>
  );
}

function IconFromTablerIo6() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p3fed2c00} id="Vector" stroke="var(--stroke-0, #734A00)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Frame16() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 size-[36px]">
      <IconFromTablerIo6 />
    </div>
  );
}

function IconFromTablerIo7() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p113d0300} id="Vector" stroke="var(--stroke-0, #734A00)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Frame17() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 size-[36px]">
      <IconFromTablerIo7 />
    </div>
  );
}

function Frame14() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0">
      <Frame15 />
      <Frame16 />
      <Frame17 />
    </div>
  );
}

function IconFromTablerIo8() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon (from Tabler.io)">
          <g id="Vector">
            <path d={svgPaths.p2544f280} fill="var(--fill-0, #131313)" />
            <path d={svgPaths.pb861900} fill="var(--fill-0, #131313)" />
            <path d={svgPaths.p8fc5580} fill="var(--fill-0, #131313)" />
            <path d={svgPaths.p2544f280} stroke="var(--stroke-0, #734A00)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
            <path d={svgPaths.pb861900} stroke="var(--stroke-0, #734A00)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
            <path d={svgPaths.p8fc5580} stroke="var(--stroke-0, #734A00)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Frame18() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 size-[36px]">
      <IconFromTablerIo8 />
    </div>
  );
}

function Frame13() {
  return (
    <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
      <Frame14 />
      <div className="flex h-[24px] items-center justify-center relative shrink-0 w-0" style={{ "--transform-inner-width": "1185", "--transform-inner-height": "153.5" } as React.CSSProperties}>
        <div className="flex-none rotate-90">
          <div className="h-0 relative w-[24px]">
            <div className="absolute inset-[-1px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 1">
                <line id="Line 2" opacity="0.2" stroke="var(--stroke-0, #734A00)" x2="24" y1="0.5" y2="0.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <Frame18 />
    </div>
  );
}

function Customer1() {
  return (
    <div className="bg-[#fff7e8] relative rounded-[16px] shrink-0 w-full" data-name="Customer">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[12px] items-center p-[16px] relative w-full">
          <Avatar1 />
          <Frame12 />
          <Frame13 />
        </div>
      </div>
    </div>
  );
}

function Avatar2() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Avatar">
      <div className="absolute inset-0 rounded-[24px]">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[24px] size-full" src={imgRectangle3} />
      </div>
    </div>
  );
}

function Frame19() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[2px] items-start justify-center leading-[normal] min-h-px min-w-px not-italic relative tracking-[-0.3px]">
      <p className="font-['Inter:Medium',sans-serif] font-medium relative shrink-0 text-[#131313] text-[14px]">Gael Harry</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal relative shrink-0 text-[#454545] text-[12px]">New York Finest Fruits</p>
    </div>
  );
}

function Customer2() {
  return (
    <div className="relative rounded-[16px] shrink-0 w-full" data-name="Customer">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[12px] items-center p-[16px] relative w-full">
          <Avatar2 />
          <Frame19 />
        </div>
      </div>
    </div>
  );
}

function Avatar3() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Avatar">
      <div className="absolute inset-0 rounded-[24px]">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[24px] size-full" src={imgRectangle4} />
      </div>
    </div>
  );
}

function Frame20() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[2px] items-start justify-center leading-[normal] min-h-px min-w-px not-italic relative tracking-[-0.3px]">
      <p className="font-['Inter:Medium',sans-serif] font-medium relative shrink-0 text-[#131313] text-[14px]">Jenna Sullivan</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal relative shrink-0 text-[#454545] text-[12px]">Walmart</p>
    </div>
  );
}

function Customer3() {
  return (
    <div className="relative rounded-[16px] shrink-0 w-full" data-name="Customer">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[12px] items-center p-[16px] relative w-full">
          <Avatar3 />
          <Frame20 />
        </div>
      </div>
    </div>
  );
}

function List() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-full" data-name="List">
      <div className="overflow-x-clip overflow-y-auto size-full">
        <div className="content-stretch flex flex-col items-start px-[8px] relative size-full">
          <Customer />
          <Customer1 />
          <Customer2 />
          <Customer3 />
        </div>
      </div>
    </div>
  );
}

function IconFromTablerIo9() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.pb799a80} id="Vector" stroke="var(--stroke-0, #734A00)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Frame21() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">All customers</p>
      <IconFromTablerIo9 />
    </div>
  );
}

function Button() {
  return (
    <div className="relative shrink-0 w-full" data-name="Button">
      <div className="flex flex-row items-end size-full">
        <div className="content-stretch flex items-end px-[24px] relative w-full">
          <Frame21 />
        </div>
      </div>
    </div>
  );
}

function Widget3() {
  return (
    <div className="bg-white content-stretch flex flex-[1_0_0] flex-col gap-[16px] h-[400px] items-start min-h-[400px] min-w-px overflow-clip py-[24px] relative rounded-[16px]" data-name="Widget">
      <Heading3 />
      <List />
      <Button />
    </div>
  );
}

function IconFromTablerIo10() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon (from Tabler.io)">
          <path d="M3.5 5.25L7 8.75L10.5 5.25" id="Vector" stroke="var(--stroke-0, #7D7D7D)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Frame22() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#454545] text-[14px] tracking-[-0.3px]">Yearly</p>
      <IconFromTablerIo10 />
    </div>
  );
}

function Heading4() {
  return (
    <div className="content-stretch flex items-center justify-between pb-[16px] relative shrink-0 w-full" data-name="Heading">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[#131313] text-[20px] tracking-[-0.2px]">Growth</p>
      <Frame22 />
    </div>
  );
}

function MaskGroup() {
  return (
    <div className="absolute h-[128px] left-[57px] top-[0.39px] w-[405px] z-[3]" data-name="Mask group">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 405 128">
        <g id="Mask group">
          <mask height="128" id="mask0_1_805" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="405" x="0" y="0">
            <rect fill="var(--fill-0, #D9D9D9)" height="128" id="Rectangle 2" width="405" />
          </mask>
          <g mask="url(#mask0_1_805)">
            <path d={svgPaths.p3515cb80} fill="url(#paint0_linear_1_805)" id="Vector 1" stroke="var(--stroke-0, #25CD25)" strokeDasharray="2 2" />
          </g>
        </g>
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_1_805" x1="202.25" x2="202.25" y1="7" y2="129">
            <stop stopColor="#25CD25" stopOpacity="0.4" />
            <stop offset="1" stopColor="#25CD25" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function Frame24() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
      <p className="font-['Inter:Medium',sans-serif] font-medium h-[15px] leading-[normal] not-italic relative shrink-0 text-[#7d7d7d] text-[10px] tracking-[-0.3px] w-[27px] whitespace-pre-wrap">100k</p>
      <div className="-translate-y-1/2 absolute h-0 left-[43px] top-[calc(50%-0.11px)] w-[419.5px]">
        <div className="absolute inset-[-0.5px_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 419.5 1">
            <path d="M0 0.5L419.5 0.5" id="Line 3" stroke="var(--stroke-0, #F1F1F1)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
      <p className="flex-[1_0_0] font-['Inter:Medium',sans-serif] font-medium h-[15px] leading-[normal] min-h-px min-w-px not-italic relative text-[#7d7d7d] text-[10px] tracking-[-0.3px] whitespace-pre-wrap">50k</p>
      <div className="-translate-y-1/2 absolute h-0 left-[43px] top-[calc(50%-0.36px)] w-[419.5px]">
        <div className="absolute inset-[-0.5px_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 419.5 1">
            <path d="M0 0.5L419.5 0.5" id="Line 3" stroke="var(--stroke-0, #F1F1F1)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame2() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
      <p className="flex-[1_0_0] font-['Inter:Medium',sans-serif] font-medium h-[15px] leading-[normal] min-h-px min-w-px not-italic relative text-[#7d7d7d] text-[10px] tracking-[-0.3px] whitespace-pre-wrap">20k</p>
      <div className="-translate-y-1/2 absolute h-0 left-[43px] top-[calc(50%+0.39px)] w-[419.5px]">
        <div className="absolute inset-[-0.5px_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 419.5 1">
            <path d="M0 0.5L419.5 0.5" id="Line 3" stroke="var(--stroke-0, #F1F1F1)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame23() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
      <p className="flex-[1_0_0] font-['Inter:Medium',sans-serif] font-medium h-[15px] leading-[normal] min-h-px min-w-px not-italic relative text-[#7d7d7d] text-[10px] tracking-[-0.3px] whitespace-pre-wrap">10k</p>
      <div className="-translate-y-1/2 absolute h-0 left-[43px] top-[calc(50%+0.14px)] w-[419.5px]">
        <div className="absolute inset-[-0.5px_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 419.5 1">
            <path d="M0 0.5L419.5 0.5" id="Line 3" stroke="var(--stroke-0, #F1F1F1)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame25() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
      <p className="flex-[1_0_0] font-['Inter:Medium',sans-serif] font-medium h-[15px] leading-[normal] min-h-px min-w-px not-italic relative text-[#7d7d7d] text-[10px] tracking-[-0.3px] whitespace-pre-wrap">0</p>
      <div className="-translate-y-1/2 absolute h-0 left-[43px] top-[calc(50%-0.11px)] w-[420.13px]">
        <div className="absolute inset-[-0.5px_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 420.13 1">
            <path d="M0 0.5L420.13 0.5" id="Line 3" stroke="var(--stroke-0, #F1F1F1)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Numbers() {
  return (
    <div className="content-stretch flex flex-col h-[137px] items-center justify-between relative shrink-0 z-[2]" data-name="Numbers">
      <Frame24 />
      <Frame1 />
      <Frame2 />
      <Frame23 />
      <Frame25 />
    </div>
  );
}

function Frame26() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] h-[160px] items-center relative shrink-0">
      <div className="flex flex-[1_0_0] items-center justify-center min-h-px min-w-px relative w-0" style={{ "--transform-inner-width": "1185", "--transform-inner-height": "153.5" } as React.CSSProperties}>
        <div className="-rotate-90 flex-none h-full">
          <div className="h-full relative w-[129px]">
            <div className="absolute inset-[-1px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 129 1">
                <line id="Line 3" stroke="var(--stroke-0, #F1F1F1)" x2="129" y1="0.5" y2="0.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#7d7d7d] text-[10px] text-center tracking-[-0.3px] w-[27px]">
        <p className="leading-[normal] whitespace-pre-wrap">2016</p>
      </div>
    </div>
  );
}

function Frame27() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] h-[160px] items-center relative shrink-0">
      <div className="flex flex-[1_0_0] items-center justify-center min-h-px min-w-px relative w-0" style={{ "--transform-inner-width": "1185", "--transform-inner-height": "153.5" } as React.CSSProperties}>
        <div className="-rotate-90 flex-none h-full">
          <div className="h-full relative w-[129px]">
            <div className="absolute inset-[-1px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 129 1">
                <line id="Line 3" stroke="var(--stroke-0, #F1F1F1)" x2="129" y1="0.5" y2="0.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#7d7d7d] text-[10px] text-center tracking-[-0.3px] w-[27px]">
        <p className="leading-[normal] whitespace-pre-wrap">2017</p>
      </div>
    </div>
  );
}

function Frame28() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] h-[160px] items-center relative shrink-0">
      <div className="flex flex-[1_0_0] items-center justify-center min-h-px min-w-px relative w-0" style={{ "--transform-inner-width": "1185", "--transform-inner-height": "153.5" } as React.CSSProperties}>
        <div className="-rotate-90 flex-none h-full">
          <div className="h-full relative w-[129px]">
            <div className="absolute inset-[-1px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 129 1">
                <line id="Line 3" stroke="var(--stroke-0, #F1F1F1)" x2="129" y1="0.5" y2="0.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#7d7d7d] text-[10px] text-center tracking-[-0.3px] w-[27px]">
        <p className="leading-[normal] whitespace-pre-wrap">2018</p>
      </div>
    </div>
  );
}

function Frame29() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] h-[160px] items-center relative shrink-0">
      <div className="flex flex-[1_0_0] items-center justify-center min-h-px min-w-px relative w-0" style={{ "--transform-inner-width": "1185", "--transform-inner-height": "153.5" } as React.CSSProperties}>
        <div className="-rotate-90 flex-none h-full">
          <div className="h-full relative w-[129px]">
            <div className="absolute inset-[-1px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 129 1">
                <line id="Line 3" stroke="var(--stroke-0, #F1F1F1)" x2="129" y1="0.5" y2="0.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#7d7d7d] text-[10px] text-center tracking-[-0.3px] w-[27px]">
        <p className="leading-[normal] whitespace-pre-wrap">2019</p>
      </div>
    </div>
  );
}

function Frame30() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] h-[160px] items-center relative shrink-0">
      <div className="flex flex-[1_0_0] items-center justify-center min-h-px min-w-px relative w-0" style={{ "--transform-inner-width": "1185", "--transform-inner-height": "153.5" } as React.CSSProperties}>
        <div className="-rotate-90 flex-none h-full">
          <div className="h-full relative w-[129px]">
            <div className="absolute inset-[-1px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 129 1">
                <line id="Line 3" stroke="var(--stroke-0, #F1F1F1)" x2="129" y1="0.5" y2="0.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#7d7d7d] text-[10px] text-center tracking-[-0.3px] w-[29px]">
        <p className="leading-[normal] whitespace-pre-wrap">2020</p>
      </div>
    </div>
  );
}

function Frame31() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] h-[160px] items-center relative shrink-0">
      <div className="flex flex-[1_0_0] items-center justify-center min-h-px min-w-px relative w-0" style={{ "--transform-inner-width": "1185", "--transform-inner-height": "153.5" } as React.CSSProperties}>
        <div className="-rotate-90 flex-none h-full">
          <div className="h-full relative w-[129px]">
            <div className="absolute inset-[-1px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 129 1">
                <line id="Line 3" stroke="var(--stroke-0, #F1F1F1)" x2="129" y1="0.5" y2="0.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#7d7d7d] text-[10px] text-center tracking-[-0.3px] w-[27px]">
        <p className="leading-[normal] whitespace-pre-wrap">2021</p>
      </div>
    </div>
  );
}

function Frame32() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] h-[160px] items-center relative shrink-0">
      <div className="flex flex-[1_0_0] items-center justify-center min-h-px min-w-px relative w-0" style={{ "--transform-inner-width": "1185", "--transform-inner-height": "153.5" } as React.CSSProperties}>
        <div className="-rotate-90 flex-none h-full">
          <div className="h-full relative w-[129px]">
            <div className="absolute inset-[-1px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 129 1">
                <line id="Line 3" stroke="var(--stroke-0, #F1F1F1)" x2="129" y1="0.5" y2="0.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#7d7d7d] text-[10px] text-center tracking-[-0.3px] w-[29px]">
        <p className="leading-[normal] whitespace-pre-wrap">2022</p>
      </div>
    </div>
  );
}

function Frame33() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] h-[160px] items-center relative shrink-0">
      <div className="flex flex-[1_0_0] items-center justify-center min-h-px min-w-px relative w-0" style={{ "--transform-inner-width": "1185", "--transform-inner-height": "153.5" } as React.CSSProperties}>
        <div className="-rotate-90 flex-none h-full">
          <div className="h-full relative w-[129px]">
            <div className="absolute inset-[-1px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 129 1">
                <line id="Line 3" stroke="var(--stroke-0, #F1F1F1)" x2="129" y1="0.5" y2="0.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#7d7d7d] text-[10px] text-center tracking-[-0.3px] w-[29px]">
        <p className="leading-[normal] whitespace-pre-wrap">2023</p>
      </div>
    </div>
  );
}

function Years() {
  return (
    <div className="content-stretch flex items-start justify-between relative shrink-0 w-[434.625px] z-[1]" data-name="Years">
      <Frame26 />
      <Frame27 />
      <Frame28 />
      <Frame29 />
      <Frame30 />
      <Frame31 />
      <Frame32 />
      <Frame33 />
    </div>
  );
}

function Chart() {
  return (
    <div className="content-stretch flex gap-[16px] isolate items-start relative shrink-0 w-full" data-name="Chart">
      <MaskGroup />
      <Numbers />
      <Years />
    </div>
  );
}

function Widget4() {
  return (
    <div className="bg-white min-h-[200px] min-w-[320px] relative rounded-[16px] shrink-0 w-full" data-name="Widget">
      <div className="min-h-[inherit] min-w-[inherit] overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[8px] items-start min-h-[inherit] min-w-[inherit] p-[24px] relative w-full">
          <Heading4 />
          <Chart />
        </div>
      </div>
    </div>
  );
}

function Frame35() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-start justify-end min-h-px min-w-px relative tracking-[-0.2px] w-full">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold relative shrink-0 text-[#734a00] text-[24px]">November</p>
      <p className="font-['Inter:Medium',sans-serif] font-medium relative shrink-0 text-[16px] text-[orange]">2019</p>
    </div>
  );
}

function Widget5() {
  return (
    <div className="bg-white flex-[1_0_0] h-full min-h-px min-w-px relative rounded-[16px]" data-name="Widget">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[16px] items-start leading-[normal] not-italic p-[16px] relative size-full">
          <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold relative shrink-0 text-[#7d7d7d] text-[16px] tracking-[-0.4px]">Top month</p>
          <Frame35 />
        </div>
      </div>
    </div>
  );
}

function Frame36() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[4px] items-start justify-end min-h-px min-w-px relative w-full">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold relative shrink-0 text-[#734a00] text-[24px] tracking-[-0.2px]">2023</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal relative shrink-0 text-[#454545] text-[14px] tracking-[-0.3px]">96K sold so far</p>
    </div>
  );
}

function Widget6() {
  return (
    <div className="bg-white flex-[1_0_0] h-full min-h-px min-w-px relative rounded-[16px]" data-name="Widget">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[16px] items-start leading-[normal] not-italic p-[16px] relative size-full">
          <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold relative shrink-0 text-[#7d7d7d] text-[16px] tracking-[-0.4px]">Top year</p>
          <Frame36 />
        </div>
      </div>
    </div>
  );
}

function Avatar4() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Avatar">
      <div className="absolute inset-0 rounded-[24px]">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[24px] size-full" src={imgRectangle2} />
      </div>
    </div>
  );
}

function Frame38() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-start justify-center leading-[normal] not-italic relative shrink-0 tracking-[-0.3px] w-full">
      <p className="font-['Inter:Medium',sans-serif] font-medium relative shrink-0 text-[#131313] text-[12px]">Maggie Johnson</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal relative shrink-0 text-[#454545] text-[10px]">Oasis Organic Inc.</p>
    </div>
  );
}

function Frame37() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[8px] items-start justify-end min-h-px min-w-px relative w-full">
      <Avatar4 />
      <Frame38 />
    </div>
  );
}

function Widget7() {
  return (
    <div className="bg-white flex-[1_0_0] h-full min-h-px min-w-px relative rounded-[16px]" data-name="Widget">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[16px] items-start p-[16px] relative size-full">
          <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[#7d7d7d] text-[16px] tracking-[-0.4px]">Top buyer</p>
          <Frame37 />
        </div>
      </div>
    </div>
  );
}

function Frame34() {
  return (
    <div className="content-stretch flex flex-[1_0_0] gap-[16px] items-start min-h-px min-w-px relative w-full">
      <Widget5 />
      <Widget6 />
      <Widget7 />
    </div>
  );
}

function Rows() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative self-stretch shrink-0 w-[540px]" data-name="Rows">
      <Widget4 />
      <Frame34 />
    </div>
  );
}

function Row1() {
  return (
    <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-full" data-name="Row">
      <Widget3 />
      <Rows />
    </div>
  );
}

function Heading5() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start leading-[normal] not-italic pb-[16px] relative shrink-0 w-full" data-name="Heading">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold relative shrink-0 text-[#131313] text-[20px] tracking-[-0.2px]">Chats</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal relative shrink-0 text-[#454545] text-[14px] tracking-[-0.3px]">2 unread messages</p>
    </div>
  );
}

function Avatar5() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Avatar">
      <div className="absolute inset-0 rounded-[24px]">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[24px] size-full" src={imgRectangle2} />
      </div>
    </div>
  );
}

function Frame39() {
  return (
    <div className="bg-[#fff7e8] content-stretch flex gap-[8px] items-center p-[12px] relative rounded-[16px] shrink-0">
      <Avatar5 />
      <div className="absolute right-[14px] size-[4px] top-[15.39px]">
        <div className="absolute inset-[-50%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8 8">
            <circle cx="4" cy="4" fill="var(--fill-0, #EB5050)" id="Ellipse 6" r="3" stroke="var(--stroke-0, #FFF7E8)" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Avatar6() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Avatar">
      <div className="absolute inset-0 rounded-[24px]">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[24px] size-full" src={imgRectangle5} />
      </div>
    </div>
  );
}

function Frame40() {
  return (
    <div className="bg-[#fff7e8] content-stretch flex gap-[8px] items-center p-[12px] relative rounded-[16px] shrink-0">
      <Avatar6 />
      <div className="absolute right-[14px] size-[4px] top-[15.39px]">
        <div className="absolute inset-[-50%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8 8">
            <circle cx="4" cy="4" fill="var(--fill-0, #EB5050)" id="Ellipse 6" r="3" stroke="var(--stroke-0, #FFF7E8)" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Avatar7() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Avatar">
      <div className="absolute inset-0 rounded-[24px]">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[24px] size-full" src={imgRectangle6} />
      </div>
    </div>
  );
}

function Frame41() {
  return (
    <div className="content-stretch flex items-center p-[12px] relative rounded-[16px] shrink-0">
      <Avatar7 />
    </div>
  );
}

function Avatar8() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Avatar">
      <div className="absolute inset-0 rounded-[24px]">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[24px] size-full" src={imgRectangle7} />
      </div>
    </div>
  );
}

function Frame42() {
  return (
    <div className="content-stretch flex items-center p-[12px] relative rounded-[16px] shrink-0">
      <Avatar8 />
    </div>
  );
}

function Customer4() {
  return (
    <div className="content-center flex flex-wrap gap-[8px] items-center relative shrink-0 w-full" data-name="Customer">
      <Frame39 />
      <Frame40 />
      <Frame41 />
      <Frame42 />
    </div>
  );
}

function IconFromTablerIo11() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.pb799a80} id="Vector" stroke="var(--stroke-0, #734A00)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Frame44() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">All messages</p>
      <IconFromTablerIo11 />
    </div>
  );
}

function Frame43() {
  return (
    <div className="content-stretch flex h-[71px] items-end pt-[16px] relative shrink-0">
      <Frame44 />
    </div>
  );
}

function Widget8() {
  return (
    <div className="bg-white content-stretch flex flex-col gap-[8px] items-start min-w-[320px] overflow-clip p-[24px] relative rounded-[16px] self-stretch shrink-0" data-name="Widget">
      <Heading5 />
      <Customer4 />
      <Frame43 />
    </div>
  );
}

function Heading6() {
  return (
    <div className="content-stretch flex flex-col items-start pb-[16px] relative shrink-0 w-full" data-name="Heading">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[#131313] text-[20px] tracking-[-0.2px]">Top states</p>
    </div>
  );
}

function Bar() {
  return (
    <div className="bg-gradient-to-r from-[#ffcd71] from-[2.574%] relative rounded-[4px] shrink-0 to-[112.5%] to-[rgba(255,205,113,0)] w-full" data-name="Bar">
      <div className="flex flex-col justify-center size-full">
        <div className="content-stretch flex flex-col gap-[8px] items-start justify-center not-italic px-[8px] py-[6px] relative text-[#131313] uppercase w-full">
          <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[14px]">NY</p>
          <div className="-translate-y-1/2 absolute flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] right-[8px] text-[10px] text-right top-[calc(50%-0.11px)] whitespace-nowrap">
            <p className="leading-[normal]">120k</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bar1() {
  return (
    <div className="bg-gradient-to-r content-stretch flex flex-col from-[#ffcd71] from-[2.574%] gap-[8px] items-start justify-center not-italic px-[8px] py-[6px] relative rounded-[4px] shrink-0 text-[#131313] to-[112.5%] to-[rgba(255,205,113,0)] uppercase w-[229px]" data-name="Bar">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[14px]">MA</p>
      <div className="-translate-y-1/2 absolute flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] right-[8px] text-[10px] text-right top-[calc(50%-0.11px)] whitespace-nowrap">
        <p className="leading-[normal]">80k</p>
      </div>
    </div>
  );
}

function Bar2() {
  return (
    <div className="bg-gradient-to-r content-stretch flex flex-col from-[#ffcd71] from-[2.574%] gap-[8px] items-start justify-center not-italic px-[8px] py-[6px] relative rounded-[4px] shrink-0 text-[#131313] to-[112.5%] to-[rgba(255,205,113,0)] uppercase w-[207px]" data-name="Bar">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[14px]">NH</p>
      <div className="-translate-y-1/2 absolute flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] right-[8px] text-[10px] text-right top-[calc(50%-0.11px)] whitespace-nowrap">
        <p className="leading-[normal]">70k</p>
      </div>
    </div>
  );
}

function Bar3() {
  return (
    <div className="bg-gradient-to-r content-stretch flex flex-col from-[#ffcd71] from-[2.574%] gap-[8px] items-start justify-center not-italic px-[8px] py-[6px] relative rounded-[4px] shrink-0 text-[#131313] to-[112.5%] to-[rgba(255,205,113,0)] uppercase w-[150px]" data-name="Bar">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[14px]">OR</p>
      <div className="-translate-y-1/2 absolute flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] right-[8px] text-[10px] text-right top-[calc(50%-0.11px)] whitespace-nowrap">
        <p className="leading-[normal]">50k</p>
      </div>
    </div>
  );
}

function Widget9() {
  return (
    <div className="bg-white content-stretch flex flex-col gap-[8px] items-start min-w-[320px] overflow-clip p-[24px] relative rounded-[16px] self-stretch shrink-0" data-name="Widget">
      <Heading6 />
      <Bar />
      <Bar1 />
      <Bar2 />
      <Bar3 />
    </div>
  );
}

function Heading7() {
  return (
    <div className="content-stretch flex flex-col items-start pb-[16px] relative shrink-0 w-full" data-name="Heading">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[#131313] text-[20px] tracking-[-0.2px]">New deals</p>
    </div>
  );
}

function IconFromTablerIo12() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p25f09b00} id="Vector" stroke="var(--stroke-0, #FFA500)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Frame46() {
  return (
    <div className="bg-[#fff7e8] content-stretch flex gap-[8px] items-center justify-center pl-[12px] pr-[16px] py-[12px] relative rounded-[16px] shrink-0">
      <IconFromTablerIo12 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">Fruit2Go</p>
    </div>
  );
}

function IconFromTablerIo13() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p25f09b00} id="Vector" stroke="var(--stroke-0, #FFA500)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Frame47() {
  return (
    <div className="bg-[#fff7e8] content-stretch flex gap-[8px] items-center justify-center pl-[12px] pr-[16px] py-[12px] relative rounded-[16px] shrink-0">
      <IconFromTablerIo13 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">{`Marshall's MKT`}</p>
    </div>
  );
}

function IconFromTablerIo14() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p25f09b00} id="Vector" stroke="var(--stroke-0, #FFA500)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Frame48() {
  return (
    <div className="bg-[#fff7e8] content-stretch flex gap-[8px] items-center justify-center pl-[12px] pr-[16px] py-[12px] relative rounded-[16px] shrink-0">
      <IconFromTablerIo14 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">CCNT</p>
    </div>
  );
}

function IconFromTablerIo15() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p25f09b00} id="Vector" stroke="var(--stroke-0, #FFA500)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Frame49() {
  return (
    <div className="bg-[#fff7e8] content-stretch flex gap-[8px] items-center justify-center pl-[12px] pr-[16px] py-[12px] relative rounded-[16px] shrink-0">
      <IconFromTablerIo15 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">Joana Mini-market</p>
    </div>
  );
}

function IconFromTablerIo16() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p25f09b00} id="Vector" stroke="var(--stroke-0, #FFA500)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Frame50() {
  return (
    <div className="bg-[#fff7e8] content-stretch flex gap-[8px] items-center justify-center pl-[12px] pr-[16px] py-[12px] relative rounded-[16px] shrink-0">
      <IconFromTablerIo16 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">Little Brazil Vegan</p>
    </div>
  );
}

function IconFromTablerIo17() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p25f09b00} id="Vector" stroke="var(--stroke-0, #FFA500)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Frame51() {
  return (
    <div className="bg-[#fff7e8] content-stretch flex gap-[8px] items-center justify-center pl-[12px] pr-[16px] py-[12px] relative rounded-[16px] shrink-0">
      <IconFromTablerIo17 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">Target</p>
    </div>
  );
}

function IconFromTablerIo18() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p25f09b00} id="Vector" stroke="var(--stroke-0, #FFA500)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Frame52() {
  return (
    <div className="bg-[#fff7e8] content-stretch flex gap-[8px] items-center justify-center pl-[12px] pr-[16px] py-[12px] relative rounded-[16px] shrink-0">
      <IconFromTablerIo18 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">Organic Place</p>
    </div>
  );
}

function IconFromTablerIo19() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon (from Tabler.io)">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon (from Tabler.io)">
          <path d={svgPaths.p25f09b00} id="Vector" stroke="var(--stroke-0, #FFA500)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
        </g>
      </svg>
    </div>
  );
}

function Frame53() {
  return (
    <div className="bg-[#fff7e8] content-stretch flex gap-[8px] items-center justify-center pl-[12px] pr-[16px] py-[12px] relative rounded-[16px] shrink-0">
      <IconFromTablerIo19 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#734a00] text-[14px] tracking-[-0.3px]">{`Morello's`}</p>
    </div>
  );
}

function Frame45() {
  return (
    <div className="content-start flex flex-wrap gap-[8px] items-start relative shrink-0 w-full">
      <Frame46 />
      <Frame47 />
      <Frame48 />
      <Frame49 />
      <Frame50 />
      <Frame51 />
      <Frame52 />
      <Frame53 />
    </div>
  );
}

function Widget10() {
  return (
    <div className="bg-white flex-[1_0_0] min-h-px min-w-[320px] relative rounded-[16px] self-stretch" data-name="Widget">
      <div className="min-w-[inherit] overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[8px] items-start min-w-[inherit] p-[24px] relative size-full">
          <Heading7 />
          <Frame45 />
        </div>
      </div>
    </div>
  );
}

function Row2() {
  return (
    <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-full" data-name="Row">
      <Widget8 />
      <Widget9 />
      <Widget10 />
    </div>
  );
}

export default function Body() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative size-full" data-name="Body">
      <Row />
      <Row1 />
      <Row2 />
    </div>
  );
}