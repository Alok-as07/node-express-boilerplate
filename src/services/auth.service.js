const httpStatus = require('http-status');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const tokenService = require('./token.service');
const userService = require('./user.service');
const { Token, RefreshTokenFamily } = require('../models');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
const loginUserWithEmailAndPassword = async (email, password) => {
  const user = await userService.getUserByEmail(email);
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  return user;
};

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise}
 */
const logout = async (refreshToken) => {
  const refreshTokenDoc = await Token.findOne({ token: refreshToken, type: tokenTypes.REFRESH, blacklisted: false });
  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  await refreshTokenDoc.remove();
};

/**
 * Refresh auth tokens
 * @param {string} refreshToken
 * @returns {Promise<Object>}
 */
const refreshAuth = async (refreshToken) => {
  try {
    const payload = jwt.verify(refreshToken, config.jwt.secret);
    const { family, sub } = payload;
    if (family && (await RefreshTokenFamily.exists({ family }))) {
      throw new Error();
    }
    const user = await userService.getUserById(sub);
    if (!user) {
      throw new Error();
    }

    const refreshTokenDoc = await Token.findOneAndUpdate(
      {
        token: refreshToken,
        type: tokenTypes.REFRESH,
        user: sub,
        ...(family ? { family } : {}),
        blacklisted: false,
        used: false,
        expires: { $gt: new Date() },
      },
      { $set: { used: true, blacklisted: true } },
      { new: false }
    );
    if (!refreshTokenDoc) {
      const spent = await Token.findOne({ token: refreshToken, type: tokenTypes.REFRESH, used: true });
      if (spent && spent.family) {
        await RefreshTokenFamily.updateOne(
          { family: spent.family },
          { $setOnInsert: { family: spent.family, revokedAt: new Date() } },
          { upsert: true }
        );
        await Token.updateMany({ family: spent.family }, { $set: { blacklisted: true } });
      }
      throw new Error();
    }

    let tokens;
    try {
      tokens = await tokenService.generateAuthTokens(user, refreshTokenDoc.family || family);
    } catch (error) {
      await Token.updateOne({ _id: refreshTokenDoc._id }, { $set: { used: false, blacklisted: false } });
      throw error;
    }

    if (refreshTokenDoc.family && (await RefreshTokenFamily.exists({ family: refreshTokenDoc.family }))) {
      await Token.updateMany({ family: refreshTokenDoc.family }, { $set: { blacklisted: true } });
      throw new Error();
    }

    return tokens;
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

/**
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise}
 */
const resetPassword = async (resetPasswordToken, newPassword) => {
  try {
    const resetPasswordTokenDoc = await tokenService.verifyToken(resetPasswordToken, tokenTypes.RESET_PASSWORD);
    const user = await userService.getUserById(resetPasswordTokenDoc.user);
    if (!user) {
      throw new Error();
    }
    await userService.updateUserById(user.id, { password: newPassword });
    await Token.deleteMany({ user: user.id, type: tokenTypes.RESET_PASSWORD });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed');
  }
};

/**
 * Verify email
 * @param {string} verifyEmailToken
 * @returns {Promise}
 */
const verifyEmail = async (verifyEmailToken) => {
  try {
    const verifyEmailTokenDoc = await tokenService.verifyToken(verifyEmailToken, tokenTypes.VERIFY_EMAIL);
    const user = await userService.getUserById(verifyEmailTokenDoc.user);
    if (!user) {
      throw new Error();
    }
    await Token.deleteMany({ user: user.id, type: tokenTypes.VERIFY_EMAIL });
    await userService.updateUserById(user.id, { isEmailVerified: true });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed');
  }
};

module.exports = {
  loginUserWithEmailAndPassword,
  logout,
  refreshAuth,
  resetPassword,
  verifyEmail,
};
