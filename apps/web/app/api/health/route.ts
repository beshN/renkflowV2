import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "renkflow-web",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  });
}
