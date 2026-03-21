import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(_req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      // Allow the request only when a valid JWT session exists.
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    /*
     * Protect all routes under the Next.js (app) route group and /admin.
     *
     * Note: Next.js route groups — e.g. app/(app)/dashboard/page.tsx — do NOT
     * include the group name in the URL.  The pattern below therefore matches
     * the literal prefix "(app)" only if your URLs genuinely start with that
     * string.  If your (app) routes are top-level (e.g. /dashboard, /feed),
     * replace "/(app)/:path*" with the specific paths you want protected.
     */
    "/(app)/:path*",
    "/admin/:path*",
  ],
};
