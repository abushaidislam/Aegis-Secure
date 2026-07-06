// English source catalog. New user-facing strings should be added here first
// (with their default English text) and to `src/lib/i18n-strings.ts` if they
// need typed access. Translations for the other seven locales live alongside
// this file — each one exports the same shape and is loaded on demand by
// `activateLocale()` in `src/lib/i18n.ts`.
//
// Message shape follows `@lingui/core`'s runtime catalog format: a plain map
// of message id → translated string. Ids match the `id` prop on `<Trans>`
// or the argument to `i18n._()`. Missing ids fall through to the default
// text provided at the call site, so partial translations are always safe.

export const messages: Record<string, string> = {
  // Bottom tabs
  "tabs.vault": "Vault",
  "tabs.security": "Security",
  "tabs.profile": "Profile",

  // Profile — section labels
  "profile.section.account": "Account",
  "profile.section.appearance": "Appearance",
  "profile.section.language": "Language",
  "profile.section.session": "Session",
  "profile.section.danger": "Danger zone",

  // Profile — rows
  "profile.displayName": "Display name",
  "profile.displayName.empty": "Not set",
  "profile.email": "Email",
  "profile.theme": "Theme",
  "profile.language": "Language",
  "profile.signOut": "Sign out",
  "profile.signOut.description": "You'll need to sign in and unlock again",
  "profile.delete": "Delete account",
  "profile.delete.description": "Erase your account, codes, and passphrase forever.",
  "profile.delete.busy": "Deleting account…",

  // Appearance sheet
  "appearance.system": "System",
  "appearance.system.description": "Follow your device.",
  "appearance.light": "Light",
  "appearance.light.description": "Warm cream, always.",
  "appearance.dark": "Dark",
  "appearance.dark.description": "Easy on the eyes.",

  // Language sheet
  "language.title": "Language",
  "language.system": "System",
  "language.system.description": "Follow your device.",

  // Common actions
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.close": "Close",
  "common.retry": "Try again",
};
