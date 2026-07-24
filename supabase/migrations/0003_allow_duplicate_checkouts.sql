-- Allow the same person to have the same key checked out multiple times
-- This supports cases where a person needs multiple copies of the same key
-- or needs to reissue a key they previously had.

drop index if exists assignments_one_open_per_person_key;
