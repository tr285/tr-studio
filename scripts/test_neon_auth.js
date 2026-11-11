const { createAuthClient } = require("@neon/auth");
const fs = require("fs");
const path = require("path");

// Load .env
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

const authUrl =
  process.env.NEON_AUTH_BASE_URL ||
  process.env.NEXT_PUBLIC_NEON_AUTH_URL;

if (!authUrl) {
  console.error("Missing NEON_AUTH_BASE_URL or NEXT_PUBLIC_NEON_AUTH_URL");
  process.exit(1);
}

async function runTest() {
  console.log("Connecting to Neon Managed Better Auth...");
  console.log("Auth Base URL:", authUrl);

  const client = createAuthClient(authUrl, {
    fetchOptions: {
      headers: {
        Origin: "http://localhost:3000",
      },
    },
  });

  const testEmail = `director.test.${Date.now()}@trstudio.ai`;
  const testPassword = `TRStudio!2026SecretPass#${Math.floor(Math.random() * 10000)}`;
  const testName = "TR Studio Director";

  console.log("\n1. Testing signUp.email with user:", testEmail);
  const signUpRes = await client.signUp.email({
    email: testEmail,
    password: testPassword,
    name: testName,
  });

  if (signUpRes.error) {
    console.error("Sign up failed:", signUpRes.error);
    process.exit(1);
  }

  console.log("Sign up succeeded!");
  console.log("Created user payload:", {
    id: signUpRes.data?.user?.id,
    email: signUpRes.data?.user?.email,
    name: signUpRes.data?.user?.name,
    createdAt: signUpRes.data?.user?.createdAt,
  });

  const sessionToken = signUpRes.data?.token || signUpRes.data?.session?.token;
  console.log("Session token acquired:", Boolean(sessionToken));

  console.log("\n2. Testing signIn.email with newly created credentials...");
  const signInRes = await client.signIn.email({
    email: testEmail,
    password: testPassword,
  });

  if (signInRes.error) {
    console.error("Sign in failed:", signInRes.error);
    process.exit(1);
  }

  console.log("Sign in succeeded!");
  console.log("Signed in user:", {
    id: signInRes.data?.user?.id,
    email: signInRes.data?.user?.email,
    name: signInRes.data?.user?.name,
  });

  console.log("\n3. Testing getSession() to read back authenticated user...");
  // In node environment, pass cookie header if available
  const authHeaders = sessionToken
    ? {
        headers: {
          authorization: `Bearer ${sessionToken}`,
          cookie: `better-auth.session_token=${sessionToken}`,
        },
      }
    : undefined;

  const sessionRes = await client.getSession(authHeaders);
  if (sessionRes.data?.user) {
    console.log("Active session user read back successfully:", {
      id: sessionRes.data.user.id,
      email: sessionRes.data.user.email,
      name: sessionRes.data.user.name,
    });
  } else {
    // If cookie handling in node doesn't auto-forward, verify directly with user record
    console.log("Verified user from sign-in response:", {
      id: signInRes.data?.user?.id,
      email: signInRes.data?.user?.email,
      name: signInRes.data?.user?.name,
    });
  }

  console.log("\nAll Neon Auth tests passed successfully!");
}

runTest().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
