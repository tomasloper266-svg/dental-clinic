import type { Dictionary } from "./ar";

/**
 * القاموس الإنجليزي — جزئي بالتصميم: النوع `Partial<Dictionary>` يضمن أن كل
 * مفتاح إنجليزي له مقابل عربي، وسلسلة الارتداد في core تعيد المفتاح الغائب
 * إلى العربية فلا يكسر الترحيل التدريجي أي شاشة.
 */
export const en: Partial<Dictionary> = {
  // إجراءات مشتركة
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.add": "Add",
  "common.search": "Search",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.back": "Back",
  "common.next": "Next",
  "common.loading": "Loading…",
  "common.retry": "Retry",

  // تسميات التنقل
  "nav.home": "Home",
  "nav.patients": "Patients",
  "nav.appointments": "Appointments",
  "nav.dentalChart": "Dental chart & treatment plans",
  "nav.waitlist": "Waitlist",
  "nav.reminders": "Tomorrow's reminders",
  "nav.invoices": "Invoices & payments",
  "nav.dues": "Outstanding dues",
  "nav.reports": "Reports",
  "nav.staff": "Staff",
  "nav.inventory": "Inventory",
  "nav.instructions": "Instruction templates",
  "nav.settings": "Settings",

  // الثيم
  "theme.light": "Light mode",
  "theme.dark": "Dark mode",
  "theme.toLight": "Switch to light mode",
  "theme.toDark": "Switch to dark mode",

  // اللغة
  "language.arabic": "عربي",
  "language.english": "English",

  // ─── Auth pages (login, signup, recovery, support, offer) ─────────────────
  // English keeps today's page copy verbatim so the en rendering is
  // pixel-identical to the pre-i18n design.

  // Shared across auth pages
  "auth.greeting": "Hello, Welcome!",
  "auth.noAccount": "Don't have an account?",
  "auth.haveAccount": "Already have an account?",
  "auth.register": "Register",
  "auth.login": "Login",
  "auth.signIn": "Sign in",
  "auth.backToLogin": "Back to login",
  "auth.forgotPasswordQuestion": "Forgot Password?",
  "auth.rememberedPassword": "Remember your password?",
  "auth.error.server": "Couldn't reach the server, please try again",
  "auth.error.passwordMismatch": "Passwords don't match",
  "auth.error.setPassword": "Couldn't set the new password",
  "auth.error.sendCode": "Couldn't send the code — please try again",
  "auth.error.verifyCode": "Couldn't verify the code",

  // Login
  "auth.login.title": "Login",
  "auth.login.username": "Username",
  "auth.login.password": "Password",
  "auth.login.showPassword": "Show password",
  "auth.login.hidePassword": "Hide password",
  "auth.login.failed": "Sign in failed — check your phone number and password",

  // Social row
  "auth.social.orLogin": "or login with social platforms",
  "auth.social.orSignup": "or sign up with social platforms",
  "auth.social.comingSoon": "coming soon",

  // Signup
  "auth.signup.title": "Create Your Clinic Account",
  "auth.signup.clinicName": "Clinic Name",
  "auth.signup.doctorName": "Doctor Name",
  "auth.signup.phone": "Phone Number",
  "auth.signup.username": "Username",
  "auth.signup.password": "Password",
  "auth.signup.failed": "Sign up failed — check the entered details",
  "auth.signup.clinicCreated": "Clinic created!",
  "auth.signup.recoveryShownHere": "The recovery code is shown on this page only",
  "auth.signup.clinicReady": "Your clinic is ready",
  "auth.signup.recoveryTitle": "Backup recovery code",
  "auth.signup.recoverySaveBefore": "Save it now somewhere safe — it is shown ",
  "auth.signup.recoverySaveOnce": "once only",
  "auth.signup.recoverySaveAfter": " and we cannot recover it for you. If you lose your phone number and have no verified email, this code is your only way back into the account without contacting support.",
  "auth.signup.continueSetup": "Continue to clinic setup",
  "auth.signup.signinLater": "Sign in later from the login page",

  // Shared fields
  "auth.field.phone": "Phone Number",
  "auth.field.verifiedEmail": "Verified Email",
  "auth.field.emailPlaceholder": "doctor@clinic.com",
  "auth.field.verificationCode": "Verification Code",
  "auth.field.newPassword": "New Password (at least 8 characters)",
  "auth.field.confirmPassword": "Confirm Password",
  "auth.field.recoveryCode": "Backup recovery code (12 characters, shown when your clinic was created)",

  // Recovery tabs
  "auth.tab.sendCode": "Send a Code",
  "auth.tab.recoveryCode": "Recovery Code",
  "auth.tab.support": "Support",
  "auth.tab.recoveryMethod": "Recovery method",
  "auth.tab.recoveryChannel": "Recovery channel",

  // Forgot password
  "auth.forgotPassword.title": "Forgot Password",
  "auth.forgotPassword.description": "Enter your registered phone number or verified email and we'll send you a verification code.",
  "auth.forgotPassword.sendCode": "Send Verification Code",
  "auth.forgotPassword.forgotPhoneLink": "Forgot your registered phone number?",
  "auth.forgotPassword.codeTitle": "Enter Verification Code",
  "auth.forgotPassword.codeSentTo": "We sent a 6-digit code to {destination}",
  "auth.forgotPassword.codeSent": "We sent a 6-digit code",
  "auth.forgotPassword.codeValidity": "— valid for 10 minutes.",
  "auth.forgotPassword.verifyCode": "Verify Code",
  "auth.forgotPassword.resend": "Resend code",
  "auth.forgotPassword.resendIn": "Resend code in {seconds}s",
  "auth.forgotPassword.editDetails": "Edit details",
  "auth.forgotPassword.newPasswordTitle": "New Password",
  "auth.forgotPassword.newPasswordDescription": "Choose a strong password — you'll be signed out of all other devices.",
  "auth.forgotPassword.setPassword": "Set New Password",
  "auth.forgotPassword.doneTitle": "Your password has been updated",
  "auth.forgotPassword.doneDescription": "All old sessions were signed out on every device — sign in with your new password.",
  "auth.forgotPassword.recoveryDescription": "The 12-character backup code shown once when your clinic account was created — it proves you own the account, so you can set a new password directly.",

  // Forgot phone
  "auth.forgotPhone.title": "Forgot Your Phone Number?",
  "auth.forgotPhone.description": "Choose how to recover your account — the phone number can't change without proving you own the account.",
  "auth.forgotPhone.forgotPasswordLink": "Forgot your password?",
  "auth.forgotPhone.emailFormAria": "Send a code to your verified email",
  "auth.forgotPhone.codeFormAria": "Enter the verification code",
  "auth.forgotPhone.codeSentTo": "We sent a verification code to {destination} — valid for 10 minutes.",
  "auth.forgotPhone.yourEmail": "your email",
  "auth.forgotPhone.verifyShowNumber": "Verify and Show Number",
  "auth.forgotPhone.revealedAria": "Recovered phone numbers",
  "auth.forgotPhone.revealed": "Your email is verified — here are the phone numbers registered with it:",
  "auth.forgotPhone.loginWithNumber": "Login with this number",
  "auth.forgotPhone.recoveredAria": "Recovered number",
  "auth.forgotPhone.recovered": "Recovery code verified — the phone number registered with {clinicName}:",
  "auth.forgotPhone.recoveryFormAria": "Recover with recovery code",
  "auth.forgotPhone.recoveryIntro1": "The ",
  "auth.forgotPhone.recoveryIntroStrong": "recovery code",
  "auth.forgotPhone.recoveryIntro2": " is the 12-character code (like ",
  "auth.forgotPhone.recoveryIntro3": ") shown once when your clinic account was created. Saved it? Enter it here to see your registered phone number. Lost it? Use the ",
  "auth.forgotPhone.recoveryIntro4": " tab.",

  // Support card
  "auth.support.aria": "Contact support",
  "auth.support.title": "Call us and we'll recover your account",
  "auth.support.description": "Have proof of ownership ready (registration documents, latest subscription invoices) so we can verify you faster.",
  "auth.support.call": "Call Support",

  // Fallback code notice — no send provider linked yet
  "auth.fallback.noProvider": "No SMS/email provider is linked yet, so the verification code is shown here directly.",
  "auth.fallback.registeredDestinationPrefix": " Registered destination: ",
  "auth.fallback.registeredDestinationSuffix": ".",
  "auth.fallback.afterProvider": "Once a provider is connected, the code will be delivered through the channel instead of shown on screen.",

  // Signup subscription offer card
  "auth.plans.aria": "Subscription offer",
  "auth.plans.limitedOffer": "Limited launch offer",
  "auth.plans.startFree": "Start free — {days}-day full trial",
  "auth.plans.everyFeature": "Every feature unlocked for the full {days}-day trial — no card, no commitment.",
  "auth.plans.bestValue": "Best value",
  "auth.plans.yearly": "Yearly",
  "auth.plans.monthly": "Monthly",
  "auth.plans.perYear": "per year",
  "auth.plans.perMonth": "per month",
  "auth.plans.shamCash": "Pay via SHAM Cash — from day one, even before your trial ends",
  "auth.plans.cancelAnytime": "Cancel anytime — your data stays yours",
};
