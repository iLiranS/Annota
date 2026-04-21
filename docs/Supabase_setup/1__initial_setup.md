## 1\. Initial Setup

**Last Updated:** April 21, 2026

This is v1 of the docs so they might miss some data ~ add an issue you encounter anything wrong.

First of all, you have to create the project in your desired server location via the Supabase dashboard. Once the project is provisioned, you will need to execute the schema below to build the database.

> **Note:** All primary user relations reference Supabase's built-in `auth.users` table. Ensure Supabase Auth is configured before running these migrations.

Notice : You can edit the limits for each role as you wish - the default one will be “user” unless you change it (below)