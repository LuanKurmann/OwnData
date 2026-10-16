"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginUser, registerUser, registrationOpen } from "@/lib/auth";
import { redirectFlash } from "@/lib/flash";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1), next: z.string().optional() });

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return redirectFlash("/login", "invalid", "err");
  const res = await loginUser(parsed.data.email, parsed.data.password);
  if (res.error) return redirectFlash("/login", res.error, "err");
  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/dashboard";
  redirect(next);
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  name: z.string().min(1).max(120),
  locale: z.enum(["de", "en"]).default("de"),
});

export async function registerAction(formData: FormData) {
  if (!(await registrationOpen())) redirectFlash("/register", "registrationClosed", "err");
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const pw = parsed.error.issues.some((i) => i.path[0] === "password");
    return redirectFlash("/register", pw ? "passwordTooShort" : "invalid", "err");
  }
  const res = await registerUser(parsed.data);
  if (res.error) return redirectFlash("/register", res.error, "err");
  redirect("/profile?msg=saved&kind=ok");
}
