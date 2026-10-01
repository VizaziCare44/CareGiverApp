---
name: caregiver-ui-ux-designer
description: Enforces premium, human-centric design patterns (inspired by IDEO, Clay, Doberman, Fuseproject) for a multi-regional caregiver platform, focusing on high accessibility, calm aesthetics, and cross-cultural trust.
---

# Caregiver Platform UI/UX Design & Engineering Guidelines

When generating UI components, user flows, design tokens, or front-end views for this platform, strictly follow these human-centric design languages and agency-grade design frameworks.

## 1. Premium Design Intent & Philosophical Influences
Our design must balance the high-utility structure of medical software with the deeply empathetic, tactile feel of world-class consumer products.
- **IDEO (Human-Centered Empathy):** Design for the extreme user. Caregivers are often exhausted, stressed, or multi-tasking. UI must require low cognitive load. Use progressive disclosure to avoid overwhelming users.
- **Clay (Sleek Digital Premium):** Crisp layout grids, micro-interactions that feel premium but purposeful, tactile button states, and clean typography scales that project enterprise-grade trust.
- **Doberman / EY Doberman (Design for Care & Longevity):** Anticipatory UX. The interface should anticipate what a caregiver needs next (e.g., showing the "Log Medication" button prominently during a scheduled window). 
- **Fuseproject (Physical-Digital Harmony):** Industrial, organic curves and intentional use of whitespace. The software should feel like a calming, natural extension of a physical care environment.

## 2. Universal Accessibility & Care-Centric UI Standards
Caregivers and patients frequently navigate visual, cognitive, or motor friction. 
- **Typography:** Minimum body font size of `16px`/`16pt` on mobile devices. Use clean, highly legible sans-serif typefaces with distinct letter shapes (to avoid mixing up characters like 'I', 'l', and '1' in medication dosages).
- **Touch Targets:** Minimum touch target size of `48x48dp` (surpassing the standard 44x44 to accommodate shaky hands, older users, or rushed taps). Space interactive elements widely.
- **Visual Stress Reduction:** Avoid stark, clinical pure white (`#FFFFFF`) backgrounds. Use soft, organic off-whites, warm grays, and calming tones (e.g., sage greens, muted blues, warm sand) to reduce visual fatigue. Avoid harsh flashing animations.
- **Accessible Color Contrast:** Ensure all text-to-background configurations strictly pass WCAG 2.1 AA (and ideally AAA) contrast ratios. Never rely solely on color to communicate critical states (e.g., error alerts must include an explicit icon and descriptive text, not just a red border).

## 3. Cross-Cultural Payment & Verification UX Flows
Because this application services both Western markets (Visa, PayPal) and emerging African ecosystems (Hubtel for Ghana, Flutterwave for Nigeria/Kenya), payment interfaces must build local trust.
- **Mobile Money (MoMo) Native Patterns:** For African markets, elevate Mobile Money to a top-tier payment option. Do not bury it under "Alternative Payments". Provide explicit, step-by-step UX micro-copy for USSD prompt approvals (e.g., *"Check your phone for the authorization pop-up from MTN/Vodafone/AirtelTigo/Safaricom/Airtel"*).
- **Anxiety-Free Error Handling:** When transactions fail due to local carrier network drops, avoid cold, technical codes like `Error 503`. Use reassuring, human copy: *"Network connection is a bit slow right now. Don't worry, we haven't charged your account. Tap below to retry safely."*
- **Localized Financial Signals:** Use clear currency identifiers (`GHS`, `NGN`, `KES`, `$ , '€`) instantly to remove ambiguity during regional caregiver payouts or client billing.

## 4. Design-to-Code Implementation Rules (React Native)
- **Component Styling:** Use theme-driven style sheets or utility frameworks that utilize strict design tokens (`theme.colors.backgroundCalm`, `theme.spacing.comfortable`).
- **Optimistic UI Animations:** When a caregiver logs an event (e.g., "Patient took dinner"), use smooth, instant micro-interactions to show success immediately on the UI while backend synchronization occurs silently in the background.
- **Haptic Feedback:** Integrate subtle, intentional haptic ticks for successful critical actions (like completing a shift check-in) to provide physical confirmation to the user.

## 5. UI/UX Verification Checklist for AI Agents
- [ ] Does this layout pass cognitive friction testing? Can a stressed user complete the primary action in under 3 seconds?
- [ ] Are all touch targets at least 48px with adequate clearance around them?
- [ ] Is the Mobile Money checkout flow explicitly optimized for local network realities (clear steps, clear status cues)?
- [ ] Have you avoided pure clinical white in favor of a soft, human-centric color palette?
