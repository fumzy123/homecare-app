# Care Harbor app icons

`care-harbor-mark.svg` preserves the exact boat, frame and sun geometry from
`admin-frontend/src/shared/components/ui/BoatLogo.tsx`. Colors match the admin
tokens: ink `#111111`, orange `#FF5A1F`, and cream `#F2EEE5`.

PNG exports used by `app.config.js`:

- `icon.png`: 1024 × 1024, opaque cream background; centered 704 × 704 mark.
- `android-icon-foreground.png`: 1024 × 1024, transparent; centered 448 × 448
  mark. The complete square frame fits inside Android's circular safe zone.
- `android-icon-monochrome.png`: the same adaptive layout, white on transparent,
  for Android themed icons.
- `notification-icon.png`: 96 × 96, white on transparent; centered 80 × 80 mark.
- `favicon.png`: 64 × 64, opaque cream; centered 48 × 48 mark.

Export directly from the SVG rather than resizing the screenshot. Do not add
rounded corners to the PNGs; the launcher supplies its own mask. Rebuild and
install the native app to see launcher/notification icon changes on a phone.
