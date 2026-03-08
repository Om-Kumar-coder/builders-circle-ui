# 🏗️ Builder's Circle - Infrastructure Reconstruction

> **Complete guide to rebuilding your Builder's Circle platform after infrastructure loss**

## 🚨 Situation

Your VPS was reset and all infrastructure was lost. This repository contains everything needed to fully reconstruct the backend and redeploy the platform.

## ✅ What's Included

This reconstruction package provides:

- ✅ **Complete Documentation** - Step-by-step guides for all phases
- ✅ **Automation Scripts** - Reduce manual work and prevent errors
- ✅ **Database Schemas** - All 8 collections with complete specifications
- ✅ **Function Code** - 3 serverless functions ready to deploy
- ✅ **Configuration Templates** - Environment variables and settings
- ✅ **Verification Tools** - Ensure everything is working correctly
- ✅ **Checklists** - Track your progress through reconstruction

## 📚 Documentation

### Start Here

1. **[RECONSTRUCTION_SUMMARY.md](RECONSTRUCTION_SUMMARY.md)** - Overview of what was analyzed and created
2. **[QUICK_START_RECONSTRUCTION.md](QUICK_START_RECONSTRUCTION.md)** - Fast track guide (~60 minutes)
3. **[INFRASTRUCTURE_RECONSTRUCTION_GUIDE.md](INFRASTRUCTURE_RECONSTRUCTION_GUIDE.md)** - Complete detailed guide
4. **[RECONSTRUCTION_CHECKLIST.md](RECONSTRUCTION_CHECKLIST.md)** - Track your progress

### Choose Your Path

**🚀 Fast Track** (Experienced users, ~60 minutes)
- Follow: `QUICK_START_RECONSTRUCTION.md`
- Use automation scripts
- Minimal explanation

**📖 Complete Guide** (All users, ~2-3 hours)
- Follow: `INFRASTRUCTURE_RECONSTRUCTION_GUIDE.md`
- Detailed explanations
- Troubleshooting included

**✅ Checklist Mode** (Methodical approach)
- Follow: `RECONSTRUCTION_CHECKLIST.md`
- Check off each item
- Ensure nothing is missed

## 🛠️ Automation Scripts

Located in `scripts/` directory:

1. **setup-appwrite-infrastructure.sh** - Install Docker, Docker Compose, and Appwrite
2. **create-collections.js** - Create all database collections automatically
3. **deploy-functions.sh** - Package functions for deployment
4. **verify-setup.js** - Verify your configuration is correct

See [scripts/README.md](scripts/README.md) for detailed usage.

## ⚡ Quick Start

### Prerequisites
- Ubuntu/Debian VPS with 2GB+ RAM
- Root/sudo access
- Domain name (optional)

### 5-Minute Setup

```bash
# 1. Install infrastructure
chmod +x scripts/setup-appwrite-infrastructure.sh
./scripts/setup-appwrite-infrastructure.sh

# 2. Access Appwrite Console
# Open: http://YOUR_SERVER_IP
# Create admin account and project

# 3. Create database collections
npm install node-appwrite
# Edit scripts/create-collections.js with your credentials
node scripts/create-collections.js

# 4. Package functions
chmod +x scripts/deploy-functions.sh
./scripts/deploy-functions.sh

# 5. Upload functions via Appwrite Console
# Upload files from deployments/ folder

# 6. Configure frontend
cp .env.example .env.local
# Edit .env.local with your values

# 7. Deploy frontend
npm install
npm run build
npm install -g pm2
pm2 start npm --name "builders-circle" -- start

# 8. Verify setup
node scripts/verify-setup.js
```

## 📋 System Architecture

### Database Collections (8)
- `ownership_ledger` - Ownership tracking
- `multipliers` - Multiplier history
- `build_cycles` - Project cycles
- `cycle_participation` - User participation
- `activity_events` - Activity submissions
- `notifications` - User notifications
- `user_profiles` - User data
- `audit_logs` - Admin actions

### Appwrite Functions (3)
- `computeOwnership` - Calculate ownership (on-demand)
- `stallEvaluator` - Evaluate inactivity (daily 2 AM)
- `adjustMultiplier` - Adjust multipliers (daily 3 AM)

### Tech Stack
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Appwrite (self-hosted)
- **Functions**: Node.js 22
- **Infrastructure**: Docker, Nginx, PM2

## 🎯 Reconstruction Phases

