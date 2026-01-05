# Cleanup Rating Options

## Overview
This document explains how to clean up the `rating_options` table to keep only specific records.

## Manual Cleanup

To delete all rating_options records except those with id 1, 5, and 9, run:

```sql
DELETE FROM rating_options 
WHERE id NOT IN (1, 5, 9);
```

Or use the provided SQL file:

```bash
# In your database client (pgAdmin, DBeaver, psql, etc.)
# Execute the contents of: cleanup_rating_options.sql
```

## What This Does

- Keeps only rating_options with id: 1, 5, 9
- Deletes all other rating_options records
- This is a one-time cleanup operation

## Important Notes

- **Backup your database** before running this if you have important data
- This operation cannot be undone without a backup
- The records with id 1, 5, 9 will be preserved

