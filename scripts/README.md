# Builder's Circle - Setup Scripts

This directory contains automation scripts to help you reconstruct the Builder's Circle infrastructure quickly and reliably.

## Scripts Overview

### 1. setup-appwrite-infrastructure.sh
**Purpose**: Automates the installation of Docker, Docker Compose, and Appwrite on a fresh Ubuntu/Debian server.

**Usage**:
```bash
chmod +x scripts/setup-appwrite-infrastructure.sh
./scripts/setup-appwrite-infrastructure.sh
```

**What it does**:
- Updates system packages
- Installs Docker
- Installs Docker Compose
- Downloads Appwrite
- Starts Appwrite containers
- Verifies installation

**Time**: ~5-10 minutes

**Requirements**:
- Ubuntu 20.04+ or Debian 10+
- Root/sudo access
- Internet connection

---

### 2. create-collections.js
**Purpose**: Automatically creates all required Appwrite database collections with proper schemas, attributes, and indexes.

**Usage**:
```bash
# Install dependencies first
npm install node-appwrite

# Edit configuration
nano scripts/create-collections.js
# Update: endpoint, projectId, apiKey

# Run script
node scripts/create-collections.js
```

**What it does**:
- Creates 8 database collections
- Adds all required attributes
- Creates indexes for performance
- Sets proper permissions
- Provides progress feedback

**Time**: ~5-10 minutes

**Requirements**:
- Node.js installed
- Appwrite running
- Valid API key with database permissions
- Database "69b008400000b872c17a" already created

**Collections Created**:
1. ownership_ledger
2. multipliers
3. build_cycles
4. cycle_participation
5. activity_events
6. notifications
7. user_profiles
8. audit_logs

---

### 3. deploy-functions.sh
**Purpose**: Packages all Appwrite functions into deployable .zip files and provides deployment instructions.

**Usage**:
```bash
chmod +x scripts/deploy-functions.sh
./scripts/deploy-functions.sh
```

**What it does**:
- Creates `deployments/` directory
- Packages computeOwnership function
- Packages stallEvaluator function
- Packages adjustMultiplier function
- Displays deployment instructions

**Time**: ~1 minute

**Output**:
- `deployments/computeOwnership.zip`
- `deployments/stallEvaluator.zip`
- `deployments/adjustMultiplier.zip`

**Next Steps**:
Upload each .zip file via Appwrite Console → Functions → Create Function

---

### 4. verify-setup.js
**Purpose**: Verifies that your Appwrite infrastructure is properly configured and all environment variables are set correctly.

**Usage**:
```bash
# Make sure .env.local exists
cp .env.example .env.local
nano .env.local  # Update with your values

# Run verification
node scripts/verify-setup.js
```

**What it checks**:
- Environment variables are set
- Appwrite connection works
- Database ID is configured
- Collection IDs are configured
- Function IDs are configured

**Time**: ~1 minute

**Output**:
- ✅ Passed checks
- ❌ Failed checks
- ⚠️ Warnings
- Summary report

---

## Setup Order

Follow this order for best results:

1. **setup-appwrite-infrastructure.sh** - Install infrastructure
2. Create Appwrite project manually in Console
3. **create-collections.js** - Setup database
4. **deploy-functions.sh** - Package functions
5. Upload functions manually in Console
6. Configure .env.local
7. **verify-setup.js** - Verify everything works

## Common Issues

### Issue: Permission denied when running .sh scripts
**Solution**:
```bash
chmod +x scripts/*.sh
```

### Issue: node-appwrite not found
**Solution**:
```bash
npm install node-appwrite
```

### Issue: create-collections.js fails with "Invalid API key"
**Solution**:
- Verify API key is correct
- Ensure API key has database permissions
- Check endpoint URL is correct

### Issue: Appwrite not accessible
**Solution**:
```bash
docker ps  # Check if containers are running
cd ~/appwrite && docker-compose restart
```

### Issue: Collection creation times out
**Solution**:
- Wait longer between attribute creation
- Increase timeout in script
- Create collections manually if needed

## Script Configuration

### setup-appwrite-infrastructure.sh
No configuration needed - runs automatically.

### create-collections.js
Edit these values at the top of the file:
```javascript
const CONFIG = {
  endpoint: 'https://your-domain.com/v1',
  projectId: 'YOUR_PROJECT_ID',
  apiKey: 'YOUR_API_KEY',
  databaseId: '69b008400000b872c17a',
};
```

### deploy-functions.sh
No configuration needed - packages all functions automatically.

### verify-setup.js
Reads from `.env.local` - no direct editing needed.

## Dependencies

### System Dependencies
- Docker
- Docker Compose
- Node.js 18+
- npm or yarn
- zip/unzip utilities

### Node.js Dependencies
```bash
npm install node-appwrite dotenv
```

## Troubleshooting

### Script fails with "command not found"
Install missing dependencies:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm zip unzip

# Check versions
node --version  # Should be 18+
npm --version
```

### Script hangs or times out
- Check internet connection
- Verify Appwrite is running
- Check firewall settings
- Review script output for errors

### Collections not created
- Verify database exists first
- Check API key permissions
- Ensure project ID is correct
- Try creating one collection manually to test

## Advanced Usage

### Running scripts on remote server
```bash
# Copy scripts to server
scp -r scripts/ user@server:/path/to/builders-circle/

# SSH into server
ssh user@server

# Run scripts
cd /path/to/builders-circle
./scripts/setup-appwrite-infrastructure.sh
```

### Automating with CI/CD
These scripts can be integrated into CI/CD pipelines:
```yaml
# Example GitHub Actions
- name: Setup Infrastructure
  run: ./scripts/setup-appwrite-infrastructure.sh

- name: Create Collections
  run: node scripts/create-collections.js
  env:
    APPWRITE_ENDPOINT: ${{ secrets.APPWRITE_ENDPOINT }}
    APPWRITE_PROJECT_ID: ${{ secrets.APPWRITE_PROJECT_ID }}
    APPWRITE_API_KEY: ${{ secrets.APPWRITE_API_KEY }}
```

### Custom modifications
Feel free to modify scripts for your needs:
- Add more collections
- Change attribute types
- Adjust timeouts
- Add error handling
- Customize output format

## Support

If you encounter issues:

1. Check script output for error messages
2. Review the main reconstruction guide
3. Verify prerequisites are met
4. Check Appwrite documentation
5. Review function logs in Appwrite Console

## Contributing

To improve these scripts:
1. Test thoroughly
2. Add error handling
3. Update documentation
4. Submit pull request

## License

These scripts are part of the Builder's Circle project and follow the same license.

---

**Happy Building!** 🚀
