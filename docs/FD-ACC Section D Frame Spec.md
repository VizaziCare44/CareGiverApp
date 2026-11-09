# FD-ACC section D: frames to draw for Maya

Status: **built in the app, frames not yet drawn.** The Figma account connected to Claude has a View seat on the
file "Vizazi Care — FD-ACC + FD-VERIFY Wireframes", so Claude could not write to it (`use_figma` refused with
"read-only mode"). The screens below are built and tested in the app (`tests/e2e/account-links-figma.spec.ts`);
this file says what to draw so the frames match them. Each frame is a copy of an existing frame on the page
"FD-ACC screens" with the changes listed, so it uses the same components: Field/Default, Field/Error,
Button/Primary, the text link (44 tap target), the Success icon of ACC-10.

New section on the page, below section C: **"D · Password recovery and email links (Family Member)"**,
390 wide frames, 48 between them, same section title and note styles as section A. Note text: "Added by DEV-027
(password recovery, founder decision 2026-10-01) and for the outcomes of the email links. Family Member, mobile
390 wide."

All frames: white screen 390×844, Body padding 20, 16 between parts, title Inter Bold 24 (line height 1.25),
no app bar, the main button Button/Primary full width at the bottom (a spacer above it), the text link
(44 tap target, primary, semibold 16, underlined, centred) under it where listed.

| Frame | Copy of | Changes |
|---|---|---|
| **ACC-13 Forgot Password** (reached from the link on Log In) | ACC-02 Log In | Title "Reset your password". Under it a sentence, Inter Regular 16, muted: "Enter your email and we'll send you a link to reset it." (copy the sentence from ACC-07). Keep the Email field (placeholder "name@example.com"); delete the Password field. Button "Send reset link". Link "Back to log in". |
| **ACC-13b Forgot Password — sent** | ACC-10 Booking Confirmation | Delete the Booking summary. Title "Check your email". Sentence (Inter Regular 18, ink, centred): "If an account exists for name@example.com, we've sent a link to reset your password." Link "Back to log in" (rename the frame "Text link (44 tap target)"). Same message whether or not the address has an account. |
| **ACC-14 Reset Password** (reached from the email link) | ACC-02 Log In | Title "Set a new password". Sentence "Choose a new password for your account." One Field/Default: label "New password", placeholder "New password". Button "Save new password". No text link. No hint under the field. |
| **ACC-14b Reset Password — error** | ACC-01b Sign Up — inline errors | As ACC-14 but the field is Field/Error: label "New password", value "New password", message "Password must be at least 8 characters". Delete the other fields and the link. |
| **ACC-15 Link expired or invalid** | ACC-02 Log In | Title "Link expired or invalid". Sentence "This confirmation link didn't work. Try signing up again, or log in if you already confirmed." Delete both fields. Button "Go to log in". No text link. |
| **ACC-16 Sign Up — check your email** | ACC-10 Booking Confirmation | Delete the Booking summary and the link. Title "Check your email". Sentence "We sent a confirmation link to name@example.com. Follow it to activate your account." |

## Change to two existing frames

**ACC-02 Log In** and **ACC-02b Log In — error**: add a text link **"Forgot password?"** directly under the Password
field, 16 below it, **left-aligned** (hug its text, not centred), the text-link style (44 high, primary, semibold 16,
underlined). It goes to ACC-13. It is not in the original frames because password recovery was added later
(DEV-027); the owner asked for it to stay under the fields (2026-11-09).

## Not in the frames (known differences from the older wording)

- Field labels: the Log In and Sign Up frames say "Email", not "Email address"; Forgot Password uses the same.
- Field errors have no full stop ("Password must be at least 8 characters"), as in ACC-01b.
- The password hint "At least 8 characters." is not drawn on any frame; only its error message exists.
