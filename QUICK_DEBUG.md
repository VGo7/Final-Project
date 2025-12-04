# ⚡ Quick Start: Debug Commands

## Open Browser Console (F12) and Copy-Paste These:

### 1. Full Status Check
```javascript
window.__hospitalDebug.authStatusDetails()
```
**Look for:** `currentAuthStatus: 'allowed'` and `acceptedCount`

---

### 2. View All Requests
```javascript
window.__hospitalDebug.allRequests()
```
**Look for:** Requests with `status: 'accepted'` and full data

---

### 3. Check Cache
```javascript
window.__hospitalDebug.localStorage()
```
**Look for:** Data with your hospital ID in the keys

---

### 4. Quick Accepted Count
```javascript
window.__hospitalDebug.authStatusDetails().acceptedCount
```
**Should be:** `> 0` if you have accepted requests

---

### 5. Check Hospital Approval
```javascript
window.__hospitalDebug.authStatusDetails().currentAuthStatus
```
**Should be:** `'allowed'` (not 'pending' or 'denied')

---

## 🎯 What to Do Next

### If `acceptedCount = 0`:
1. Check: `window.__hospitalDebug.authStatusDetails().totalRequests`
   - If `= 0`: No requests exist, create one from donor dashboard
   - If `> 0`: Requests exist but not accepted yet, accept one

2. Accept a request and check console for:
   - `✅ Updated local request to accepted:`
   - `💾 Cached accepted requests:`

3. Run: `window.__hospitalDebug.authStatusDetails().acceptedCount`
   - Should now be `> 0`

### If `currentAuthStatus ≠ 'allowed'`:
1. Go to admin dashboard
2. Find your hospital in pending/denied list
3. Click "Accept" to approve
4. Return and refresh hospital dashboard

### If cache is empty:
1. Accept a request
2. Watch for: `💾 Cached accepted requests:`
3. Then refresh page
4. Should show in cache

---

## 📊 Expected Console Logs

### When Accepting:
```
✅ acceptRequest: uid=..., hospitalId=...
✅ Updated local request to accepted: { donorName: '...', ... }
💾 Cached accepted requests: { count: 1, acceptedIds: [...] }
```

### When Refreshing:
```
✅ Hospital verification status: { verified: 'accepted' }
📥 Loading cached accepted requests on auth: { count: 1, ... }
🔀 Merged on auth check: { pending: 2, cached: 1, total: 3 }
```

---

## ❌ Common Problems & Quick Fixes

| Problem | Check | Fix |
|---------|-------|-----|
| Nothing shows | `authStatusDetails().acceptedCount` | Accept a request first |
| Count wrong | `allRequests()` | Check for `status: 'accepted'` |
| Cache empty | `localStorage()` | Accept request, cache saves automatically |
| Status pending | `authStatusDetails().currentAuthStatus` | Admin needs to approve hospital |
| After refresh still empty | Refresh logs in console | Check "Merged on auth check" log |

---

## 🧪 Test Flow

```javascript
// 1. Check status
window.__hospitalDebug.authStatusDetails()

// 2. See current count
window.__hospitalDebug.authStatusDetails().acceptedCount

// 3. Accept a request in UI (watch console)

// 4. Check count again
window.__hospitalDebug.authStatusDetails().acceptedCount

// 5. Refresh page (F5, watch console)

// 6. Check count after refresh
window.__hospitalDebug.authStatusDetails().acceptedCount
// Should still be same!

// 7. Check UI
// "Accepted Requests" section should show request
```

---

## 🔗 Full Documentation

For detailed guides, see:
- `DEBUG_IMPLEMENTATION.md` - Complete debug tools guide
- `DEBUG_SUMMARY.md` - Full debugging explanation
- `DEBUGGING_CHECKLIST.md` - Step-by-step troubleshooting
