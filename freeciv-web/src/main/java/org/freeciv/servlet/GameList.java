/*******************************************************************************
 * Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
 * Copyright (C) 2009-2017 The Freeciv-web project
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *******************************************************************************/
package org.freeciv.servlet;

import org.freeciv.services.Games;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * Displays the multiplayer games
 */
@Controller
@RequestMapping("/game/list")
public class GameList {

	private final Games games;

	@Autowired
	public GameList(Games games) {
		this.games = games;
	}

	@GetMapping
	public String listGames(@RequestParam(value = "v", required = false) String view, Model model) {
		try {
			model.addAttribute("multiPlayerGames", games.getMultiPlayerCount());
			model.addAttribute("multiPlayerGamesList", games.getMultiPlayerGames());
			model.addAttribute("view", view);
		} catch (RuntimeException err) {
			throw err;
		}
		return "game/list";
	}

}