const mongoose = require('mongoose');

const refreshTokenFamilySchema = mongoose.Schema(
  {
    family: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const RefreshTokenFamily = mongoose.model('RefreshTokenFamily', refreshTokenFamilySchema);

module.exports = RefreshTokenFamily;
