-- Cleanup script: Delete all rating_options except those with id 1, 5, 9
-- Run this manually if needed to clean up the database

DELETE FROM rating_options 
WHERE id NOT IN (1, 5, 9);

