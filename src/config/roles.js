const allPermissions = {
  user: ['users:read:self', 'users:update:self', 'users:delete:self'],
  admin: ['users:read', 'users:create', 'users:update', 'users:delete', 'users:manage'],
};

const roles = Object.keys(allPermissions);
const rolePermissions = new Map(Object.entries(allPermissions));

module.exports = {
  roles,
  rolePermissions,
};
