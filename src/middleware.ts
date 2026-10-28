import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/connexion") return NextResponse.next();
  const token = request.cookies.get("cauris_session")?.value;
  if (pathname === "/") {
    return NextResponse.redirect(new URL(token ? "/tableau-de-bord" : "/connexion", request.url));
  }
  if (!token) return NextResponse.redirect(new URL("/connexion", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
