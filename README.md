# Equity Merchants

A real estate listings site built as a single Cloudflare Pages project with Pages Functions for Airtable and R2-backed uploads.

## Built with

- HTML
- CSS
- JavaScript
- Cloudflare Pages
- Cloudflare Pages Functions
- Airtable

## Branding and client configuration

This repo now supports:

- a shared `styles.css` layout and component theme
- a client-specific `brand.css` override file for colors and logos
- a `config.js` file with `businessId`, `siteName`, `logoSrc`, and shared API helpers
- a single Airtable base filtered by the `Business ID` field
- a single Pages Functions backend in `functions/api`

To customize for a client fork, update `config.js` and `brand.css` only.

## Deployment Guide

This site is now set up to use:

- Cloudflare Pages for the frontend
- Cloudflare Pages Functions for the secure Airtable and upload API
- Cloudflare R2 for image storage

## Working Modes

There are 2 ways to work with this repo:

1. Local development
   - Copy `.dev.vars.example` to `.dev.vars`
   - Run:
   ```bash
   wrangler pages dev .
   ```
   - The frontend and API share one origin, so there is no separate worker URL and no CORS setup to manage

2. Preview or production
   - Deploy the repo as a Cloudflare Pages project
   - Set `AIRTABLE_API_KEY` as a secret in the Pages project or with Wrangler before deployment
   - Keep `wrangler.toml` at the repo root as the source of truth for the Pages Functions bindings

Important:

- `config.js` now points the frontend at the same-origin `/api` endpoints
- `functions/api/listings.js` handles listing reads and saves
- `functions/api/upload.js` handles image uploads to R2
- `functions/_routes.json` limits Function invocations to `/api/*`

## Quick Checklist

Use this when switching environments:

1. Local dev
   - copy `.dev.vars.example` to `.dev.vars`
   - fill in Airtable and R2 values
   - run `wrangler pages dev .`

2. Cloudflare Pages preview
   - deploy the repo to Pages
   - open the `*.pages.dev` preview URL
   - set `AIRTABLE_API_KEY` in the Pages project secrets or with Wrangler before deploy

3. Production
   - deploy the Pages project
   - keep the root `wrangler.toml` bindings in sync with the dashboard

## 1. Prepare Airtable

Create a base and table named `Listings`.

Use these field names exactly:

- `Property Name`
- `Location`
- `Price`
- `Type`
- `Description`
- `Status`
- `Photo`

Only records with `Status` set to `Active` are returned by the API.

## 2. Create an Airtable personal access token

In Airtable:

1. Open the Developer Hub.
2. Create a Personal Access Token.
3. Give it read access to records.
4. Give it access to the base that contains `Listings`.

You will need:

- `AIRTABLE_API_KEY` which is your Airtable personal access token
- `AIRTABLE_BASE_ID` which looks like `appXXXXXXXXXXXXXX`

## 3. Configure Pages Functions

The backend lives in `functions/` at the repo root.

1. The main listing endpoint is `functions/api/listings.js`.
2. The single-record endpoint is `functions/api/listings/[id].js`.
3. The image upload endpoint is `functions/api/upload.js`.
4. Shared Airtable and R2 helpers live in `functions/_shared/airtable.js`.
5. Route invocation is limited to `/api/*` by `functions/_routes.json`.

## 4. Image Storage (Cloudflare R2)

Create the image bucket and keep it public:

```bash
wrangler r2 bucket create equity-merchants-images
```

Then enable public access for the bucket in the Cloudflare dashboard and copy the public base URL. Add that URL to `R2_PUBLIC_URL` in the root `wrangler.toml`.

Important:

- the R2 bucket binding must be named `LISTINGS_IMAGES`
- the Airtable `Photo` field must be changed from `Attachment` to `Single line text` or `URL`
- the Worker stores photo URLs as plain text, so Airtable attachments will not work for this flow

For local development, copy `.dev.vars.example` to `.dev.vars` and fill in your real values.

## 5. Connect the frontend to the API

Open `config.js` and update the branding fields only:

- `businessId`
- `siteName`
- `logoSrc`
- Airtable field names if your table uses different labels

The app now talks to same-origin `/api` routes automatically.

## 6. Publish the frontend to Cloudflare Pages

1. In Cloudflare, open `Workers & Pages > Pages`.
2. Create a new Pages project and connect this repository.
3. Set the build settings:
   - Build command: leave empty
   - Build output directory: `/`
4. Deploy.

Cloudflare Pages will publish your site at:

```text
https://YOUR-PROJECT.pages.dev
```

## 7. If you use a custom domain

1. Add the custom domain in the Cloudflare Pages project.
2. Update DNS in Cloudflare if prompted.
3. If your site origin changes, update the Pages project custom domain settings and redeploy.

## 8. Test everything

After deployment:

1. Open the live website.
2. Go to the `Available Properties` section.
3. Confirm listings load.
4. Confirm only `Active` listings appear.
5. Confirm cards still work when a listing has no image.
6. Open `form.html`, choose multiple image files, and save a new listing.
7. Confirm the saved listing appears in Airtable as plain text URLs in the `Photo` field.
8. Open the detail page and confirm the gallery shows the uploaded images.
9. Use the Cloudflare Pages Functions logs while testing if you need to inspect upload or save errors.

## 9. Set up the client admin page

This project now includes `admin.html`, which is a simple client-facing management page.

Open `admin.js` and replace:

- `AIRTABLE_EDITOR_URL`
- `AIRTABLE_ADD_FORM_URL`
- `AIRTABLE_BASE_URL`

Recommended Airtable setup:

- Create a grid view called `Website Listings`
- Show only the columns the client needs:
  `Property Name`, `Location`, `Price`, `Type`, `Status`, `Description`, `Photo`
- Share that view or invite the client as a collaborator if they need edit/delete access
- Create a separate Airtable form for adding new listings, then paste its URL into `AIRTABLE_ADD_FORM_URL`

## Notes

- Do not put the Airtable token in `script.js`.
- Keep the Airtable token only in the Pages secret.
- If the `Photo` field is still set to `Attachment`, uploads will not save correctly. Change it to text first.
- If listings fail, open browser dev tools and also run:

```bash
wrangler pages dev .
```

That will show Pages Functions logs in real time while you test locally.
