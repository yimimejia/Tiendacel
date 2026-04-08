ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_username_or_email_unique";
DROP INDEX IF EXISTS "uniq_users_username_branch";
CREATE UNIQUE INDEX "uniq_users_username_branch" ON "users" ("username_or_email", "branch_id");
