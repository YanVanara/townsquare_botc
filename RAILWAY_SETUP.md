# 🚂 Railway Deployment Setup - TownSquare

## ✅ Files Created

Your repository now has all the necessary configuration files for Railway:

- ✅ `railway.json` - Railway configuration
- ✅ `Procfile` - Process definition
- ✅ `nixpacks.toml` - Build configuration
- ✅ `.railwayignore` - Files to ignore during deployment
- ✅ `ENV_VARIABLES.md` - Environment variables guide
- ✅ `package.json` - Updated with production scripts

## 🎯 Deployment Strategy

You'll deploy **TWO separate services** from this repository:

### Service 1: WebSocket Server
- **Start Command**: `npm run start:websocket`
- **Port**: 8080 (WebSocket server)
- **Environment**: `NODE_ENV=production`

### Service 2: Frontend (Vue.js)
- **Start Command**: `npm run start:frontend`
- **Port**: 8080 (HTTP server)
- **Environment**: `NODE_ENV=production`, `VUE_APP_WSS_URL=wss://...`

---

## 📝 Deployment Steps

### Step 1: Push to GitHub

First, commit and push all the new configuration files:

```bash
cd /Users/yangeyre/Desktop/BOTC_TRACKER/townsquare_botc

git add .
git commit -m "Add Railway deployment configuration"
git push origin main
```

### Step 2: Deploy WebSocket Server

1. **Go to Railway**: https://railway.app/dashboard
2. **Click**: "New Project" → "Deploy from GitHub repo"
3. **Select**: Your `townsquare_botc` repository
4. **Service Name**: Change to `townsquare-websocket`
5. **Settings → Start Command**: 
   ```bash
   npm run start:websocket
   ```
6. **Variables tab** → Add:
   ```
   NODE_ENV=production
   ```
7. **Networking tab** → Enable **Public Networking**
8. **Deploy** and wait for deployment to complete
9. **Copy the URL**: `https://townsquare-websocket.up.railway.app`

### Step 3: Deploy Frontend

1. **Same Railway Project** → Click "+ New"
2. **Select**: "GitHub Repo" → Same `townsquare_botc` repository
3. **Service Name**: Change to `townsquare-frontend`
4. **Settings → Start Command**:
   ```bash
   npm run start:frontend
   ```
5. **Variables tab** → Add:
   ```
   NODE_ENV=production
   VUE_APP_WSS_URL=wss://townsquare-websocket.up.railway.app
   ```
   ⚠️ **Replace** with your actual WebSocket URL from Step 2!

6. **Networking tab** → Enable **Public Networking**
7. **Deploy** and wait for deployment

---

## 🔧 Configuration Files Explained

### `railway.json`
Basic Railway configuration with build and deployment settings.

### `Procfile`
Tells Railway how to start your app. Edit this file to switch between WebSocket and Frontend deployment.

### `nixpacks.toml`
Specifies Node.js version and build process.

### `package.json` (Updated Scripts)
- `start:frontend` - Runs Vue.js frontend
- `start:websocket` - Runs WebSocket server
- `dev:frontend` - Local development (frontend)
- `dev:websocket` - Local development (WebSocket)

---

## 🧪 Testing Your Deployment

### Test WebSocket Server

```bash
# Using wscat (install: npm install -g wscat)
wscat -c "wss://townsquare-websocket.up.railway.app/test123/tracker-test"

# Should connect successfully
```

### Test Frontend

1. Visit: `https://townsquare-frontend.up.railway.app`
2. Should see TownSquare interface
3. Open browser dev tools (F12)
4. Check Console for errors
5. Check Network → WS tab for WebSocket connection

### Test Full Integration

1. **Open TownSquare**: `https://townsquare-frontend.up.railway.app/#test123`
2. **Start local listener**:
   ```bash
   cd /Users/yangeyre/Desktop/BOTC_TRACKER/townsquare-listener
   node listener.js --channel=test123
   ```
3. **Create game** in TownSquare
4. **Add players, assign roles**
5. **Check listener** - should see events!

---

## 💰 Cost Estimate

Railway pricing (as of 2024):

- **Hobby Plan**: $5/month per service
- **Free**: $5 credit per month

**Your costs**:
```
WebSocket Service: $5/month
Frontend Service:  $5/month
────────────────────────────
Total:            $10/month
Less free credit:  -$5/month
════════════════════════════
YOU PAY:          $5/month
```

---

## 🔄 Updating Your Deployment

When you make changes:

```bash
# Make your changes
# Commit and push
git add .
git commit -m "Your changes"
git push

# Railway will auto-deploy!
```

---

## 📋 Post-Deployment Checklist

- [ ] WebSocket server deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] Environment variables set correctly
- [ ] WebSocket connection working (check browser console)
- [ ] Test game creation and role assignment
- [ ] Listener can connect and receive events
- [ ] Update Discord bot with production URLs
- [ ] Update Tracker with production URLs

---

## 🎉 Next Steps

1. ✅ **Update your Discord bot** with production TownSquare URL
2. ✅ **Deploy the listener** (can be part of Discord bot or separate service)
3. ✅ **Update Tracker database** (add session_id fields)
4. ✅ **Create Tracker API endpoints** (receive events from listener)
5. ✅ **Test end-to-end** (Discord → TownSquare → Listener → Tracker)

---

## 📞 Need Help?

**Common Issues**:
- Frontend won't load → Check build logs in Railway
- WebSocket won't connect → Verify `VUE_APP_WSS_URL` is correct (must be `wss://`)
- Port errors → Don't hardcode ports, use `process.env.PORT`

**Railway Dashboard**: https://railway.app/dashboard
**Railway Docs**: https://docs.railway.app

---

**Your Production URLs** (fill these in after deployment):
- WebSocket Server: `___________________________________`
- Frontend: `___________________________________`

