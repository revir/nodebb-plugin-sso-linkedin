(function(module) {
  "use strict";

  var User = module.parent.require('./user'),
    meta = module.parent.require('./meta'),
    db = module.parent.require('../src/database'),
    passport = module.parent.require('passport'),
      passportLinkedin = require('passport-linkedin').Strategy,
      fs = module.parent.require('fs'),
      path = module.parent.require('path'),
      async = module.parent.require('async'),
      nconf = module.parent.require('nconf');

  var constants = Object.freeze({
    'name': "Linkedin",
    'admin': {
      'route': '/plugins/sso-linkedin',
      'icon': 'fa-linkedin-square'
    }
  });

  var Linkedin = {};

  Linkedin.init = function(params, callback) {
    var app = params.router,
        middleware = params.middleware,
        controllers = params.controllers;

    function render(req, res, next) {
      res.render('admin/plugins/sso-linkedin', {});
    }

    app.get('/admin/plugins/sso-linkedin', middleware.admin.buildHeader, render);
    app.get('/api/admin/plugins/sso-linkedin', render);

    callback();
  }

  Linkedin.getStrategy = function(strategies, callback) {
    meta.settings.get('sso-linkedin', function(err, settings) {
      if (!err && settings['id'] && settings['secret']) {
        passport.use(new passportLinkedin({
          consumerKey: settings['id'],
          consumerSecret: settings['secret'],
          callbackURL: nconf.get('url') + '/auth/linkedin/callback',
          profileFields: ['id', 'first-name', 'last-name', 'email-address', 'picture-url']
        }, function(accessToken, refreshToken, profile, done) {
          var pictureUrl = profile.pictureUrl || (profile._json && profile._json.pictureUrl);
          Linkedin.login(profile.id, profile.displayName, profile.name, profile.emails[0].value, pictureUrl, function(err, user) {
            if (err) {
              return done(err);
            }
            done(null, user);
          });
        }));

        strategies.push({
          name: 'linkedin',
          url: '/auth/linkedin',
          callbackURL: '/auth/linkedin/callback',
          icon: 'fa-linkedin-square'
        });
      }

      callback(null, strategies);
    });
  };

  Linkedin.login = function(liid, handle, name, email, pictureUrl, callback) {
    Linkedin.getUidByLinkedinId(liid, function(err, uid) {
      if(err) {
        return callback(err);
      }

      if (uid !== null) {
        // Existing User
        callback(null, {
          uid: uid
        });
      } else {
        // New User
        var success = function(uid) {
          // Save google-specific information to the user
          User.setUserField(uid, 'liid', liid);
          db.setObjectField('liid:uid', liid, uid);

          // trust the email.
          async.series([
            async.apply(User.setUserField, uid, 'email:confirmed', 1),
            async.apply(db.delete, 'uid:' + uid + ':confirm:email:sent'),
            async.apply(db.sortedSetRemove, 'users:notvalidated', uid),
            function (next) {
              // Save their photo, if present
              if (pictureUrl) {
                User.setUserField(uid, 'uploadedpicture', pictureUrl);
                User.setUserField(uid, 'picture', pictureUrl);
              }

              // save name.
              if (name && name.familyName && name.givenName) {
                User.setUserField(uid, 'firstName', name.givenName);
                User.setUserField(uid, 'lastName', name.familyName);
              }
              next();
            }
          ], function (err) {
            callback(err, {
              uid: uid
            });
          });
        };

        User.getUidByEmail(email, function(err, uid) {
          if(err) {
            return callback(err);
          }

          if (!uid) {
            User.create({username: handle,
              fullname: handle,
              registerFrom: 'linkedin',
              email: email}, function(err, uid) {
              if(err) {
                return callback(err);
              }

              success(uid);
            });
          } else {
            success(uid); // Existing account -- merge
          }
        });
      }
    });
  };

  Linkedin.getUidByLinkedinId = function(liid, callback) {
    db.getObjectField('liid:uid', liid, function(err, uid) {
      if (err) {
        return callback(err);
      }
      callback(null, uid);
    });
  };

  Linkedin.addMenuItem = function(custom_header, callback) {
    custom_header.authentication.push({
      "route": constants.admin.route,
      "icon": constants.admin.icon,
      "name": constants.name
    });

    callback(null, custom_header);
  }

  module.exports = Linkedin;
}(module));
