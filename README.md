# Iceland Fall 2026

Choose-your-own-adventure trip planner for Bob, Amanda and Eva (Oct 7–13, 2026).

- `index.html`: the whole front end (no build step).
- `api/`: Vercel serverless functions. They check the trip passcode, then read and write Supabase with the service-role key.
- `lib/weather.js`: pulls forecasts from MET Norway (the data behind yr.no) and aurora Kp from NOAA SWPC. The forecast refreshes when someone opens the app and it is more than 3 hours old. A Vercel Cron job also refreshes it daily at 10:40 UTC.
- `supabase/schema.sql`: creates the tables and loads the three travelers.

## Deploy

1. **Supabase.** Create a new project named `iceland-2026`. Open SQL Editor, paste `supabase/schema.sql`, and click Run. Then go to Project Settings → API and copy the Project URL and the `service_role` key.
2. **GitHub.** Create a new private repo named `iceland-2026`, then push this folder to it:
   ```bash
   cd iceland-2026
   git init && git add . && git commit -m "Iceland trip app"
   git branch -M main
   git remote add origin https://github.com/<you>/iceland-2026.git
   git push -u origin main
   ```
3. **Vercel.** Click Add New → Project, import `iceland-2026`, and leave Framework Preset on "Other". Add these Environment Variables before the first deploy:
   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key from step 1 |
   | `TRIP_PASSCODE` | The code you'll text Amanda and Eva |
   | `CRON_SECRET` | Any long random string |
   | `MET_CONTACT` | An email or website. MET Norway asks for one in the User-Agent. |
4. Click **Deploy**, open the `*.vercel.app` URL, and enter the passcode. The first open fetches a fresh forecast in the background, and new numbers show up about 20 seconds later.

## Local dev

```bash
npm i -g vercel && npm i
vercel link && vercel env pull .env.local
vercel dev
```

## Notes

- Row Level Security is on for every table with no policies, so the public anon key can't read anything. Only the API, which holds the service-role key, can.
- If you change the passcode in Vercel, redeploy. Everyone then gets asked for the new code.
