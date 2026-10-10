const passport = require('passport');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { rolePermissions } = require('../config/roles');

const verifyCallback = (req, resolve, reject, requiredRights) => async (err, user, info) => {
  if (err || info || !user) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
  }
  req.user = user;

  if (requiredRights.length) {
    const permissions = rolePermissions.get(user.role) || [];
    const ownsRecord = req.params.userId && req.params.userId === user.id;
    const hasManagePermission = permissions.includes('users:manage');
    const allowed = requiredRights.every((permission) => {
      if (permission.endsWith(':self')) return Boolean(ownsRecord) && permissions.includes(permission);
      return permissions.includes(permission);
    });
    if (!allowed && !hasManagePermission) {
      return reject(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
    }
  }

  resolve();
};

const auth =
  (...requiredRights) =>
  async (req, res, next) => {
    return new Promise((resolve, reject) => {
      passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject, requiredRights))(req, res, next);
    })
      .then(() => next())
      .catch((err) => next(err));
  };

module.exports = auth;
