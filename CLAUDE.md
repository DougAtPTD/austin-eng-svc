# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Portfolio/business website for Austin Smith Engineering Services — a custom automotive product development consultancy. The site showcases engineering services, featured projects, and provides a contact form.

## Architecture

This is a **single-file static site**. Everything lives in `index.html`:

- **Lines 1–950**: All CSS in an inline `<style>` block (no external stylesheets)
- **Lines 950–1280**: HTML structure with sections: Hero, Services, Projects, Process, About, Contact, Footer
- **Lines 1283–1344**: All JavaScript in an inline `<script>` block (no external scripts)

There is no build system, package manager, or framework. Changes are made directly to `index.html`.

## Development

To preview the site, open `index.html` in a browser:
```
open index.html
```

No build step, no dev server required. For live-reload during development, use any static file server (e.g., `python3 -m http.server`).

## Key Design Decisions

- **Dark theme** with CSS custom properties defined in `:root` (line 14–30). Accent color is `#FF6B35`.
- **Typography**: Chakra Petch (headings), IBM Plex Sans (body), IBM Plex Mono (labels/nav) — loaded from Google Fonts.
- **Scroll animations**: IntersectionObserver-based reveal system — elements with class `.reveal` animate in when scrolled into view.
- **Mobile responsive**: Hamburger menu for mobile nav, responsive grid layouts. Mobile breakpoint styles start around line 900.
- **Contact form**: Uses `mailto:` link as submission method (no backend). The form handler at line 1331 constructs a mailto URL.
- **Images**: Static project images in `images/` directory. All use `loading="lazy"`.

## Sections and Their IDs

`#services`, `#projects`, `#process`, `#about`, `#contact` — used for nav anchor links and smooth scrolling.
