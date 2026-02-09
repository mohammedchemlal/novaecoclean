NovaEcoClean server

Deployment notes (Hostinger)

Required environment variables:
- DB_HOST
- DB_USER
- DB_PASSWORD
- DB_NAME
- PORT (optional)
 - SUPABASE_URL (push notifications)
 - SUPABASE_SERVICE_ROLE_KEY (push notifications)

Quick deploy steps (Hostinger hPanel):
1. Zip or push the `server` folder and deploy it via Hostinger "Deployments" or upload to File Manager.
2. In hPanel go to "Node.js" (or "Advanced -> Node.js Apps") and create/manage your app pointing to the `server` folder.
3. In the Node.js app settings add the environment variables listed above.
4. Install dependencies and start the app (Hostinger UI or SSH):

```bash
cd server
npm install --production
npm start
```

5. Verify the app is live:

```bash
curl -i https://your-domain-or-temp.hostingersite.com/ping
curl -i https://your-domain-or-temp.hostingersite.com/status
```

Notes:
- Ensure the MySQL server allows connections from Hostinger (if database hosted externally).
- Do not hardcode credentials in code; use env vars.
- For production, secure your DB (use managed DB or restrict IPs) and use hashed passwords + tokens for auth.
 - For push notifications: add the Supabase envs and ensure the `push_tokens` table exists.
