import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20251205012742 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop constraint if exists "seller_company_code_unique";`);
    this.addSql(`alter table if exists "seller" drop constraint if exists "seller_handle_unique";`);
    this.addSql(`alter table if exists "carrier" drop constraint if exists "carrier_code_unique";`);
    this.addSql(`create table if not exists "carrier" ("id" text not null, "name" text not null, "code" text not null, "api_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "carrier_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_carrier_code_unique" ON "carrier" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_carrier_deleted_at" ON "carrier" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "seller" ("id" text not null, "name" text not null, "handle" text not null, "company_code" text not null, "email" text not null, "phone" text null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending', "admin_user_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seller_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seller_handle_unique" ON "seller" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seller_company_code_unique" ON "seller" ("company_code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seller_deleted_at" ON "seller" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "carrier" cascade;`);

    this.addSql(`drop table if exists "seller" cascade;`);
  }

}
