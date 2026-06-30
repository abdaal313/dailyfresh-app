# Security Guidelines for DairyFresh Production

## 🔐 Critical Security Practices

### 1. Environment Variables
✅ **ALWAYS** use `.env` file for sensitive data
- Database credentials
- Email passwords
- Admin password
- API keys
- Session secrets

❌ **NEVER** commit `.env` file to git
✅ Use `.env.example` to show what variables are needed

### 2. Database Security
✅ Use strong, unique database passwords
✅ Limit database user permissions
✅ Use parameterized queries (already implemented)
✅ Regularly backup database

❌ Never use default passwords
❌ Never hardcode credentials in code

### 3. Email Security
✅ Use Gmail App Passwords (2FA enabled)
✅ Consider using SendGrid or other services for production
✅ Rotate email credentials regularly

❌ Never use personal email passwords directly
❌ Never log email credentials

### 4. Admin Panel Security
✅ Change default admin password immediately
✅ Use strong, complex passwords
✅ Consider implementing:
  - Rate limiting on login attempts
  - Two-factor authentication (2FA)
  - Session timeout
  - IP whitelisting

❌ Never share admin password
❌ Never use simple passwords

### 5. File Upload Security
✅ Validate file types (implemented)
✅ Limit file size (implemented)
✅ Store files outside web root if possible
✅ Scan uploads for malware

❌ Never allow executable files
❌ Never trust client-side validation alone

### 6. API Security
✅ All sensitive endpoints should require authentication
✅ Implement rate limiting
✅ Use HTTPS in production
✅ Validate all inputs
✅ Use CORS properly

❌ Never expose sensitive data in error messages
❌ Never log sensitive information

### 7. Code Security
✅ Remove all debug logs (done)
✅ Use error handling without exposing internals
✅ Validate and sanitize all inputs
✅ Use prepared statements for queries (implemented)

❌ Never hardcode secrets
❌ Never log sensitive data
❌ Never expose stack traces to users

### 8. Deployment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Create `.env` file with all variables
- [ ] Remove `.env.example` from production server
- [ ] Ensure `.gitignore` is in place
- [ ] Run `npm install --only=production`
- [ ] Use HTTPS/SSL certificate
- [ ] Enable CORS with specific domains
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Use process manager (PM2, forever, etc.)
- [ ] Set up monitoring and logging
- [ ] Regular security audits

### 9. Monitoring & Logging
✅ Log important events (orders, logins)
✅ Use external logging service
✅ Monitor for suspicious activity
✅ Set up alerts

❌ Don't log passwords or sensitive data
❌ Don't log full error traces to users

### 10. Regular Maintenance
✅ Keep dependencies updated
✅ Monitor for security vulnerabilities: `npm audit`
✅ Rotate credentials regularly
✅ Review access logs
✅ Update database backups

## Environment Variables Setup

1. Copy `.env.example` to `.env`
2. Fill in all variables with production values:
```bash
cp .env.example .env
nano .env  # Edit with your values
```

3. Ensure `.env` is in `.gitignore` (already configured)

## Running in Production

```bash
# Install dependencies
npm install

# Set production environment
export NODE_ENV=production

# Run server
npm start
```

Or use PM2:
```bash
npm install -g pm2
pm2 start server-production.js --name "dairyfresh"
pm2 save
pm2 startup
```

## Incident Response

If credentials are compromised:
1. Immediately rotate all passwords
2. Check database for unauthorized access
3. Review recent logs
4. Update credentials in `.env`
5. Restart server
6. Notify users if necessary

## Support

For security concerns:
- DO NOT publicly disclose vulnerabilities
- Report issues to: security@dairyfresh.com
- Follow responsible disclosure practices

---

Last Updated: 2026-06-27
Security Level: Production Ready ✅