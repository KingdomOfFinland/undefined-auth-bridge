// ==================== CLIENT-SIDE AUTH BRIDGE (Vercel version) ====================
// Add this to Undefined Fighter's index.html, right after fish-auth login
// succeeds and BEFORE any code tries to read/write players/currency/
// donations/limitedItems in the main project's database.
//
// Replace VERCEL_BRIDGE_URL below with your actual deployed URL, e.g.
//   https://undefined-fighter-auth.vercel.app/api/bridgeAuthToken

import { getAuth, signInWithCustomToken } from "firebase/auth";

const VERCEL_BRIDGE_URL = "https://YOUR-PROJECT-NAME.vercel.app/api/bridgeAuthToken";

// Call this right after a successful fish-auth sign-in (email/password,
// anonymous, whatever Kingdom's using). Pass the fish-auth user object.
async function bridgeToMainProject(fishAuthUser) {
  try {
    // 1. Grab the fish-auth ID token for the just-signed-in user.
    const idToken = await fishAuthUser.getIdToken();

    // 2. Call the Vercel function to trade that for a custom token on
    //    the same uid, valid for the main Undefined Fighter project.
    const response = await fetch(VERCEL_BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });

    if (!response.ok) {
      throw new Error("Bridge request failed: " + response.status);
    }

    const { customToken, uid } = await response.json();

    // 3. Sign into the MAIN project's Auth using that custom token.
    //    After this, auth.uid in the main project's database rules will
    //    equal fishAuthUser.uid — reads/writes to players/$uid/... work.
    const mainAuth = getAuth(mainApp); // mainApp = your existing main-project Firebase app
    await signInWithCustomToken(mainAuth, customToken);

    console.log("Bridged into main project as uid:", uid);
    return uid;
  } catch (error) {
    console.error("Auth bridge failed:", error);
    // Game should treat this like "not signed in" for claim/donate/etc —
    // those actions will correctly fail with 'notsignedin' rather than
    // silently hitting permission denied.
    throw error;
  }
}

// ==================== WIRE IT UP ====================
// Wherever the existing fish-auth login flow currently sets currentUser,
// call bridgeToMainProject() right after and await it before letting the
// player claim/donate/spend. Example:
//
//   onAuthStateChanged(fishAuth, async (user) => {
//     if (user) {
//       await bridgeToMainProject(user);
//       currentUser = user; // existing code
//       // NOW it's safe to call _claimLimitedItem, __sendDonation, etc.
//     }
//   });
