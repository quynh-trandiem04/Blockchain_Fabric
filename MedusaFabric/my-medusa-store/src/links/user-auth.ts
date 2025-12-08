// src/links/user-auth.ts

// src/links/user-auth.ts

import { defineLink } from "@medusajs/framework/utils";
import UserModule from "@medusajs/user";
import AuthModule from "@medusajs/auth";

export default defineLink(
  UserModule.linkable.user,
  AuthModule.linkable.authIdentity
);