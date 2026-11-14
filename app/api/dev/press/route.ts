import { NextResponse } from "next/server";
import { handleDigit } from "@/lib/alerts";

// Dev-only: simulate a keypad press when Twilio is not configured.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && process.env.HAVEN_DEV !== "1")
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  const { callId, digit } = await req.json();
  return NextResponse.json(await handleDigit(callId, String(digit ?? "1")));
}
