# P18 analytics visual evidence

Desktop (1440px) and phone (390px) captures use synthetic daily counts and link titles from the disposable qrwty HTTP fixture. Inspecting these captures confirmed readable HTML date/peak labels, bounded chart/table presentation and usable mouse controls. The shared metric cards were corrected after axe detected invalid definition-list markup; the final accessibility/overflow checks passed at both widths.

Reproduce with `pnpm --filter qrwty-web test` in the adopted consumer checkout. Screenshots are written to `/tmp/jeeves-p18-screenshots/`. These workflow checks cover 503/retry, late range responses, explicit custom apply, invalid range disabling, all 30 table rows and the two shown viewports. Separate fixed acceptance exercises actual API/Postgres counts and owner isolation. No real account data appears here; this is bounded Chromium evidence, not universal accessibility/device certification.