1. **Infrastructure** - Install Docker and Appwrite
2. **Project Setup** - Create project and API keys
3. **Database** - Create collections and schemas
4. **Functions** - Deploy serverless functions
5. **Cron Jobs** - Configure scheduled tasks
6. **Permissions** - Set access controls
7. **Frontend** - Configure environment
8. **Deployment** - Build and deploy
9. **Verification** - Test all features
10. **Production** - Security and monitoring

## ⏱️ Time Estimates

- **Quick Start**: 60 minutes
- **Full Setup**: 2-3 hours
- **Production Ready**: 4-6 hours (with testing)

## 🔐 Security Checklist

- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] API keys secured
- [ ] Permissions reviewed
- [ ] Backups configured
- [ ] Monitoring setup

## 📊 Success Criteria

Your reconstruction is complete when:

- ✅ Appwrite Console accessible
- ✅ All collections created
- ✅ All functions deployed
- ✅ Frontend connects to backend
- ✅ Users can signup/login
- ✅ Cycles can be created
- ✅ Activities can be submitted
- ✅ Ownership computation works
- ✅ Automated functions run

## 🆘 Troubleshooting

### Appwrite not accessible
```bash
docker ps
cd ~/appwrite && docker-compose restart
```

### Function execution fails
- Check environment variables
- Verify API key permissions
- Review function logs in Console

### Frontend can't connect
- Verify .env.local configuration
- Check Appwrite is running
- Verify project ID matches

### Database errors
- Verify collections exist
- Check permissions
- Review collection IDs

See full troubleshooting guide in `INFRASTRUCTURE_RECONSTRUCTION_GUIDE.md`

## 📞 Support Resources

- **Documentation**: See files listed above
- **Appwrite Docs**: https://appwrite.io/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Appwrite Discord**: https://appwrite.io/discord

## 🗂️ File Structure

```
builders-circle/
├── 📄 README_RECONSTRUCTION.md          # This file
├── 📄 RECONSTRUCTION_SUMMARY.md         # What was created
├── 📄 QUICK_START_RECONSTRUCTION.md     # Fast track guide
├── 📄 INFRASTRUCTURE_RECONSTRUCTION_GUIDE.md  # Complete guide
├── 📄 RECONSTRUCTION_CHECKLIST.md       # Progress tracker
├── 📄 .env.production.template          # Config template
├── 📁 scripts/
│   ├── 📄 README.md                     # Scripts documentation
│   ├── 🔧 setup-appwrite-infrastructure.sh
│   ├── 🔧 create-collections.js
│   ├── 🔧 deploy-functions.sh
│   └── 🔧 verify-setup.js
├── 📁 functions/
│   ├── 📁 computeOwnership/
│   ├── 📁 stallEvaluator/
│   └── 📁 adjustMultiplier/
├── 📁 src/
│   ├── 📁 components/
│   ├── 📁 lib/
│   ├── 📁 hooks/
│   └── 📁 types/
└── 📁 app/
```

## 🚀 Next Steps

1. **Choose your guide** - Quick Start or Complete Guide
2. **Run setup scripts** - Automate infrastructure setup
3. **Follow checklist** - Track your progress
4. **Verify setup** - Run verification script
5. **Test thoroughly** - Ensure everything works
6. **Go live** - Deploy to production

## 💡 Tips

- **Use automation scripts** - They save time and prevent errors
- **Follow the checklist** - Don't skip steps
- **Test incrementally** - Verify each phase before moving on
- **Keep credentials safe** - Store API keys securely
- **Document changes** - Note any customizations
- **Backup regularly** - Once running, setup automated backups

## 📈 Estimated Costs

- **VPS**: $5-20/month (2GB RAM minimum)
- **Domain**: $10-15/year (optional)
- **SSL**: Free (Let's Encrypt)
- **Total**: ~$5-30/month

## 🎓 Learning Resources

- **Appwrite**: https://appwrite.io/docs
- **Next.js**: https://nextjs.org/docs
- **Docker**: https://docs.docker.com
- **Node.js**: https://nodejs.org/docs

## 🤝 Contributing

Found an issue or improvement?
1. Document the problem
2. Test your solution
3. Update documentation
4. Submit pull request

## 📝 License

This project follows the Builder's Circle license.

---

## 🎉 Ready to Rebuild?

1. **Read**: Start with `RECONSTRUCTION_SUMMARY.md`
2. **Choose**: Pick Quick Start or Complete Guide
3. **Execute**: Run the scripts and follow the guide
4. **Verify**: Use the verification script
5. **Launch**: Deploy and go live!

**Your Builder's Circle platform will be back online soon!** 🚀

---

**Questions?** Check the troubleshooting sections in the guides or consult the Appwrite documentation.

**Good luck with your reconstruction!** 💪
