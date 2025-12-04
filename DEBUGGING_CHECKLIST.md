# Debugging Checklist: Accepted Requests Not Displaying

## 🔴 CRITICAL DISCOVERY

The accepted requests section is **inside** a conditional that only renders when:
```javascript
{authStatus === 'allowed' && ( ... accepted requests section ... )}
```

This means the dashboard won't show AT ALL unless `authStatus === 'allowed'`.

---

## Step 1: Check Your Hospital Verification Status

### In Browser Console:
1. Open DevTools (F12)
2. Go to **Console** tab
3. Look for this debug message after page load:
```
✅ "Hospital verification status: { id: '...', v: 'accepted' }"
```

### What the values mean:
- `v: 'accepted'` → ✅ Hospital approved by admin → Dashboard should show
- `v: 'pending'` → ⏳ Waiting for admin approval → Shows "Pending approval" screen
- `v: 'denied'` → ❌ Admin rejected → Shows "Permission denied" screen

### If you see "No hospital document found":
- Your hospital isn't registered in the `hospitals` collection
- The code now allows this for development (set to 'allowed' as fallback)
- In production, this should probably be 'pending'

---

## Step 2: Check if Dashboard is Rendering

### In Browser Console, after page load:
```javascript
// Check current auth status
document.body.innerText.includes('Pending approval') // true = pending status
document.body.innerText.includes('Hospital Dashboard') // true = allowed status
document.body.innerText.includes('Permission denied') // true = denied status
```

**If you see "Pending approval" but your hospital should be approved:**
- Check Firebase Console → Collections → `hospitals`
- Find your hospital document (by UID or email)
- Look for field `verified: 'accepted'` ← Must be this exact value!

---

## Step 3: Debug the Firestore Subscription

### In Browser Console after page load, look for:
```
✅ "Firestore subscription initializing: { uid: '...', emailKey: '...', hospitalId: '...' }"
✅ "Firestore queries set up: { qRequested: 'status=requested', qAccepted: 'status=accepted AND hospitalId=...' }"
✅ "Total accepted offers from Firestore query: N"
```

### If you DON'T see these messages:
- Firestore subscription isn't running
- Check if authStatus is preventing it (see Step 1)

---

## Step 4: Check localStorage Cache

### In Browser Console:
```javascript
// Find what keys exist
Object.keys(localStorage)
  .filter(k => k.includes('hospital_accepted_requests'))

// Check what's cached for YOUR hospital
localStorage.getItem('hospital_accepted_requests_uid123...')
localStorage.getItem('hospital_accepted_requests_email_example_com')
```

### You should see something like:
```json
[
  {
    "id": "offer_abc123",
    "status": "accepted",
    "donorName": "John Doe",
    "bloodType": "O+",
    "quantity": 1,
    "requestedDate": "2025-12-10",
    "requestedSlot": "09:00"
  }
]
```

### If cache is empty:
- No accepted requests have been created yet
- OR accepted requests aren't being cached (check Step 6)

---

## Step 5: Check Hospital ID Consistency

### In Browser Console, after accepting a request:
```javascript
// What ID is being used?
const user = getCurrentUser();
const uid = user?.uid || user?.id;
const emailKey = (user?.email || '').replace(/[@.]/g, '_');
const hospitalId = uid || emailKey;

console.log('My hospital ID:', hospitalId);

// Check if this matches what's in Firestore
// Go to Firebase Console → donor_offers → Find accepted offer
// Look at its "hospitalId" field → Should match above
```

### If IDs don't match:
- Email has special chars that aren't being replaced correctly
- UID is undefined
- This is why accepted offers aren't being queried

---

## Step 6: Test Accept Request Flow

### Step by step:
1. Make sure you're on hospital dashboard
2. Find a pending request (from donors)
3. Click **Accept**
4. In console, you should see:
```
✅ "acceptRequest: uid=XXX, emailKey=YYY, hospitalId=ZZZ"
✅ "Updated local request to accepted: {...full offer data}"
✅ "Cached accepted requests locally: [{id: '...', status: 'accepted', ...}]"
```

5. Check if accepted request appears in "Accepted Requests" section
6. **REFRESH PAGE**
7. Check if it's still there after refresh

---

## Step 7: Full Data Flow Validation

