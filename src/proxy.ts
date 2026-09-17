import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/sign-in", req.url);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/((?!api/auth|api/cron|sign-in|_next/static|_next/image|favicon.ico).*)"],
};
