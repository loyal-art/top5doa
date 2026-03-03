-- Add optional external link fields to subjects
alter table subjects
  add column link_photo text,
  add column link_music text,
  add column link_video text;

comment on column subjects.link_photo is 'Optional URL to a photo or image for this subject.';
comment on column subjects.link_music is 'Optional URL to a music track or page for this subject.';
comment on column subjects.link_video is 'Optional URL to a video for this subject.';
