'use strict';

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

function cleanName(raw) {
  return raw.replace(/^\d+_/, '').replace(/_/g, ' ').trim();
}

// FIX: this is now the ONLY place a GoogleStrategy is registered. It used to
// also be defined inline in routes/auth.js — passport.use() keys strategies
// by name ('google' by default), so registering it twice meant the second
// require() to run silently overwrote the first, and nothing ever called
// this file, so this logic (role-aware signup, role-conflict rejection)
// was dead code. server.js now requires this module once, before the routes
// that depend on it.
//
// FIX: also guarded the same way the old auth.js strategy was, so the app
// doesn't crash on boot in an environment (e.g. local dev) that hasn't set
// Google OAuth credentials.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value;
          const name = cleanName(profile.displayName);
          const avatar = profile.photos[0]?.value || null;

          // Role comes from the `state` param set in routes/auth.js's
          // /google route (?role=... on the frontend's Google button ->
          // state: role in passport.authenticate -> Google hands it back
          // here as req.query.state).
          const role = ['patient', 'doctor', 'insurance'].includes(
            req.query.state
          )
            ? req.query.state
            : 'patient';

          let user = await User.findOne({ email });

          if (user) {
            if (user.role !== role) {
              return done(null, false, {
                message: `This Google account is registered as a ${user.role}. Please select the correct role.`,
                existingRole: user.role,
              });
            }

            user.name = name;
            user.avatar = avatar || user.avatar;
            user.lastLogin = Date.now();
            await user.save({ validateBeforeSave: false });
            return done(null, user);
          }

          // FIX: this used to store `Math.random().toString(36)...` directly
          // in `password`. The User schema has no pre-save hashing hook
          // (only routes/auth.js's register route calls bcrypt.hash before
          // creating a user), so that string was saved to MongoDB as a
          // PLAINTEXT password — and Math.random() isn't a secure random
          // source to begin with. Generate a real random secret and hash it,
          // the same way routes/auth.js already does for normal signups.
          const randomSecret = crypto.randomBytes(20).toString('hex');
          const hashedPassword = await bcrypt.hash(randomSecret, 12);

          user = await User.create({
            name,
            email,
            password: hashedPassword,
            role,
            avatar,
            isVerified: true,
            lastLogin: Date.now(),
          });

          if (role === 'patient') {
            await Patient.create({ user: user._id });
          }

          if (role === 'doctor') {
            await Doctor.create({
              user: user._id,
              specialization: 'General Physician',
              licenseNumber: `PENDING-${user._id}`,
              hospital: '',
              isVerified: false,
            });
          }

          // Insurance role: no separate collection in the files provided —
          // fields live directly on User. Nothing further to create here.

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}

// Not used for anything right now — every route calls passport.authenticate
// with { session: false }, and server.js doesn't configure express-session
// or passport.session(). Left in place since it's harmless, but it's dead
// code in this JWT-based setup.
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    done(null, await User.findById(id));
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;