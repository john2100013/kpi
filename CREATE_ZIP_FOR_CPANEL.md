# How to Create ZIP File for cPanel Upload

## Method 1: Using Windows (Built-in)

1. **Extract the RAR file** on your computer first
2. **Select all files and folders** in `kpi-process-backend` folder
3. **Right-click** → **Send to** → **Compressed (zipped) folder**
4. **Name it**: `kpi-process-backend.zip`
5. **Upload the ZIP file** to cPanel
6. **Extract it** in cPanel File Manager (ZIP is supported)

## Method 2: Using 7-Zip or WinRAR

1. **Open** `kpi-process-backend.rar` with WinRAR or 7-Zip
2. **Extract** it to a folder
3. **Select all extracted files**
4. **Right-click** → **Add to archive**
5. **Choose ZIP format** (not RAR)
6. **Upload ZIP** to cPanel

## Method 3: Upload Files Directly (No Archive)

1. **Extract RAR locally**
2. **Upload files directly** via File Manager (use "Upload" button)
3. **Or use FTP client** (FileZilla, WinSCP) for faster upload

---

## ⚠️ IMPORTANT: What to EXCLUDE when creating ZIP

**DO NOT include these in your ZIP:**
- ❌ `node_modules` folder (too large, will be installed on server)
- ❌ `.git` folder (not needed in production)
- ❌ `.env` file (create new one on server with production values)
- ❌ `*.log` files
- ❌ `*.rar` or `*.zip` files

**DO include:**
- ✅ All `.js` files
- ✅ `package.json` and `package-lock.json`
- ✅ `server.js`
- ✅ `database/` folder
- ✅ `routes/` folder
- ✅ `middleware/` folder
- ✅ `services/` folder
- ✅ `scripts/` folder
- ✅ `.gitignore`
- ✅ All `.md` documentation files

