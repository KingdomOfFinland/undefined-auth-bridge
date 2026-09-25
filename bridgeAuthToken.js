// api/bridgeAuthToken.js
//
// Vercel serverless function. Deployed at:
//   https://[your-vercel-project].vercel.app/api/bridgeAuthToken
//
// Does the same job the Firebase Callable Function would have done:
//   1. Verify a fish-auth ID token (proves the player is really signed
//      into fish-auth as this uid)
//   2. Mint a custom token for the SAME uid, but for the main
//      undefined-fighter Firebase project
//   3. Return that custom token to the client, which then calls
//      signInWithCustomToken() to get a real session in the main project
//
// ==================== ENV VARS NEEDED (set in Vercel dashboard) ====================
// FISH_AUTH_SERVICE_ACCOUNT   -> paste the FULL contents of the fish-auth
//                                 service account JSON as one line (stringified)
// MAIN_PROJECT_SERVICE_ACCOUNT -> paste the FULL contents of the
//                                 undefined-fighter service account JSON
//                                 (Project Settings -> Service Accounts ->
//                                 Generate new private key, on the MAIN project)
//
// Never commit these JSON files to the repo — env vars only.

const admin = require("firebase-admin");

let fishAuthApp;
let mainApp;

function getApps() {
  if (!fishAuthApp) {
    const fishAuthCreds = JSON.parse(process.env.FISH_AUTH_SERVICE_ACCOUNT);
    fishAuthApp = admin.initializeApp(
      { credential: admin.credential.cert(fishAuthCreds) },
      "fishAuth"
    );
  }
  if (!mainApp) {
    const mainCreds = JSON.parse(process.env.MAIN_PROJECT_SERVICE_ACCOUNT);
    mainApp = admin.initializeApp(
      { credential: admin.credential.cert(mainCreds) },
      "main"
    );
  }
  return { fishAuthApp, mainApp };
}

module.exports = async (req, res) => {
  // Basic CORS so the game (on GitHub Pages) can call this
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { idToken } = req.body || {};

  if (!idToken) {
    return res.status(400).json({ error: "Missing idToken" });
  }

  try {
    const { fishAuthApp, mainApp } = getApps();

    // 1. Verify against fish-auth
    const decoded = await admin.auth(fishAuthApp).verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2. Mint a custom token for the main project, same uid
    const customToken = await admin.auth(mainApp).createCustomToken(uid);

    return res.status(200).json({ customToken, uid });
  } catch (error) {
    console.error("Token bridge failed:", error);
    return res.status(401).json({ error: "Could not verify fish-auth session" });
  }
};
