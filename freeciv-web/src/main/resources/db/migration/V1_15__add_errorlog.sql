create table errorlog (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `stacktrace` TEXT,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

