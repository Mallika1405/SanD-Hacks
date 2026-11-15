import { NextResponse, type NextRequest } from "next/server";

// The app opens on the welcome / sign-in screen. Crisis help is always reachable without signing in.
export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (p.startsWith("/api") || p.startsWith("/_next") || p === "/login" || p === "/crisis" || p === "/favicon.ico" || /\.[a-z0-9]+$/i.test(p)) return NextResponse.next();
  if (!req.cookies.get("sw_entered")) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
