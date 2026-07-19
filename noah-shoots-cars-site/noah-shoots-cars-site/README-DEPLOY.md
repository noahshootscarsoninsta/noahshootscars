# Getting your site online — step by step

Everything in this folder is your finished website. It costs $0 to put online. This guide walks through every step — no coding needed after this point.

You'll create two free accounts along the way (GitHub and Netlify). I can't create accounts for you, but everything else here is just clicking buttons.

## 1. Create a free GitHub account

GitHub is just free storage for your website's files, with a "publish" button built in.

1. Go to github.com and sign up (free).
2. Once logged in, click the **+** in the top right → **New repository**.
3. Name it something like `noah-shoots-cars-site`. Keep it **Public**. Don't check any of the boxes (no README, no .gitignore). Click **Create repository**.

## 2. Upload your site files

1. On your new (empty) repository page, click **uploading an existing file**.
2. Drag this entire folder's contents into the browser window (all the files and folders: `index.html`, `portfolio.html`, `css`, `js`, `content`, `admin`, `images`, etc.) — not the outer folder itself, the things *inside* it.
3. Scroll down, click **Commit changes**.

## 3. Create a free Netlify account and connect it

Netlify is what actually puts your site on the internet and gives it a URL.

1. Go to netlify.com and sign up — choose **Sign up with GitHub**, it's the easiest option since it connects automatically.
2. Click **Add new site** → **Import an existing project** → **GitHub** → pick the `noah-shoots-cars-site` repo you just made.
3. It'll ask for build settings — leave everything blank/default (no build command, publish directory is the root `/`). Click **Deploy**.
4. After a minute, you'll get a live URL like `random-name-123.netlify.app`. Click it — your site is live! (You can rename this to something nicer under **Site settings → Change site name**.)

## 4. Turn on your photo-uploading admin panel

This connects the `/admin` page in your site to your Netlify account so you can log in and add photos.

1. In Netlify, open your site → **Site settings** (or **Site configuration**) → **Identity** → click **Enable Identity**.
2. Still in Identity settings, find **Registration** and set it to **Invite only** (so random people online can't sign up).
3. Scroll to **Services** → find **Git Gateway** → click **Enable Git Gateway**.
4. Go to the **Identity** tab (not settings — the main tab for your site) → **Invite users** → enter your own email address → send the invite.
5. Check your email, click the invite link, set a password.

That's it — now go to `yoursite.netlify.app/admin`, log in with the password you just set, and you'll see three easy sections: **Home Page — Hero Photo**, **Home Page — Featured Work**, **Portfolio Photos**, and **Photographer Photo**. Click into any of them, drag a photo in, hit **Publish** — your live site updates within about a minute.

## 5. Connect your GoHighLevel form (so leads land in your CRM)

1. In GoHighLevel: **Sites → Forms** → pick or create your contact form → **Integrate** tab → **Copy Code**.
2. Back in GitHub, open `contact.html`, click the pencil (edit) icon.
3. Find this section near the bottom:
   ```html
   <div class="ghl-form-slot" id="ghlFormSlot">
     <strong style="color:var(--text);">GoHighLevel form goes here.</strong>
     ...
   </div>
   ```
4. Delete that whole `<div class="ghl-form-slot">...</div>` block and paste your copied GHL embed code in its place.
5. Scroll down, **Commit changes**. Netlify automatically re-publishes your site within a minute or two whenever you save a change in GitHub.

Do the same thing for a GoHighLevel calendar embed if you want online booking — **Calendars → (pick calendar) → Share → Embed Code**, paste it wherever you'd like it to show up.

## 6. Connect your real domain name (whenever you're ready)

Whenever you have (or already own) a domain like `noahshootscars.com`:

1. Netlify → **Domain settings** → **Add a domain**.
2. Follow the on-screen instructions — Netlify will tell you exactly what to change at your domain registrar (usually one or two DNS records). SSL (the padlock/https) is automatic and free.

## That's the whole setup

After this, your day-to-day workflow is just: go to `yoursite.netlify.app/admin` (or your real domain + `/admin`), log in, add photos. Everything else — the design, the layout, the GHL connection — stays as-is.

If anything in here trips you up, come back and tell me exactly where you got stuck and I'll help sort it out.
