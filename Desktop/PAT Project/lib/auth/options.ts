import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "crypto";

// ---------------------------------------------------------------------------
// Encryption helpers (AES-256-GCM)
// ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes).
// ---------------------------------------------------------------------------
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }
  return Buffer.from(raw, "hex");
}

function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 128-bit auth tag
  // Format: <iv_hex>:<tag_hex>:<ciphertext_hex>
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

// Exported so server-side code (e.g. API routes) can decrypt stored tokens.
export function decrypt(encoded: string): string {
  const [ivHex, tagHex, dataHex] = encoded.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted token format.");
  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(dataHex, "hex")).toString("utf8") + decipher.final("utf8");
}

// ---------------------------------------------------------------------------
// Supabase admin client — server-side only, never exposed to the browser.
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// NextAuth options
// ---------------------------------------------------------------------------
export const authOptions: NextAuthOptions = {
  providers: [
    // ── 1. Email + password via Supabase Auth ──────────────────────────────
    CredentialsProvider({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });

        if (error || !data.user) return null;

        return {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.full_name ?? null,
          image: data.user.user_metadata?.avatar_url ?? null,
        };
      },
    }),

    // ── 2. Google OAuth ────────────────────────────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/tasks",
          ].join(" "),
          access_type: "offline",
          prompt: "consent", // force refresh_token to always be returned
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    // ── signIn: persist encrypted Google tokens server-side ───────────────
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const encryptedAccess = encrypt(account.access_token!);
        const encryptedRefresh = account.refresh_token
          ? encrypt(account.refresh_token)
          : null;
        const expiresAt = account.expires_at
          ? new Date(account.expires_at * 1000).toISOString()
          : null;

        const { error } = await supabase.from("users").upsert(
          {
            id: user.id,
            email: user.email,
            google_access_token_enc: encryptedAccess,
            google_refresh_token_enc: encryptedRefresh,
            google_token_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        if (error) {
          console.error("[auth] Failed to persist Google tokens:", error.message);
          return false; // abort sign-in if we can't store tokens
        }
      }

      return true;
    },

    // ── jwt: only store the user id — never tokens ────────────────────────
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },

    // ── session: expose only safe, non-sensitive fields to the client ──────
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      // Raw or encrypted tokens are intentionally never included here.
      return session;
    },
  },
};
