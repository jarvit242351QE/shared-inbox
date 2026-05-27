import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = [
  "/auth/signin",
  "/auth/verify",
  "/auth/sent",
  "/api/auth/signin",
  "/api/auth/verify",
  "/api/auth/signout",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ManyChat webhook is signature-checked inside the route — let it through.
  if (pathname.startsWith("/api/webhooks/")) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const session = req.cookies.get("si_session")?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/signin";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
