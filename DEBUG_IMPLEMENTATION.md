# Debug Implementation Guide

## 🔧 Debugging is Now Fully Implemented!

I've added comprehensive logging and debug utilities throughout the code. Here's how to use them:

---

## Quick Start: Browser Console Commands

### 1️⃣ **Check Hospital Status in One Command**
```javascript
window.__hospitalDebug.authStatusDetails()
```

**Output Example:**
```javascript
{
  currentAuthStatus: 'allowed',
  user: { uid: 'abc123...', email: 'hospital@example.com' },
  hospitalId: 'abc123...',
  cachedAccepted: [
    { id: 'offer_xyz', status: 'accepted', donorName: 'John Doe', ... }
  ],
  acceptedCount: 1,
  pendingCount: 2,
  totalRequests: 3
}
```

**What to look for:**
- ✅ `currentAuthStatus: 'allowed'` → Hospital approved by admin
- ⏳ `currentAuthStatus: 'pending'` → Waiting for admin approval
- ❌ `currentAuthStatus: 'denied'` → Admin rejected it

---

### 2️⃣ **View All Requests in State**
```javascript
window.__hospitalDebug.allRequests()
```

**Output Example:**
```javascript
[
  {
    id: 'offer_abc123',
    status: 'accepted',
    donorName: 'Jane Smith',
    bloodType: 'O+',
    quantity: 2,
    requestedDate: '2025-12-10'
  },
  {
    id: 'offer_def456',
    status: 'requested',
    donorName: 'Bob Wilson',
    bloodType: 'A-',
    quantity: 1,
    requestedDate: '2025-12-12'
  }
]
```

**What to look for:**
- How many requests are in state?
- Are accepted requests showing with `status: 'accepted'`?
- Do they have all display fields (donorName, bloodType, quantity)?

---

### 3️⃣ **Check localStorage Cache**
```javascript
window.__hospitalDebug.localStorage()
```

**Output Example:**
```javascript
{
  keys: ['hospital_accepted_requests_abc123...'],
  data: {
    'hospital_accepted_requests_abc123...': [
      { id: 'offer_xyz', status: 'accepted', donorName: 'John', ... }
    ]
  }
}
```

**What to look for:**
- Is there a cache key with your hospital ID?
- Does it contain accepted requests?
- Are all fields preserved (donorName, bloodType, etc.)?

---

## 📊 Console Log Sequence (What to Expect)

When everything works, you'll see this pattern in the console:

### On Page Load:
```
✅ Hospital verification status: { id: 'abc123...', verified: 'accepted' }
📥 Loading cached accepted requests on auth check: { count: 1, ids: ['offer_xyz'] }
🔀 Merged on auth check: { pending: 2, cached: 1, total: 3 }
🔍 Cache merge starting: { uid: 'abc123...', hospitalId: 'abc123...' }
📥 Loaded cached accepted requests: { count: 1, ids: ['offer_xyz'], ... }
🔀 Merged cache with current state: { beforeCount: 2, pendingKept: 2, acceptedAdded: 1, afterCount: 3 }
🔧 Hospital Debug Utility Ready! Type: window.__hospitalDebug.authStatusDetails()
```

### When Firestore Subscription Connects:
```
🔍 Firestore subscription initializing: { uid: 'abc123...', hospitalId: 'abc123...' }
🔍 Firestore queries set up: { qRequested: 'status=requested', qAccepted: 'status=accepted AND hospitalId=abc123...' }
📥 Firestore pending requests loaded: { count: 2, ids: ['offer_abc', 'offer_def'] }
📨 Firestore accepted query callback triggered, processing documents...
  📄 Accepted offer from Firestore: { id: 'offer_xyz', hospitalId: 'abc123...', status: 'accepted', donorName: 'John', ... }
📊 Total accepted offers from query: 1
🔀 Merging accepted + pending: { acceptedCount: 1, pendingCount: 2, totalMerged: 3 }
💾 Saved to localStorage: { cacheKey: 'hospital_accepted_requests_abc123...', count: 1 }
```

### When Filtering for Display:
```
isAcceptedAndNotYetReached check: { id: 'offer_xyz', status: 'accepted', normalizedStatus: 'accepted', donorName: 'John' }
  → Status is "accepted", not "accepted", INCLUDED
  → No scheduled date, INCLUDED (no schedule = keep showing)
```

---

## 🎯 Step-by-Step Debug Checklist

### Step 1: Check Hospital Approval Status
```javascript
const status = window.__hospitalDebug.authStatusDetails();
console.log('Auth Status:', status.currentAuthStatus);

// If NOT 'allowed':
// → Go to admin dashboard
// → Find hospital in pending list
// → Click "Accept" to approve
// → Return to hospital dashboard and refresh
```

### Step 2: Check if Requests Loaded
```javascript
const status = window.__hospitalDebug.authStatusDetails();
console.log('Total Requests:', status.totalRequests);
console.log('Accepted Count:', status.acceptedCount);
console.log('Pending Count:', status.pendingCount);

// If totalRequests = 0:
// → No requests in database yet
// → Create a donor request from donor dashboard
// → Then come back and refresh
```

### Step 3: Check if Accepted Requests Have Data
```javascript
const requests = window.__hospitalDebug.allRequests();
const accepted = requests.filter(r => r.status === 'accepted');

accepted.forEach(r => {
  console.log('Accepted Request:', {
    id: r.id,
    donorName: r.donorName,
    bloodType: r.bloodType,
    quantity: r.quantity,
    requestedDate: r.requestedDate,
  });
});

// All these fields should have values
// If any are undefined/null → Data wasn't preserved when accepting
```

