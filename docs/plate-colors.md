# Plate color data

`src/lib/plateTheme.ts` contains one foreground/background pair for every
jurisdiction in the app. The pair is a compact visual theme, not a claim that
every plate issued by that jurisdiction has the same design.

## North America

The United States and Canadian entries represent the current standard
passenger plate. For scenic or photographic plates, the foreground is the
serial color and the background is the dominant light field behind the serial.

Primary references:

- [VehiclesDB plate dataset](https://github.com/vehiclesdb/vehiclesdb/tree/main/plates)
  (CC BY 4.0), which records per-series `design.foreground` and
  `design.background.color` values where a defensible value is available.
- [Current United States plate designs](https://en.wikipedia.org/wiki/United_States_license_plate_designs_and_serial_formats)
  for current-issue selection and named color/design descriptions.
- [Current Canadian plate designs](https://en.wikipedia.org/wiki/Canadian_licence_plate_designs_and_serial_formats)
  for current-issue selection and named color/design descriptions.

Mexican plate artwork is chosen by each state and commonly changes on a
three-year replacement cycle. The themes use the current passenger designs
shown in this [2025 state-by-state survey](https://www.unotv.com/nacional/placas-vehiculares-en-mexico-asi-son-los-disenos-de-cada-estado/),
with the serial color where it is documented and the dominant plate field as
the background. Mexico's federal standard explicitly leaves foreground,
background, and legend colors to the states, so these entries need periodic
review.

## Europe

Most European standard plates are black on white, which would make the app's
European section visually uniform. These entries therefore use two recognizable
colors from each country's national flag, as a deliberate product treatment.

## Maintenance

Review the table when a jurisdiction introduces a new standard issue. Keep text
and background contrast high enough that the jurisdiction code remains easy to
read; graphic artwork is intentionally reduced to a flat representative field.
