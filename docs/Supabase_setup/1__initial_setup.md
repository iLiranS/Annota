## 1\. Initial Setup

**Last Updated:** June 13, 2026

First of all, you have to create the project in your desired server location via the Supabase dashboard. Once the project is provisioned, you will need to execute the schema below to build the database.

> **Note:** All primary user relations reference Supabase's built-in `auth.users` table. Ensure Supabase Auth is configured before running these migrations.

Notice : You can edit and customize the schema, roles, limits, etc. as you wish - just make sure the relations are properly linked.

Notice : I did not mention things like authentication setup with the different providers, URL configuration and other
standard procedures - just the sql schema and important functions, edge functions, cron jobs and storage configuration.