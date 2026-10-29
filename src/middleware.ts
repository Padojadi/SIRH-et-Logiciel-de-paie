import { NextResponse, type NextRequest } from "next/server";

function publicRedirect(request: NextRequest, pathname: string) {
  const forwarded = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  const hostname = forwarded.replace(/^\[|\]$/g, "").split(":")[0];
  const internal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (forwarded && !internal) {
    const proto = (request.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
    url.protocol = proto.endsWith(":") ? proto : `${proto}:`;
    url.host = forwarded;
  }
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/connexion") return NextResponse.next();
  const token = request.cookies.get("cauris_session")?.value;
  if (pathname === "/") {
    return publicRedirect(request, token ? "/tableau-de-bord" : "/connexion");
  }
  if (!token) return publicRedirect(request, "/connexion");
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
