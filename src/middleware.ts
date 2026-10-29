import { NextResponse, type NextRequest } from "next/server";

function publicRedirect(request: NextRequest, pathname: string) {
  const forwarded = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  const proto = (request.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim().replace(/:$/, "");
  let hostname = forwarded;
  let port = "";
  if (forwarded.startsWith("[")) {
    const end = forwarded.indexOf("]");
    hostname = end > 0 ? forwarded.slice(1, end) : forwarded;
    port = end > 0 ? forwarded.slice(end + 2) : "";
  } else {
    const colon = forwarded.lastIndexOf(":");
    if (colon > 0) {
      hostname = forwarded.slice(0, colon);
      port = forwarded.slice(colon + 1);
    }
  }
  const internal = !hostname || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (internal) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Un URL déjà construit sur le port d'écoute conserve ce port si l'on ne
  // change que le nom. On repart d'une origine publique, sans le port 3020.
  if (port === "80" || port === "443" || port === "3020") port = "";
  const origin = `${proto}://${hostname}${port ? `:${port}` : ""}`;
  return NextResponse.redirect(new URL(pathname, origin));
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
