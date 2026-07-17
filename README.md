# Equity Merchants

A real estate listings site built for Cloudflare Pages with Pages Functions, Airtable, and R2-backed image uploads.

## Stack

- HTML
- CSS
- JavaScript
- Cloudflare Pages
- Cloudflare Pages Functions
- Airtable
- Cloudflare R2

## How the repo is structured

This repo uses the root as the Cloudflare Pages site:

- static frontend files live at the repo root
- Pages Functions live in `functions/`
- `config.js` contains shared frontend logic only
- `client-config.js` contains the tenant-specific branding and Airtable values
- `wrangler.toml` is the local Pages and deployment config reference

There is also a legacy standalone Worker project in `cloudflare-worker/`. It is kept only as reference and is not the current deployment path.

## Branding and tenant configuration

The tenant-specific values currently live in `client-config.js`:

- site and brand names
- logo and favicon paths
- WhatsApp, email, and address details
- Airtable base and table identifiers
- the active listing status and field labels

The shared logic in `config.js` reads that config and applies it across all pages.

For a new client, copy `client-config.js`, update the values, and deploy that version as its own Cloudflare Pages project or preview branch.

## Cloudflare onboarding flow

Use this as the working model for each tenant.

1. Clone or duplicate the repo for the new client.
2. Update `client-config.js` with that client's branding and Airtable details.
3. In Cloudflare Pages, create a new project from the repo or connect the tenant branch.
4. Add the backend values for that tenant in the Pages project settings:
   - `AIRTABLE_API_KEY` as a secret
   - `AIRTABLE_BASE_ID`
   - `AIRTABLE_TABLE_NAME`
   - `R2_PUBLIC_URL`
5. Make sure the Pages project has the `LISTINGS_IMAGES` R2 binding.
6. Deploy.
7. Open `admin.html` to manage listings and `form.html` to add or edit records.

What happens at runtime:

- the browser loads `client-config.js` first
- `config.js` uses that data to brand the UI and build tenant-aware API URLs
- the frontend calls same-origin `/api` routes
- Pages Functions read the tenant's Airtable and R2 configuration from Cloudflare env vars
- listings are filtered by `Business ID` so one shared codebase can serve multiple tenants safely

## Local development

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Fill in Airtable and R2 values for the tenant you want to test.
3. Run:

```bash
wrangler pages dev .
```

Local dev uses the same root structure as Cloudflare Pages, so the frontend and API stay on one origin and no CORS setup is needed.

## Cloudflare Pages functions

The backend lives in `functions/` at the repo root.

- `functions/api/listings.js` handles listing reads and saves
- `functions/api/listings/[id].js` handles single-record lookups
- `functions/api/upload.js` handles image uploads to R2
- `functions/_shared/airtable.js` contains Airtable, validation, and upload helpers
- `functions/_routes.json` limits function invocation to `/api/*`

## Airtable setup

Create one Airtable base and table named `Listings` for each tenant.

Use these field names exactly unless you also update `client-config.js`:

- `Property Name`
- `Location`
- `Price`
- `Type`
- `Description`
- `Status`
- `Photo`

Only records with `Status` set to `Active` are returned by the API.

Important:

- the Airtable `Photo` field should be text or URL, not Attachment
- the backend stores photo URLs as plain text
- `Business ID` is the tenant filter that keeps listings separated

## Cloudflare R2

1. Create the image bucket.
2. Keep the bucket public.
3. Set the public base URL in `R2_PUBLIC_URL`.
4. Bind the bucket as `LISTINGS_IMAGES`.

If you change the bucket name, update both `wrangler.toml` and the Cloudflare Pages binding.

## Admin page

The client-facing admin page is `admin.html`.

Open `admin.js` and update:

- `AIRTABLE_EDITOR_URL`
- `AIRTABLE_ADD_FORM_URL`
- `AIRTABLE_BASE_URL`

Recommended Airtable setup for onboarding:

- create a grid view called `Website Listings`
- show only the columns the client needs
- share that view or invite the client as a collaborator if they need edit access
- create a separate Airtable form for new listings and paste that URL into `AIRTABLE_ADD_FORM_URL`

## Deploying to Cloudflare

1. In Cloudflare, open `Workers & Pages > Pages`.
2. Create a Pages project and connect this repository or branch.
3. Leave the build command empty.
4. Set the build output directory to `/`.
5. Add the environment variables and secrets listed above.
6. Deploy the project.

The live site will be served from the `.pages.dev` domain unless you attach a custom domain.

## Validation checklist

After deployment:

1. Open the live site and confirm the branding matches the tenant.
2. Confirm listings load from Airtable.
3. Confirm only `Active` listings appear.
4. Open `form.html` and save a test listing.
5. Confirm the saved listing appears in Airtable and in `detail.html`.
6. Test an image upload and confirm the URL is returned from R2.
7. Check the Pages Functions logs if any request fails.

## Notes

- Do not put the Airtable token in the frontend.
- Keep `AIRTABLE_API_KEY` only in Cloudflare secrets or `.dev.vars`.
- If listings fail in production, test the same route locally with `wrangler pages dev .`.
- The legacy `cloudflare-worker/` app is not part of the current onboarding flow.
