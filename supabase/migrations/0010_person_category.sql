-- Tracks which sheet of the original DSU audit workbook (Directory, Campus
-- Watch, CommunityCenter, GA Forms, Sodexo, Facilities Department) a person
-- belongs to, so exports can rebuild that same multi-sheet layout. "Returned"
-- isn't a stored category — an assignment lands on the Returned sheet purely
-- because date_returned is set, same as the rest of the app already treats it.

alter table people
  add column if not exists category text not null default 'Directory';
