CREATE TABLE `game_results` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `game_id` int(11) NOT NULL,
  `player` varchar(32) NOT NULL,
  `win` tinyint(1) NOT NULL DEFAULT 0,
  `loss` tinyint(1) NOT NULL DEFAULT 0,
  `played_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_game_results_player` (`player`),
  KEY `idx_game_results_game_id` (`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
