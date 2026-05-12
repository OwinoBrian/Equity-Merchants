# Equity Merchants Deployment Guide

This site is now set up to use:

- GitHub Pages for the frontend
- Cloudflare Workers for the secure Airtable proxy

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

- GitHub Pages project site:
  `https://YOUR_GITHUB_USERNAME.github.io`
- GitHub Pages repository site:
  `https://YOUR_GITHUB_USERNAME.github.io`
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

## 4. Connect the frontend to the Worker

Open `script.js` and replace:

```js
const LISTINGS_API_URL = "YOUR_CLOUDFLARE_WORKER_URL_HERE";
```

with your real Worker URL, for example:

```js
const LISTINGS_API_URL = "https://equity-merchants-listings.example.workers.dev";
```

## 5. Publish the frontend to GitHub Pages

1. Push this repository to GitHub.
2. In the GitHub repository, open `Settings > Pages`.
3. Under `Build and deployment`, choose:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. Save.

GitHub Pages will publish your site at:

```text
https://YOUR_GITHUB_USERNAME.github.io/REPOSITORY_NAME/
```

## 6. If you use a custom domain

1. Buy the domain from a registrar.
2. In GitHub Pages settings, add the custom domain.
3. Update your DNS records as GitHub instructs.
4. If your site origin changes, update `ALLOWED_ORIGIN` in `cloudflare-worker/wrangler.toml` and run `wrangler deploy` again.

## 7. Test everything

After deployment:

1. Open the live website.
2. Go to the `Available Properties` section.
3. Confirm listings load.
4. Confirm only `Active` listings appear.
5. Confirm cards still work when a listing has no image.

## Notes

- Do not put the Airtable token in `script.js`.
- Keep the Airtable token only in the Worker secret.
- If listings fail, open browser dev tools and also run:

```bash
cd cloudflare-worker
wrangler tail
```

That will show Worker logs in real time.
