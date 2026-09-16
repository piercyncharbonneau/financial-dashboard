import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { auth, signOut } from "@/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HOODZ Financial Dashboard",
  description: "Financial dashboard and reporting for HOODZ of Kansas City",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {session ? (
          <div className="flex min-h-screen">
            <aside className="w-56 shrink-0 border-r border-black/10 dark:border-white/10 p-4 flex flex-col gap-6">
              <div>
                <p className="text-sm font-semibold">HOODZ</p>
                <p className="text-xs text-black/50 dark:text-white/50">Financial Dashboard</p>
              </div>
              <Nav />
              <div className="mt-auto flex flex-col gap-2">
                <p className="text-xs text-black/40 dark:text-white/40 truncate">
                  {session.user?.email}
                </p>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/sign-in" });
                  }}
                >
                  <button
                    type="submit"
                    className="text-xs text-black/50 dark:text-white/50 hover:underline"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </aside>
            <main className="flex-1 p-6 md:p-8 max-w-6xl">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
