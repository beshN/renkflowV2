/** The live size of the design as dimension lines over the 3D view: lines with end ticks, in the drawing's lettering. */
export type Dim = { name: string; value: number; axis: "width" | "depth" | "height" };

function Line({ axis }: { axis: Dim["axis"] }) {
  // One dimension line, drawn along the axis it measures.
  const paths: Record<Dim["axis"], string> = {
    width: "M2 7h30M2 2v10M32 2v10M2 7l3-2.4M2 7l3 2.4M32 7l-3-2.4M32 7l-3 2.4",
    height: "M17 1v12M12 1h10M12 13h10M17 1l-2.4 3M17 1l2.4 3M17 13l-2.4-3M17 13l2.4-3",
    depth: "M4 12 28 2M2 9l4 4M26 -1l4 4M4 12l3.2-.6M4 12l.8-3.1M28 2l-3.2.6M28 2l-.8 3.1",
  };
  return (
    <svg viewBox="0 0 34 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[axis]} />
    </svg>
  );
}

export function DimensionStrip({ dims }: { dims: Dim[] }) {
  return (
    <div className="fx-dims" aria-hidden>
      {dims.map((d) => (
        <span key={d.axis} className="fx-dim">
          <Line axis={d.axis} />
          <span className="fx-dim-name">{d.name}</span>
          <b>{d.value.toLocaleString("en-US").replace(/,/g, " ")} mm</b>
        </span>
      ))}
    </div>
  );
}
