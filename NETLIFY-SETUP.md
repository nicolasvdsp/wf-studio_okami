# Netlify Setup Instructions

## 1. Connect Repository to Netlify

1. Go to [Netlify](https://app.netlify.com) and sign in
2. Click "Add new site" → "Import an existing project"
3. Choose "Deploy with GitHub"
4. Authorize Netlify to access your GitHub account
5. Select the repository: `nicolasvdsp/wf-studio_okami`

## 2. Configure Build Settings

- **Build command**: Leave empty (no build needed)
- **Publish directory**: `.` (root directory)
- Click "Deploy site"

## 3. Get Your Site URL

After deployment, Netlify will give you a URL like:
- `https://random-name-123456.netlify.app`

Or you can set a custom site name in Site settings → General → Site details → Change site name

## 4. Update Loader

Once you have your Netlify URL, update `scripts/loader.js`:

```javascript
const NETLIFY_URL = 'https://your-site-name.netlify.app/scripts/';
```

## 5. Deploy

Every time you push to GitHub, Netlify will automatically:
- Detect the push
- Redeploy your site
- Make new files immediately available (no cache delay!)

## Optional: Custom Domain

If you want to use a custom domain (e.g., `assets.themothership.be`):
1. Go to Site settings → Domain management
2. Add custom domain
3. Follow DNS instructions (you'll need to add a CNAME record)