### Step 4: Check Cache Persistence
```javascript
const cache = window.__hospitalDebug.localStorage();

if (cache.keys.length === 0) {
  console.log('❌ NO CACHE FOUND - Try accepting a request first');
} else {
  console.log('✅ Cache exists:', cache.keys[0]);
  console.log('Cache data:', cache.data[cache.keys[0]]);
}
```

### Step 5: Accept a Request and Monitor
1. In hospital dashboard, find a pending request
2. Open DevTools → Console (F12)
3. Click **Accept**
4. Look for logs starting with ✅ and 💾
5. Check `window.__hospitalDebug.allRequests()` - should see it in state
6. Refresh page (F5)
7. Check again - should still be there (from cache)

---

## 🔴 Common Issues & Debug Steps

### Issue: "Accepted requests still not showing after refresh"

**Debug with:**
```javascript
// 1. Check if hospital is approved
const status = window.__hospitalDebug.authStatusDetails();
if (status.currentAuthStatus !== 'allowed') {
  console.log('PROBLEM: Hospital not approved. currentAuthStatus =', status.currentAuthStatus);
  // Fix: Go to admin dashboard, approve hospital
  return;
}

// 2. Check if cache exists
const cache = window.__hospitalDebug.localStorage();
if (cache.keys.length === 0) {
  console.log('PROBLEM: No cache found');
  // Fix: Accept a request first to create cache
  return;
}

// 3. Check cached data structure
const cacheKey = cache.keys[0];
const cachedData = cache.data[cacheKey];
console.log('Cached data:', cachedData);

// 4. Check if it has all required fields
if (cachedData[0]) {
  console.log('Sample cached item:', {
    hasId: 'id' in cachedData[0],
    hasStatus: 'status' in cachedData[0],
    hasDonorName: 'donorName' in cachedData[0],
    hasBloodType: 'bloodType' in cachedData[0],
  });
}
```

### Issue: "Accepted count says 0 but cache has data"

**Debug with:**
```javascript
const status = window.__hospitalDebug.authStatusDetails();
console.log('acceptedCount from filter:', status.acceptedCount);

const all = window.__hospitalDebug.allRequests();
const manualCount = all.filter(r => r.status === 'accepted').length;
console.log('Manual accepted count:', manualCount);

// If different → Filter function isn't working correctly
// Check console for 'isAcceptedAndNotYetReached' logs
```

### Issue: "Filter logs show requests being excluded"

**Look for logs like:**
```
isAcceptedAndNotYetReached check: { status: 'accepted', ... }
  → Status is "requested", not "accepted", EXCLUDED
```

**This means:** The status value doesn't match "accepted"
- Check exact spelling in database
- Check if status has extra spaces or different case
- Verify Firestore update is successful

---

## 📋 All Debug Commands Reference

| Command | Purpose |
|---------|---------|
| `window.__hospitalDebug.authStatusDetails()` | Full status overview |
| `window.__hospitalDebug.allRequests()` | View all requests in state |
| `window.__hospitalDebug.localStorage()` | View cache contents |
| `window.__hospitalDebug.authStatusDetails().acceptedCount` | Quick accepted count check |
| `window.__hospitalDebug.authStatusDetails().cachedAccepted` | View cached accepted requests only |

---

## 💾 Console Log Colors & Meanings

| Emoji | Meaning |
|-------|---------|
| ✅ | Success - something worked |
| 📥 | Data loaded/received |
| 📤 | Data sending/saving |
| 💾 | Cached to localStorage |
| 🔀 | Merging multiple data sources |
| 🔍 | Starting a process |
| 📊 | Summary/stats |
| ⚠️ | Warning - something might be wrong |
| ❌ | Error - something failed |
| 🚫 | Skipped/not executed |
| 🔧 | Debug utility message |

---

## 🧪 Test Scenario

### Complete Test Flow:

1. **Start Fresh**
   ```javascript
   // Clear cache
   localStorage.clear();
   location.reload();
   ```

2. **Check Status**
   ```javascript
   window.__hospitalDebug.authStatusDetails()
   // Should show: currentAuthStatus: 'allowed'
   ```

3. **Accept a Request**
   - In UI, click Accept on a pending request
   - Monitor console for ✅ and 💾 logs
   - Command+K to clear console noise

4. **Verify State**
   ```javascript
   window.__hospitalDebug.allRequests()
   // Should show accepted request with all fields
   ```

5. **Verify Cache**
   ```javascript
   window.__hospitalDebug.localStorage()
   // Should show cached data with your hospital ID
   ```

6. **Refresh and Verify**
   - Press F5 to reload
   - Watch console logs for cache loading
   - Command: `window.__hospitalDebug.authStatusDetails()`
   - acceptedCount should still show accepted request

7. **Check UI**
   - "Accepted Requests" section should display the request
   - Should show donorName, bloodType, quantity, date

---

## 📞 Need Help?

If debug output shows issues:

1. **Screenshot the browser console output**
2. **Run these commands and copy output:**
   ```javascript
   console.log('=== STATUS ===');
   window.__hospitalDebug.authStatusDetails();
   
   console.log('=== ALL REQUESTS ===');
   window.__hospitalDebug.allRequests();
   
   console.log('=== CACHE ===');
   window.__hospitalDebug.localStorage();
   ```
3. **Share the output** - it will pinpoint the exact issue