### Open DevTools → Application → Local Storage
Check for key: `hospital_accepted_requests_[YOUR_HOSPITAL_ID]`

If it exists and has data:
1. Copy the entire value
2. Paste into console:
```javascript
const cached = JSON.parse('[paste_the_json_here]');
console.log('Cached data:', cached);

// Verify it has all required fields
cached.forEach(r => {
  console.log({
    id: r.id,
    status: r.status,
    donorName: r.donorName,
    bloodType: r.bloodType,
    quantity: r.quantity
  });
});
```

---

## Common Issues & Solutions

### ❌ "Hospital verification status: { v: 'pending' }"
**Issue:** Hospital not approved by admin
**Solution:** 
- Go to admin dashboard
- Find your hospital in pending hospitals
- Click "Accept" to approve it
- Then refresh hospital dashboard

### ❌ "Firestore queries set up" but "Total accepted offers: 0"
**Issue:** Firestore query returns nothing
**Possible causes:**
1. No accepted offers exist in database
2. HospitalId doesn't match what's stored
3. Status isn't exactly 'accepted'
**Solution:**
- Check Firebase Console → donor_offers
- Filter by `status == 'accepted'`
- Check the `hospitalId` field
- Try accepting a new request and monitor the console

### ❌ "No hospital document found"
**Issue:** Hospital not in `hospitals` collection
**Solution:**
- In new version, dashboard allows access (development mode)
- For production, register hospital in database first
- Or have admin approve hospital registration

### ❌ Accepted requests disappear after refresh
**Issue:** Cache isn't being loaded
**Solution:**
1. Check localStorage has data (Step 7)
2. Check hospitalId matches (Step 5)
3. Check browser's 3rd-party cookies aren't disabled
4. Try incognito/private window

---

## Step 8: Check Your Hospital Registration

### In Firebase Console:
1. Go to `hospitals` collection
2. Look for your hospital document
3. Check these fields:
```
{
  "id": "uid123...",  // or email_example_com
  "name": "Your Hospital Name",
  "verified": "accepted",  // ← MUST BE "accepted"!
  "email": "hospital@example.com"
}
```

### If "verified" is not "accepted":
- Admin hasn't approved it yet
- Contact admin to approve hospital registration

---

## Console Log Sequence (Complete Flow)

When everything works correctly, you should see this order in console:

```
1. Auth check:
   "Hospital verification status: { id: '...', v: 'accepted' }"

2. Dashboard loads:
   "Hospital Dashboard" visible

3. Firestore subscription starts:
   "Firestore subscription initializing: { uid: '...', hospitalId: '...' }"
   "Firestore queries set up: { qRequested: '...', qAccepted: '...' }"

4. Queries return data:
   "Total accepted offers from Firestore query: N"
   "Setting requests with merged data: {...}"

5. Or loads from cache:
   "Loading cached accepted requests on auth: [{...}]"

6. Cache updates:
   "Cached accepted requests to localStorage: {count: N}"

7. UI updates:
   "Accepted Requests" section displays with data
```

If you don't see this sequence, some step is failing.

---

## Emergency Debug Mode

### Add this to browser console to see EVERYTHING:

```javascript
// Check current state
console.log('Current authStatus:', document.body.innerText);

// Check all localStorage keys
console.log('All localStorage:', Object.keys(localStorage).filter(k => k.includes('hospital')));

// Check for cached data
const keys = Object.keys(localStorage).filter(k => k.includes('hospital_accepted'));
keys.forEach(k => {
  try {
    const data = JSON.parse(localStorage.getItem(k));
    console.log(`${k}:`, data);
  } catch (e) {
    console.log(`${k}: ERROR -`, e.message);
  }
});

// Force refresh requests from cache
if (keys.length > 0) {
  const data = JSON.parse(localStorage.getItem(keys[0]));
  console.log('Found cached accepted requests:', data);
}
```

---

## If STILL Not Working

1. **Screenshot the browser console** showing all debug messages
2. **Check Firebase Console:**
   - Does your `hospitals` document have `verified: 'accepted'`?
   - Are there any `donor_offers` with `status: 'accepted'`?
   - Does the accepted offer have a `hospitalId` that matches yours?
3. **Check localStorage:**
   - Is cache being created? (see console logs about "Cached accepted requests")
   - What's the key name?

Post these answers and I can pinpoint the exact issue!
