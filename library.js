(function(module) {
  "use strict";

  var User = module.parent.require('./user'),
    meta = module.parent.require('./meta'),
    db = module.parent.require('../src/database'),
    passport = module.parent.require('passport'),
      passportLinkedin = require('passport-linkedin').Strategy,
      fs = module.parent.require('fs'),
      path = module.parent.require('path'),
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
          profileFields: ['id', 'first-name', 'last-name', 'email-address']
        }, function(accessToken, refreshToken, profile, done) {
          Linkedin.login(profile.id, profile.displayName, profile.emails[0].value, function(err, user) {
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

  Linkedin.login = function(liid, handle, email, callback) {
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
          callback(null, {
            uid: uid
          });
        };

        User.getUidByEmail(email, function(err, uid) {
          if(err) {
            return callback(err);
          }

          if (!uid) {
            User.create({username: handle, email: email}, function(err, uid) {
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
