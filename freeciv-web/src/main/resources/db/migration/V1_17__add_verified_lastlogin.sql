alter table auth add column `verified` BOOL DEFAULT 1;
alter table auth add column `last_login` TIMESTAMP;
alter table auth add column `elo_rating` INT;
alter table auth add column `verifykey` VARCHAR(120);
alter table auth drop column `activated`;

