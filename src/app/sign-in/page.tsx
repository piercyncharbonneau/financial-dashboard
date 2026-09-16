import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-black/10 dark:border-white/10 p-8 flex flex-col gap-6 items-center text-center">
        <div>
          <h1 className="text-xl font-semibold">HOODZ Financial Dashboard</h1>
          <p className="text-sm text-black/50 dark:text-white/50 mt-1">
            Sign in with your HOODZ Google account to continue.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="w-full"
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-foreground text-background font-medium text-sm py-2.5 hover:opacity-90 transition-opacity"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
