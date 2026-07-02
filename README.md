# Equity Merchants

A real estate listings site built with a Cloudflare Pages frontend and a Cloudflare Worker proxy for Airtable data.

## Built with

- HTML
- CSS
- JavaScript
- Cloudflare Workers
- Cloudflare Pages
- Airtable

## Branding and client configuration

This repo now supports:

- a shared `styles.css` layout and component theme
- a client-specific `brand.css` override file for colors and logos
- a `config.js` file with `businessId`, `siteName`, `logoSrc`, and Airtable worker URL settings
- a single Airtable base filtered by the `Business ID` field

To customize for a client fork, update `config.js` and `brand.css` only.

## Deployment Guide

This site is now set up to use:

- Cloudflare Pages for the frontend
- Cloudflare Workers for the secure Airtable proxy

## Working Modes

There are 3 ways to work with this repo:

1. Local development
   - Use `wrangler dev` in `cloudflare-worker`
   - Open the frontend from your local web server, for example:
   ```bash
   python -m http.server 5173
   ```
   - The app automatically uses the local worker URL from `config.js`
   - Copy `cloudflare-worker/.dev.vars.example` to `cloudflare-worker/.dev.vars`
   - Make sure `ALLOWED_ORIGIN` in `.dev.vars` includes the port you used, including `http://127.0.0.1:8787` if you serve the frontend there

2. Cloudflare Pages preview
   - Open the preview URL that Cloudflare gives you after a Pages deploy
   - The frontend automatically detects the `*.pages.dev` hostname
   - It uses the preview/production worker URL from `config.js`
   - If you host the frontend on a `*.workers.dev` domain instead, add that exact origin to `ALLOWED_ORIGIN` in `cloudflare-worker/wrangler.toml`

3. Production
   - Open your live custom domain
   - The frontend automatically uses the production worker URL from `config.js`
   - Update `ALLOWED_ORIGIN` in `cloudflare-worker/wrangler.toml` if your live domain changes

Important:

- `config.js` is the one file that decides which worker URL to use
- local uses `http://127.0.0.1:8787`
- preview and production should point to your deployed worker URL
- if you add a second worker later for preview, you can set a different preview URL in `config.js`
- if you change your local static server port, update `ALLOWED_ORIGIN` in `cloudflare-worker/.dev.vars`

## Quick Checklist

Use this when switching environments:

1. Local dev
   - `cd cloudflare-worker`
   - copy `.dev.vars.example` to `.dev.vars`
   - fill in Airtable, R2, and local origin values
   - run `wrangler dev`
   - serve the frontend locally on the same origin you added to `ALLOWED_ORIGIN`

2. Cloudflare Pages preview
   - deploy the repo to Pages
   - open the `*.pages.dev` preview URL
   - set `workerBaseUrls.preview` in `config.js` to your worker URL
   - make sure `ALLOWED_ORIGIN` includes the Pages preview domain

3. Production
   - deploy the worker with `wrangler deploy`
   - set `workerBaseUrls.production` in `config.js` to the live worker URL
   - make sure `ALLOWED_ORIGIN` includes your live custom domain

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

## 3. Create the Cloudflare Worker

Inside the `cloudflare-worker` folder in this project:

1. Install Wrangler if needed:

```bash
npm install -g wrangler
```

2. Log in to Cloudflare:

```bash
wrangler login
```

3. Open `cloudflare-worker/wrangler.toml` and replace:

- `ALLOWED_ORIGIN` with your real frontend origin
- `AIRTABLE_BASE_ID` with your Airtable base ID

Examples:

- Cloudflare Pages preview site:
  `https://YOUR-PROJECT.pages.dev`
- Custom domain:
  `https://www.equitymerchants.co.ke`

Important:

- `ALLOWED_ORIGIN` must be the site origin only
- Do not include a path like `/YOUR_REPOSITORY_NAME`

4. Create the Worker secret for your Airtable token:

```bash
cd cloudflare-worker
wrangler secret put AIRTABLE_API_KEY
```

Paste your Airtable personal access token when prompted.

5. Deploy the Worker:

```bash
wrangler deploy
```

After deploy, Cloudflare will give you a Worker URL like:

```text
https://equity-merchants-listings.YOUR-SUBDOMAIN.workers.dev
```

## 4. Image Storage (Cloudflare R2)

Create the image bucket:

```bash
cd cloudflare-worker
wrangler r2 bucket create equity-merchants-images
```

Then enable public access for the bucket in the Cloudflare dashboard and copy the public base URL. Add that URL to `R2_PUBLIC_URL` in `cloudflare-worker/wrangler.toml`, and copy `cloudflare-worker/.dev.vars.example` to `cloudflare-worker/.dev.vars` for local development.

Important:

- the R2 bucket binding must be named `LISTINGS_IMAGES`
- the Airtable `Photo` field must be changed from `Attachment` to `Single line text` or `URL`
- the Worker stores photo URLs as plain text, so Airtable attachments will not work for this flow

For local development, copy `cloudflare-worker/.dev.vars.example` to `cloudflare-worker/.dev.vars` and fill in your real values.

## 5. Connect the frontend to the Worker

Open `config.js` and update `workerBaseUrls`:

- `local` should point at your local `wrangler dev` worker, usually `http://127.0.0.1:8787`
- `preview` should point at your deployed worker URL or a preview-specific worker if you use one
- `production` should point at your live deployed worker URL

The app will choose the right one automatically based on where it is running.

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
3. If your site origin changes, update `ALLOWED_ORIGIN` in `cloudflare-worker/wrangler.toml` and run `wrangler deploy` again.

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
9. Use `wrangler tail` while testing if you need to inspect upload or save errors.

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
- Keep the Airtable token only in the Worker secret.
- If the `Photo` field is still set to `Attachment`, uploads will not save correctly. Change it to text first.
- If listings fail, open browser dev tools and also run:

```bash
cd cloudflare-worker
wrangler tail
```

That will show Worker logs in real time.
