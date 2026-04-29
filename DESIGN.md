---
name: Lumina Noir
colors:
  surface: '#121416'
  surface-dim: '#121416'
  surface-bright: '#37393b'
  surface-container-lowest: '#0c0e10'
  surface-container-low: '#1a1c1e'
  surface-container: '#1e2022'
  surface-container-high: '#282a2c'
  surface-container-highest: '#333537'
  on-surface: '#e2e2e5'
  on-surface-variant: '#c4c6cd'
  inverse-surface: '#e2e2e5'
  inverse-on-surface: '#2f3133'
  outline: '#8e9197'
  outline-variant: '#44474d'
  surface-tint: '#b6c8e4'
  primary: '#fffdff'
  on-primary: '#203148'
  primary-container: '#d0e2ff'
  on-primary-container: '#53647d'
  inverse-primary: '#4e5f78'
  secondary: '#cac2e2'
  on-secondary: '#312d46'
  secondary-container: '#48435e'
  on-secondary-container: '#b8b1d0'
  tertiary: '#f8fffb'
  on-tertiary: '#18362e'
  tertiary-container: '#c7e8dc'
  on-tertiary-container: '#4c6960'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d3e4ff'
  primary-fixed-dim: '#b6c8e4'
  on-primary-fixed: '#091c32'
  on-primary-fixed-variant: '#37485f'
  secondary-fixed: '#e6deff'
  secondary-fixed-dim: '#cac2e2'
  on-secondary-fixed: '#1c1830'
  on-secondary-fixed-variant: '#48435e'
  tertiary-fixed: '#c9eade'
  tertiary-fixed-dim: '#adcdc2'
  on-tertiary-fixed: '#022019'
  on-tertiary-fixed-variant: '#2f4c44'
  background: '#121416'
  on-background: '#e2e2e5'
  surface-variant: '#333537'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 57px
    fontWeight: '600'
    lineHeight: 64px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
    letterSpacing: '0'
  title-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 24px
---

## Brand & Style

This design system is a refined interpretation of the Material You aesthetic, specifically engineered for OLED displays. It prioritizes the "Deep Black" experience, where the physical hardware and the software interface merge seamlessly. The personality is quiet, sophisticated, and highly tactile. 

The style combines **Minimalism** with **Tactile** cues. By using true black (#000000) as the canvas, the UI reduces light emission and maximizes contrast. The emotional response is one of calm focus and premium quality, reminiscent of a high-end physical device. Interactions should feel soft and fluid, utilizing organic motion and expansive corner radii to evoke a friendly yet futuristic digital environment.

## Colors

The palette is rooted in the concept of "Monet" dynamic seeding, focusing on low-chroma pastels that pop against an absolute black void. 

- **Primary (Soft Blue):** Used for key actions and active states. It provides a cool, accessible touchpoint.
- **Secondary (Lavender):** Used for accents and selection highlights, adding a layer of sophisticated warmth.
- **Neutral/Surface:** Unlike standard Material Design which uses dark greys, this system utilizes a "Surface Container" model where the base is #000000. Elevated surfaces use very dark, desaturated tints to maintain high contrast while providing depth. 
- **OLED Optimization:** Pure black is used for the background to ensure pixels are completely off, saving power and creating infinite contrast.

## Typography

This design system utilizes **Inter** for its exceptional legibility on high-resolution screens and its neutral, systematic character. 

The typographic hierarchy is designed to be spacious and clear. Headlines use a medium weight to stand out against the dark background without causing "bloom" (the visual bleeding of light text on black). Tracking is slightly tightened for large display sizes to maintain a modern, tight aesthetic, while body text and labels receive a slight increase in tracking to ensure readability at lower brightness levels.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a heavy emphasis on "Safe Areas" and internal padding. The rhythm is based on a 4px baseline, but most components use 8px increments to ensure a chunky, tactile feel.

Margins are generous (24px) to push content away from the edges of the device, emphasizing the bezel-less feel of modern OLED phones. Vertical rhythm is expansive; sections should feel "airy" despite the dark color scheme. Use "Inner Padding" of at least 20px for cards to ensure content doesn't feel cramped within the large corner radii.

## Elevation & Depth

In an OLED-first system, traditional drop shadows are secondary to **Tonal Layering**. Depth is communicated through:

1.  **Surface Tints:** The background is #000000. Level 1 containers use #121314. Level 2 containers (like floating menus) use #1A1C1E.
2.  **Stroke Overlays:** To prevent dark surfaces from disappearing into each other, a subtle 1px "Inner Stroke" with low opacity (10-15%) white or the primary accent color is used.
3.  **Glow instead of Shadow:** Instead of black shadows, high-elevation elements like primary action buttons may use a very subtle, diffused glow of their own accent color (e.g., a soft blue shadow for a soft blue button) to simulate light emission.

## Shapes

The shape language is defined by **Maximum Roundness**. Inspired by the hardware silhouettes of modern flagship devices, every element feels organic and "pebble-like."

- **Buttons:** Always use `rounded-full` (Pill-shaped) for a friendly, pressable look.
- **Cards & Containers:** Use very large radii (28px to 32px). Small cards may use 24px.
- **Selection Controls:** Checkboxes and radio buttons are fully rounded or use a minimum of 8px radius for a softer appearance than traditional squares.
- **Inputs:** Utilize the pill shape for text fields to maintain consistency with the button language.

## Components

- **Buttons:** Use the Primary Pastel color for the background with high-contrast dark text (#000000) for "Filled" variants. For "Tonal" variants, use the Primary color at 20% opacity. All buttons must be pill-shaped.
- **Cards:** Cards should have no border; they are defined by their subtle #121314 background against the #000000 canvas. Corner radius is fixed at 32px.
- **Chips:** Small, pill-shaped elements used for filtering. When active, they should glow slightly with their accent color.
- **Lists:** Use wide spacing between items. List items should not have dividers; instead, use a subtle background change on press/hover.
- **Inputs:** Pill-shaped containers with a 1px subtle border that illuminates with the Primary color when focused. 
- **Navigation Bar:** A floating pill-shaped container at the bottom of the screen, utilizing a dark translucent surface (Glassmorphism) with a 20px backdrop blur to show content passing underneath.
- **Haptic Feedback:** Though not a visual component, all tactile elements (buttons, switches) should be paired with short, crisp haptic triggers to reinforce the "tactile" brand pillar.