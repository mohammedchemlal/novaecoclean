Hostinger PHP API (ping + login)
================================

Files
- `config.sample.php` : sample config with DB credentials (copy to `config.php` and edit values).
- `ping.php` : simple healthcheck (`/api/ping.php`).
- `login.php` : login endpoint (`/api/login.php`) — expects JSON body `{ "email": "...", "password": "..." }`.

Deployment steps
1. Upload the `hostinger_api` folder contents to `public_html/api/` on your Hostinger account (File Manager or FTP).
2. In `public_html/api/` copy `config.sample.php` to `config.php` and update the DB credentials.
3. Test endpoints from your machine:
   - `curl -i https://your-temp-domain.hostingersite.com/api/ping.php`
   - `curl -i -X POST https://your-temp-domain.hostingersite.com/api/login.php -H "Content-Type: application/json" -d '{"email":"EMAIL","password":"PASSWORD"}'`

Security notes
- This example checks passwords directly against the DB. For production, store hashed passwords (bcrypt) and verify with `password_verify()`.
- Keep `config.php` secret and do not commit it to version control.
- Consider adding an API key header check or rate limiting.

Update mobile app
- Set `DEFAULT_API` in `LoginScreen.tsx` to `https://your-temp-domain.hostingersite.com/api` and the app will call `/ping.php` and `/login.php`.
