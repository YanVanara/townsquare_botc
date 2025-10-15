# Environment Variables for Railway Deployment

## 🎯 WebSocket Server Service

When deploying the WebSocket server to Railway, set these environment variables:

```bash
NODE_ENV=production
PORT=8080
```

Railway will automatically set `PORT`, but you can specify a default.

### Optional:
```bash
# If you need SSL certificates (Railway handles this automatically)
# CERT_PATH=/path/to/cert.pem
# KEY_PATH=/path/to/key.pem
```

---

## 🌐 Frontend Service

When deploying the frontend to Railway, set these environment variables:

```bash
# REQUIRED: Your WebSocket server URL
VUE_APP_WSS_URL=wss://your-websocket-service.up.railway.app

# Railway will set this automatically
PORT=8080

# Production mode
NODE_ENV=production
```

**Important**: Replace `your-websocket-service.up.railway.app` with your actual WebSocket service URL from Railway!

---

## 📝 How to Set in Railway

### Method 1: Railway Dashboard

1. Go to your project on Railway
2. Click on the service (Frontend or WebSocket)
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add each variable:
   - Variable name: `VUE_APP_WSS_URL`
   - Value: `wss://your-websocket-domain.up.railway.app`
6. Click **Add**

### Method 2: Railway CLI

```bash
# Set variables for WebSocket service
railway variables set NODE_ENV=production
railway variables set PORT=8080

# Set variables for Frontend service (in different service context)
railway variables set VUE_APP_WSS_URL=wss://your-websocket.up.railway.app
railway variables set NODE_ENV=production
```

---

## 🔄 Deployment Order

**Important**: Deploy in this order to get the correct URLs:

1. **Deploy WebSocket Server first**
   - Get the Railway URL (e.g., `townsquare-websocket.up.railway.app`)
   - Note this URL!

2. **Deploy Frontend second**
   - Use the WebSocket URL in `VUE_APP_WSS_URL`
   - Frontend will connect to the WebSocket server

---

## ✅ Verification

After deployment, check:

1. **WebSocket Server**: Visit `https://your-websocket-url.up.railway.app`
   - Should show metrics or 404 (WebSocket endpoint doesn't serve HTTP)

2. **Frontend**: Visit `https://your-frontend-url.up.railway.app`
   - Should load TownSquare interface
   - Check browser console for WebSocket connection

3. **Connection Test**:
   - Open browser dev tools (F12)
   - Go to Network tab → WS (WebSockets)
   - Should see connection to your WebSocket server

---

## 🐛 Troubleshooting

### WebSocket won't connect

**Check**: Is `VUE_APP_WSS_URL` set correctly?
```bash
# Should start with wss:// (not ws://)
VUE_APP_WSS_URL=wss://your-domain.up.railway.app
```

### Frontend shows blank page

**Check**: Build logs in Railway
- Look for build errors
- Ensure all dependencies are in `package.json`

### Port binding errors

**Don't hardcode ports** in production:
```javascript
// ❌ Bad
const PORT = 8080;

// ✅ Good
const PORT = process.env.PORT || 8080;
```

---

## 📋 Environment Variables Checklist

### WebSocket Server ✓
- [ ] `NODE_ENV=production`
- [ ] `PORT` (set by Railway)

### Frontend ✓
- [ ] `VUE_APP_WSS_URL=wss://...` (your WebSocket URL)
- [ ] `NODE_ENV=production`
- [ ] `PORT` (set by Railway)

### Both Services ✓
- [ ] Verify variables are set in Railway dashboard
- [ ] Redeploy after changing variables
- [ ] Test connection after deployment

