const passport       = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User    = require("../models/User");
const Patient = require("../models/Patient");
const Doctor  = require("../models/Doctor");

function cleanName(raw) {
  return raw.replace(/^\d+_/, "").replace(/_/g, " ").trim();
}

passport.use(new GoogleStrategy({
  clientID:          process.env.GOOGLE_CLIENT_ID,
  clientSecret:      process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:       process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback",
  passReqToCallback: true,
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    const email  = profile.emails[0].value;
    const name   = cleanName(profile.displayName);
    const avatar = profile.photos[0]?.value || null;

    // ✅ FIX 1: Read role from state param correctly.
    // When you call passport.authenticate('google', { state: role }) in your route,
    // passport-google-oauth20 puts it in req.query.state on the callback.
    // Fall back to 'patient' if missing.
    const role = req.query.state || "patient";

    let user = await User.findOne({ email });

    if (user) {
      // ✅ FIX 2: Existing user role conflict handling.
      // Previously this silently returned the old role — so selecting "doctor"
      // on the login page had zero effect if the account already existed as patient.
      //
      // Now: if the user is trying to log in as a DIFFERENT role than what's stored,
      // we send back a special signal so the frontend can show a clear error message
      // instead of silently landing them in the wrong dashboard.
      if (user.role !== role) {
        // done(null, false) triggers the failureRedirect in your route.
        // We attach the reason via the second arg (info object).
        return done(null, false, {
          message: `This Google account is registered as a ${user.role}. Please select the correct role.`,
          existingRole: user.role,
        });
      }

      // Same role — just refresh name/avatar and continue
      user.name      = name;
      user.avatar    = avatar || user.avatar;
      user.lastLogin = Date.now();
      await user.save({ validateBeforeSave: false });
      return done(null, user);
    }

    // ── New user — create with the selected role ──
    user = await User.create({
      name,
      email,
      // Random secure password — they'll use Google to log in, not password
      password:   Math.random().toString(36).slice(-12) + "Aa1!",
      role,
      avatar,
      isVerified: true,
      lastLogin:  Date.now(),
    });

    // ✅ FIX 3: Create the correct role-specific profile, not just Patient every time
    if (role === "patient") {
      await Patient.create({ user: user._id });
    }

    if (role === "doctor") {
      // Doctor via Google won't have license/specialization yet —
      // they'll need to complete their profile after first login.
      await Doctor.create({
        user:           user._id,
        specialization: "General Physician", // default, user updates on profile page
        licenseNumber:  `PENDING-${user._id}`, // unique placeholder until admin verification
        hospital:       "",
        isVerified:     false,
      });
    }

    // Insurance role needs no separate collection — fields live on User model

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try   { done(null, await User.findById(id)); }
  catch (err) { done(err, null); }
});

module.exports = passport;
